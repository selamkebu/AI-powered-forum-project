import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import { uploadSinglePdf } from "../validations/rag.upload.config.js";
import {
  createDocumentController,
  getDocumentFileController,
  deleteDocumentController,
  getDocumentMetaController,
  listDocumentsController,
} from "../controller/rag.controller.js";

import { documentIdParamValidation } from "../validations/rag.validation.js";

const router = express.Router();
// GET /api/rag/documents
router.get("/documents", authenticateUser, listDocumentsController);
// POST /api/rag/documents
// Order matters: auth first (so unauthenticated users never upload), then multer, then the controller
router.post(
  "/documents",
  authenticateUser,
  // uploadSinglePdf,
  //createDocumentController,
);

/**
* @route Get /api/rag/documents/:documentId
* @desc Get RAG Document Metadata
* @access Protected

*/

router.get(
  "/documents/:documentId",
  authenticateUser,
  documentIdParamValidation,
  getDocumentMetaController,
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
