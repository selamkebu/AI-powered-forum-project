
import { param } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";



/**
 * a validation middleware that validate the document id in the get URL
 * 
 */
export const documentIdParamValidation = [
  param("documentId")
    .isInt({ min: 1 })
    .withMessage("Document Id must be a positive integer"),

    validationErrorHandler
];