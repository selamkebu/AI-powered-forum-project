
import { param } from 'express-validator';
import { ServiceUnavailableError } from '../../../utils/errors/index.js';
import { registerController } from './../../auth/controller/auth.controller';
import { GoogleGenAI } from "@google/genai";



const apiKey = process.env.GEMINI_API_KEY;
// Initialize Gemini only when an API key is available.
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.0-flash-lite";



/**
 * Strip optional markdown fance and parse JSON object from model text
 * @param {string} res 
 * @returns {object/null}
 */

function parseJsonObjectFromGeminiText(raw) {
    if (!raw || typeof raw !== 'string') return null;

    let t = raw.trim();
    if (t.startsWith('```')) {
        t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }
    try {
        const v = JSON.parse(t);
        return v && typeof v === 'object' && !Array.isArray(v)
            ? v
            : null;
    } catch {
        return null;
    }
}

async function fetchGeminiJsonTextResponse(userPrompt) {
    const response= await ai.model.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: userPrompt,
        config:{
            maxOutputTokens: 300,
        },
    });
    console.log(response);
    const text=response?.text;
    return typeof text==='string' ? text :'';

    
}

/**
 * Whether a draft answer seems to address the question (relevance, not correctness),
 * @param {{questionTitle: string; questionContent: string; answerText: string}} param
 * @returns {Promise<{level: string note: string}>}
 */
export const assessAnswerAgainstQuestionService = async ({
    questionTitle,
    questionContent,
    answerText,}) => {
        const userPrompt =`You review whether a forum ANSWER draft adresses the QUESTION (relevance and completenes of engagement - not whether the answer is factually correct).
        
        QUESTION TITLE:
        ${questionTitle}

        QUESTION BODY:
        ${questionContent}

        ANSWER DRAFT:
        ${answerText}

            Reply with ONLY valid JSON( no markdown fences), exactly this stage:
            {
                "level" :"strong"|"partial"|"weak" ,
                 "note":"one short sentence"}
            Rules:
            - level: "strong" if the draft clearly engages with the question; "partial" if somewhat related but missing key parts of the ask; "weak" if mostly off-topic or too vague.
            - note: one sentence, plain language, no markdown, under 200 characters. Frame as fit/relevance, not grading.`;

        try{
            const raw =await fetchGeminiJsonTextResponse(userPrompt);
            const parsed=parseJosnObjectFromGeminiText(raw);
            const levelRaw=parsed?.level;
            const noteRaw=parsed?.note;
            const level = 
                levelRaw === 'strong' || levelRaw === 'partial' || levelRaw === 'weak'
                ? levelRaw 
                : 'partial';
            const note =
                 typeof noteRaw === 'string' && noteRaw.trim() 
                    ? noteRaw.trim().slice(0, 200)
                    : 'Could not summarize fit: treat this as a partial match.';
                    
            return {level, note};

        }catch (error){
            console.error('assessAnswerAgainstQuestionService:', error);
            throw new ServiceUnavailableError(
                'AI fit check is temporarily unavailable. Please try again later. ',
            );
        }
        } 



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
