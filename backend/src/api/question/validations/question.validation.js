import { body, param, query } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

export const listQuestionsValidation = [
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
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),

  validationErrorHandler,
];

export const singleQuestionValidation = [
  param("questionHash")
    .matches(/^[a-f0-9]{16}$/)
    .withMessage(
      "Question hash must be exactly 16 lowercase hexadecimal characters",
    ),

  validationErrorHandler,
];

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
