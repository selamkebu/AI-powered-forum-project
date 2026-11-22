import { GoogleGenAI } from "@google/genai";
import { safeExecute } from "../../../../db/config.js";
import { ServiceUnavailableError } from "../../../utils/errors/index.js";

/**
 * Initialize Gemini Client
 */
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ServiceUnavailableError(
      "AI search service is temporarily unavailable"
    );
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Generate vector embedding using Gemini API
 * @param {string} text - Text to embed
 * @param {'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT'} taskType - Required task type
 * @returns {Promise<number[]>} Array of floating-point numbers
 */
export const generateEmbedding = async (text, taskType) => {
  if (!taskType) {
    throw new Error(
      "taskType is required for generateEmbedding ('RETRIEVAL_QUERY' or 'RETRIEVAL_DOCUMENT')"
    );
  }

  try {
    const ai = getGeminiClient();
    const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

    const response = await ai.models.embedContent({
      model,
      contents: text,
      config: {
        taskType,
      },
    });

    const values =
      response.embedding?.values || response.embeddings?.[0]?.values;

    if (!values || !Array.isArray(values)) {
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
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  if (magnitudeA === 0 || magnitudeB === 0) return -1;

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
};

/**
 * Store or update vector embedding in MySQL question_vectors table
 * (Fulfills checklist item: "Generate and store vector embeddings when a question is created or updated")
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
