
import { GoogleGenAI } from "@google/genai";
import { safeExecute } from "../../../../db/config.js";

/**
 * Generate an embedding from text using Gemini.
 *
 * @param {string} text - Text to convert into a vector
 * @param {string} taskType - Gemini embedding task type
 * @returns {Promise<number[]>}
 */
export const generateEmbedding = async (
  text,
  taskType = "RETRIEVAL_DOCUMENT"
) => {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Embedding text must be a non-empty string");
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // Read model configuration when the function runs.
  const embeddingModel =
    process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const response = await ai.models.embedContent({
    model: embeddingModel,
    contents: text.trim(),
    config: {
      taskType,
    },
  });

  const vector = response.embeddings?.[0]?.values;

  if (
    !Array.isArray(vector) ||
    vector.length === 0 ||
    !vector.every((value) => Number.isFinite(value))
  ) {
    throw new Error("Gemini returned an invalid embedding");
  }

  return vector;
};

/**
 * Generate and save a question embedding.
 *
 * Saves status 'ready' when Gemini succeeds.
 * Saves status 'failed' with [] when Gemini fails.
 *
 * @param {number} questionId
 * @param {string} title
 * @returns {Promise<string>} ready or failed
 */
export const saveQuestionEmbedding = async (
  questionId,
  title
) => {
  let embedding = [];
  let status = "failed";

  try {
    embedding = await generateEmbedding(
      title,
      "RETRIEVAL_DOCUMENT"
    );

    status = "ready";
  } catch (error) {
    console.error(
      `Embedding failed for question ${questionId}:`,
      error.message
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
    [
      questionId,
      title,
      JSON.stringify(embedding),
      status,
    ]
  );

  return status;
};
