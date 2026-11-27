import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";

import {
  getDocumentFileController,
  deleteDocumentController,
} from "../controller/rag.controller.js";

import { documentIdParamValidation } from "../validations/rag.validation.js";

const router = express.Router();

// GET /api/rag/documents/:documentId/file
router.get(
  "/documents/:documentId/file",
  authenticateUser,
  documentIdParamValidation,
  getDocumentFileController,
);

// DELETE /api/rag/documents/:documentId
router.delete(
  "/documents/:documentId",
  authenticateUser,
  documentIdParamValidation,
  deleteDocumentController,
);

export default router;
