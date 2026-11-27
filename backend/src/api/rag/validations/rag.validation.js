
import { param } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";



/**
 * Get RAG Document Metadata - feature/T-24-rag-documents branch
 * Validation middleware that validates the documentId URL parameter.
 * The document ID should be a positive integer. This function handles the validation.
 *
 * @returns {Array} An array of validation middleware functions.
 */
export const documentIdParamValidation = [
  param("documentId")
    .isInt({ min: 1 })
    .withMessage("Document Id must be a positive integer"),

    validationErrorHandler
];