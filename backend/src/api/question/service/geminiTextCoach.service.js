import { GoogleGenAI } from "@google/genai";
import { ServiceUnavailableError } from "../../../utils/errors/index.js";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash-lite";

// Initialize Gemini only when an API key is available.
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Generates practical tips to improve a question draft.
 */
export const generateQuestionDraftCoachService = async ({ title, content }) => {
  if (!ai) {
    throw new ServiceUnavailableError(
      "AI draft coach is not configured. Please try again later.",
    );
  }

  const prompt = `
You are an experienced programming forum writing coach.

Review the following question draft and provide practical suggestions.

Evaluate:
1. Clarity: Is the problem clearly explained?
2. Completeness: Is enough information provided?
3. Formatting: Would code blocks, error messages, or screenshots help?
4. Context: Are the programming language, framework, and attempted solutions explained?

Title:
${title || "No title provided"}

Question content:
${content}

Instructions:
- Provide 3 to 5 specific and useful improvement tips.
- Focus on helping the user improve the question before publishing.
- Do not answer or solve the programming question.
- Keep each tip concise and actionable.
- Return only valid JSON in this format:
{
  "tips": [
    "First improvement tip",
    "Second improvement tip",
    "Third improvement tip"
  ]
}
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text);

    if (
      !result ||
      !Array.isArray(result.tips) ||
      result.tips.length === 0 ||
      !result.tips.every(
        (tip) => typeof tip === "string" && tip.trim().length > 0,
      )
    ) {
      throw new Error("Invalid response format from Gemini");
    }

    return {
      tips: result.tips,
    };
  } catch (error) {
    console.error("Gemini draft coach error:", error.message);

    throw new ServiceUnavailableError(
      "Unable to generate draft suggestions right now. Please try again later.",
    );
  }
};
