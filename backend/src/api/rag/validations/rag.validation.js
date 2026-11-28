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
