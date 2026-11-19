import { param, query } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

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

export const singleQuestionValidation = [
  param("questionHash")
    .matches(/^[a-f0-9]{16}$/)
    .withMessage(
      "Question hash must be exactly 16 lowercase hexadecimal characters",
    ),

  validationErrorHandler,
];
