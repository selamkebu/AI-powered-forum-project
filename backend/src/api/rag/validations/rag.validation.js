import { param } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

/**
 * Validates the :documentId path param (used by every /documents/:documentId route).
 * Converts it to a number so controllers can use it directly.
 */
export const documentIdParamValidation = [
  param("documentId")
    .isInt({ min: 1 })
    .withMessage("Document id must be a positive integer")
    .bail()
    .toInt(),
  validationErrorHandler,
];
