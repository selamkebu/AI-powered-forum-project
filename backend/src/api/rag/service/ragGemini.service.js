import { GoogleGenAI } from "@google/genai";
import { ServiceUnavailableError } from "../../../utils/errors/index.js";

// Chunks sent per Gemini request. Kept below the per-request limit so large documents are split into several calls.
const BATCH_SIZE = 50;

// Total tries per batch, including the first one (so 3 means 2 retries).
const MAX_ATTEMPTS = 3;

let client;

/**
 * Returns the shared Gemini client, creating it on first use.
 *
 * Created lazily so a missing API key doesn't crash the app at import time.
 * It only fails when an embedding is actually requested.
 *
 * @returns {GoogleGenAI}
 * @throws {ServiceUnavailableError} If GEMINI_API_KEY is not set.
 */
const getClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new ServiceUnavailableError("GEMINI_API_KEY is not configured");
  }
  // Reuse one client for every request instead of building a new one each call.
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
};

/**
 * Scales a vector to unit length (L2 normalization).
 *
 * Gemini only returns pre-normalized embeddings at the full 3072 dimensions.
 * Since we request 768 dimensions, we normalize them ourselves so that
 * cosine similarity reduces to a plain dot product.
 *
 * @param {number[]} vector - The embedding to normalize.
 * @returns {number[]} The unit-length vector (unchanged if its norm is 0).
 */

const normalize = (vector) => {
  const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
  return norm === 0 ? vector : vector.map((x) => x / norm);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Embeds one batch of text chunks with Gemini.
 *
 * Retries rate limits (429) and server errors (5xx) with exponential
 * backoff. Other errors fail immediately, since retrying can't fix them.
 *
 * @param {string[]} texts - One batch of chunks.
 * @param {string} taskType - Gemini task type, e.g. "RETRIEVAL_DOCUMENT".
 * @returns {Promise<number[][]>} One normalized embedding per chunk, in input order.
 * @throws {ServiceUnavailableError} On a non-retryable error or after MAX_ATTEMPTS.
 */
const embedBatch = async (texts, taskType) => {
  // Default output is 3072 numbers per chunk; 768 cuts the JSON stored in MySQL to roughly a quarter.
  const dimensions = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS) || 768;

  // No end condition on purpose: the loop exits via return on success or throw on failure.
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await getClient().models.embedContent({
        model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
        contents: texts,
        config: { taskType, outputDimensionality: dimensions },
      });

      // A mismatch would silently shift every vector onto the wrong chunk.
      if (res.embeddings?.length !== texts.length) {
        throw new Error("Gemini returned an unexpected number of embeddings");
      }
      return res.embeddings.map((e) => normalize(e.values));
    } catch (err) {
      // 429 and 5xx are temporary. 400 and 401/403 (bad request, bad key) won't change on retry.
      const retryable = err.status === 429 || err.status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS) {
        throw new ServiceUnavailableError(`Embedding failed: ${err.message}`);
      }
      await sleep(1000 * 2 ** (attempt - 1)); // 1s, 2s, 4s...
    }
  }
};

/**
 * Embeds all chunk texts of a document, in order.
 *
 * Texts are sent to Gemini in batches of BATCH_SIZE, one batch at a time.
 * A single request with every chunk could exceed Gemini's per-request limit,
 * and one request per chunk would be slow and burn through the rate limit.
 *
 * @param {string[]} texts - Chunk texts, e.g. 230 chunks for one document.
 * @param {string} [taskType="RETRIEVAL_DOCUMENT"] - Tells Gemini these texts are documents to be searched later.
 * @returns {Promise<number[][]>} One embedding per text, in the same order as `texts`.
 */
export const embedTexts = async (texts, taskType = "RETRIEVAL_DOCUMENT") => {
  const vectors = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    // Awaited in sequence so batches never run in parallel, and results stay in order.
    vectors.push(
      ...(await embedBatch(texts.slice(i, i + BATCH_SIZE), taskType)),
    );
  }
  return vectors;
};

/**
 * Embeds a single search query for cosine similarity retrieval.
 * Reuses embedTexts so dimensionality and L2 normalization match stored chunks.
 *
 * @param {string} query - Non-empty search query text.
 * @returns {Promise<number[]>} Normalized embedding vector.
 */
export const embedQueryText = async (query) => {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) {
    throw new Error("Search query must be a non-empty string");
  }
  const [vector] = await embedTexts([trimmed], "RETRIEVAL_QUERY");
  return vector;
};
