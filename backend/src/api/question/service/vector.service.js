import { GoogleGenAI } from "@google/genai";
import { safeExecute } from "../../../../db/config.js";

/**
 * Initialize Gemini Client
 */
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Generate vector embedding using Gemini API
 * @param {string} text - Text to embed
 * @param {'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT'} taskType
 * @returns {Promise<number[]>} Array of floating-point numbers
 */
export const generateEmbedding = async (text, taskType = "RETRIEVAL_QUERY") => {
  const ai = getGeminiClient();
  const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

  const response = await ai.models.embedContent({
    model,
    contents: text,
    config: {
      taskType,
    },
  });

  const values = response.embedding?.values || response.embeddings?.[0]?.values;

  if (!values || !Array.isArray(values)) {
    throw new Error(
      "Failed to extract embedding values from Gemini API response",
    );
  }

  return values;
};

/**
 * Calculate Cosine Similarity between two vector arrays:
 * Formula: (A . B) / (||A|| * ||B||)
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Score between -1 and 1
 */
export const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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
  status = "ready",
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
