import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import { uploadSinglePdf } from "../validations/rag.upload.config.js";
import {
  createDocumentController, 
  getDocumentFileController,
  deleteDocumentController,
  searchInDocumentController,
} from "../controller/rag.controller.js";

import {
  documentIdParamValidation,
  searchDocumentValidation,
} from "../validations/rag.validation.js";

const router = express.Router();

// POST /api/rag/documents
// Order matters: auth first (so unauthenticated users never upload), then multer, then the controller
router.post(
  "/documents",
  authenticateUser,
  uploadSinglePdf,
  createDocumentController,
);


// GET /api/rag/documents/:documentId/search
router.get(
  "/documents/:documentId/search",
  authenticateUser,
  searchDocumentValidation,
  searchInDocumentController,
);

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
