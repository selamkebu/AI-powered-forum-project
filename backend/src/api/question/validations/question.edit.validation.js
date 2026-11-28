import { body, param } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

export const updateQuestionValidation = [
  param("questionHash")
    .matches(/^[a-f0-9]{16}$/)
    .withMessage("Question hash must be exactly 16 lowercase hexadecimal characters"),

  body("title")
    .isString()
    .withMessage("Title must be a string")
    .bail()
    .trim()
    .isLength({ min: 5, max: 255 })
    .withMessage("Title must be between 5 and 255 characters"),

  body("content")
    .isString()
    .withMessage("Content must be a string")
    .bail()
    .trim()
    .isLength({ min: 10, max: 10000 })
    .withMessage("Content must be between 10 and 10000 characters"),

  validationErrorHandler,
];