import { GoogleGenAI } from "@google/genai";
import { safeExecute } from "../../../../db/config.js";
import { ServiceUnavailableError } from "../../../utils/errors/index.js";

/**
 * Initialize Gemini Client
 */
let geminiClient = null;
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ServiceUnavailableError(
      "AI search service is temporarily unavailable"
    );
  }
  geminiClient ??= new GoogleGenAI({ apiKey });
  return geminiClient;
};

/**
 * Generate vector embedding using Gemini API
 * @param {string} text - Text to embed
 * @param {'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT'} taskType - Required task type
 * @returns {Promise<number[]>} Array of floating-point numbers
 */
export const generateEmbedding = async (text, taskType) => {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Embedding text must be a non-empty string");
  }

  if (!taskType) {
    throw new Error(
      "taskType is required for generateEmbedding ('RETRIEVAL_QUERY' or 'RETRIEVAL_DOCUMENT')"
    );
  }

  try {
    const ai = getGeminiClient();
    const model =
      process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

    const response = await ai.models.embedContent({
      model,
      contents: text.trim(),
      config: {
        taskType,
      },
    });

    const values =
      response.embedding?.values || response.embeddings?.[0]?.values;

    if (!values || !Array.isArray(values) || !values.every((v) => Number.isFinite(v))) {
      throw new ServiceUnavailableError(
        "AI search service is temporarily unavailable"
      );
    }

    return values;
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }
    console.error("Gemini embedding error:", error.message);
    throw new ServiceUnavailableError(
      "AI search service is temporarily unavailable"
    );
  }
};

/**
 * Parse and validate stored JSON embedding
 * Single canonical definition for the codebase
 * @param {any} embedding
 * @returns {number[] | null}
 */
export const parseEmbedding = (embedding) => {
  try {
    const parsed =
      typeof embedding === "string" ? JSON.parse(embedding) : embedding;

    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every((value) => Number.isFinite(Number(value)))
    ) {
      return null;
    }

    return parsed.map(Number);
  } catch {
    return null;
  }
};

/**
 * Calculate Cosine Similarity between two vector arrays:
 * Formula: (A . B) / (||A|| * ||B||)
 * Single canonical definition for the codebase
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Score between -1 and 1
 */
export const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return -1;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Generate and save a question embedding (T-09).
 *
 * Saves status 'ready' when Gemini succeeds.
 * Saves status 'failed' with [] when Gemini fails.
 *
 * @param {number} questionId
 * @param {string} title
 * @returns {Promise<string>} ready or failed
 */
export const saveQuestionEmbedding = async (questionId, title) => {
  let embedding = [];
  let status = "failed";

  try {
    embedding = await generateEmbedding(title, "RETRIEVAL_DOCUMENT");
    status = "ready";
  } catch (error) {
    console.error(
      `Embedding failed for question ${questionId}:`,
      error.message,
    );
  }

  await safeExecute(
    `INSERT INTO question_vectors
       (question_id, source_text, embedding, status)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       source_text = VALUES(source_text),
       embedding = VALUES(embedding),
       status = VALUES(status)`,
    [questionId, title, JSON.stringify(embedding), status],
  );

  return status;
};

/**
 * Store a question embedding directly in question_vectors (T-11).
 *
 * @param {number} questionId
 * @param {string} sourceText
 * @param {number[]} embedding
 * @param {'ready' | 'pending' | 'failed'} status
 */
export const storeQuestionVector = async (
  questionId,
  sourceText,
  embedding,
  status = "ready"
) => {
  const sql = `
    INSERT INTO question_vectors (question_id, source_text, embedding, status)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      source_text = VALUES(source_text),
      embedding = VALUES(embedding),
      status = VALUES(status),
      updated_at = CURRENT_TIMESTAMP
  `;

  await safeExecute(sql, [
    questionId,
    sourceText,
    JSON.stringify(embedding),
    status,
  ]);
};
