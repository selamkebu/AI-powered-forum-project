import { GoogleGenAI } from "@google/genai";
import { ServiceUnavailableError } from "../../../utils/errors/index.js";

/**
 * Initialize Gemini client lazily
 */
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ServiceUnavailableError(
      "AI fit check is temporarily unavailable. Please try again later.",
    );
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Strip optional markdown fence and parse JSON object from model text
 * @param {string} raw
 * @returns {object|null}
 */
function parseJsonObjectFromGeminiText(raw) {
  if (!raw || typeof raw !== "string") return null;

  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  try {
    const v = JSON.parse(t);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

async function fetchGeminiJsonTextResponse(userPrompt, retries = 2) {
  const ai = getGeminiClient();
  const primaryModel = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash-lite";
  const candidateModels = [primaryModel, "gemini-3.5-flash-lite", "gemini-flash-lite-latest"].filter(
    (v, i, a) => a.indexOf(v) === i
  );

  for (const model of candidateModels) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            responseMimeType: "application/json",
          },
        });

        const text = response?.text;
        if (typeof text === "string" && text.trim()) {
          return text;
        }
      } catch (error) {
        const isTransient =
          error?.status === 503 ||
          error?.status === 429 ||
          error?.message?.includes("503") ||
          error?.message?.includes("high demand") ||
          error?.message?.includes("UNAVAILABLE");

        if (isTransient && attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        // If exhausted attempts on this model, loop to next candidate model
        break;
      }
    }
  }

  throw new ServiceUnavailableError(
    "AI fit check is temporarily unavailable. Please try again later."
  );
}

/**
 * Whether a draft answer seems to address the question (relevance, not correctness).
 * @param {{questionTitle: string; questionContent: string; answerText: string}} param
 * @returns {Promise<{level: string; note: string}>}
 */
export const assessAnswerAgainstQuestionService = async ({
  questionTitle,
  questionContent,
  answerText,
}) => {
  const userPrompt = `You review whether a forum ANSWER draft addresses the QUESTION (relevance and completeness of engagement - not whether the answer is factually correct).

<question_title>
${questionTitle}
</question_title>

<question_content>
${questionContent}
</question_content>

<answer_draft>
${answerText}
</answer_draft>

Reply with ONLY valid JSON (no markdown fences), exactly in this shape:
{
  "level": "strong" | "partial" | "weak",
  "note": "one short sentence"
}

Rules:
- level: "strong" if the draft clearly engages with the question; "partial" if somewhat related but missing key parts of the ask; "weak" if mostly off-topic or too vague.
- note: one sentence, plain language, under 200 characters. Frame as fit/relevance, not grading.`;

  try {
    const raw = await fetchGeminiJsonTextResponse(userPrompt);
    const parsed = parseJsonObjectFromGeminiText(raw);
    const levelRaw = parsed?.level;
    const noteRaw = parsed?.note;
    const level =
      levelRaw === "strong" || levelRaw === "partial" || levelRaw === "weak"
        ? levelRaw
        : "partial";
    const note =
      typeof noteRaw === "string" && noteRaw.trim()
        ? noteRaw.trim().slice(0, 200)
        : "Could not summarize fit: treat this as a partial match.";

    return { level, note };
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }
    console.error("assessAnswerAgainstQuestionService error:", error.message);
    throw new ServiceUnavailableError(
      "AI fit check is temporarily unavailable. Please try again later.",
    );
  }
};

/**
 * Generates practical tips to improve a question draft.
 */
export const generateQuestionDraftCoachService = async ({ title, content }) => {
  const ai = getGeminiClient();
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.0-flash-lite";

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

    const parsed = parseJsonObjectFromGeminiText(response?.text);
    return {
      tips: Array.isArray(parsed?.tips) ? parsed.tips : [],
    };
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }
    console.error("generateQuestionDraftCoachService error:", error.message);
    throw new ServiceUnavailableError(
      "AI draft coach is not configured. Please try again later.",
    );
  }
};
