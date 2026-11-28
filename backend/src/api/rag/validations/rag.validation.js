import { body, param, query } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

const documentIdRule = () =>
  param("documentId")
    .isInt({ min: 1 })
    .withMessage("Document id must be a positive integer")
    .bail()
    .toInt();

/**
 * Validates the :documentId path param (used by every /documents/:documentId route).
 * Converts it to a number so controllers can use it directly.
 */
export const documentIdParamValidation = [
  documentIdRule(),
  validationErrorHandler,
];

/**
 * Validates GET /api/rag/documents/:documentId/search path and query parameters.
 */
export const searchDocumentValidation = [
  documentIdRule(),
  query("query")
    .exists()
    .withMessage("query parameter is required")
    .bail()
    .isString()
    .withMessage("query parameter must be a string")
    .bail()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("Search query must be between 1 and 500 characters"),
  query("k")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("k must be an integer between 1 and 50")
    .bail()
    .toInt(),
  query("threshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("threshold must be a number between 0 and 1")
    .bail()
    .toFloat(),
  validationErrorHandler,
];
export const deleteDocumentValidation = (req, res, next) => {
  const { documentId } = req.params;

  if (!/^[1-9]\d*$/.test(documentId)) {
    return res.status(400).json({
      success: false,
      message: "documentId must be a positive integer",
    });
  }

  const parsedId = Number(documentId);

  if (!Number.isSafeInteger(parsedId)) {
    return res.status(400).json({
      success: false,
      message: "documentId must be a valid integer",
    });
  }

  req.params.documentId = parsedId;

  next();
};
export let queryDocumentBodyValidation = [
  body("query")
    .isString()
    .withMessage("query must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Some query is required")
    .bail(),
  validationErrorHandler,
];
