import { body, param, query } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

// ======================================================
// 1. GET QUESTIONS VALIDATION
// ======================================================

export const getQuestionsValidation = [
  query("search")
    .optional()
    .isString()
    .withMessage("search must be a string")
    .isLength({ max: 200 })
    .withMessage("search must be at most 200 characters long"),

  query("mine")
    .optional()
    .isIn(["true", "false", "1", "0"])
    .withMessage("mine must be true or false"),

  validationErrorHandler,
];

// ======================================================
// 2. SINGLE QUESTION VALIDATION
// ======================================================

export const singleQuestionValidation = [
  param("questionHash")
    .matches(/^[a-f0-9]{16}$/)
    .withMessage(
      "Question hash must be exactly 16 lowercase hexadecimal characters",
    ),

  validationErrorHandler,
];

// ======================================================
// 3. AI QUESTION DRAFT COACH VALIDATION
// ======================================================

export const generateQuestionDraftCoachValidation = [
  body("title").optional().isString().withMessage("Title must be a string"),

  body("content")
    .isString()
    .withMessage("Question content must be a string")
    .trim()
    .notEmpty()
    .withMessage("Question content is required"),

  validationErrorHandler,
];

// ======================================================
// 4. SIMILAR QUESTIONS VALIDATION
// ======================================================

export const getSimilarQuestionsValidation = [
  param("questionHash")
    .matches(/^[a-f0-9]{16}$/)
    .withMessage(
      "Question hash must be exactly 16 lowercase hexadecimal characters",
    ),

  query("k")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("k must be an integer between 1 and 20")
    .toInt(),

  query("threshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("threshold must be between 0 and 1")
    .toFloat(),

  validationErrorHandler,
];

// ======================================================
// 5. CREATE QUESTION VALIDATION
// ======================================================

/**
 * T-09: Create Question API
 * POST /api/questions
 */
export const createQuestionValidation = [
  body("title")
    .isString()
    .withMessage("Title must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Question title is required")
    .isLength({ min: 5, max: 255 })
    .withMessage("Title must be between 5 and 255 characters"),

  body("content")
    .isString()
    .withMessage("Content must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Question content is required")
    .isLength({ min: 10, max: 10000 })
    .withMessage("Content must be between 10 and 10000 characters"),

  validationErrorHandler,
];

// ======================================================
// 6. SEMANTIC SEARCH VALIDATION
// ======================================================

/**
 * T-11: Validate semantic search query parameters
 */
export const searchQuestionsValidation = [
  query("query")
    .notEmpty()
    .withMessage("query parameter is required")
    .isString()
    .withMessage("query must be a string")
    .trim()
    .isLength({ min: 5 })
    .withMessage("Search query must be at least 5 characters long"),

  query("k")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("k must be an integer between 1 and 20"),

  query("threshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("threshold must be a float between 0 and 1"),

  validationErrorHandler,
];
