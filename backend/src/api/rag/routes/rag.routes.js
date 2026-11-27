import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import { uploadSinglePdf } from "../validations/rag.upload.config.js";
import { createDocumentController } from "../controller/rag.controller.js";
import { documentIdParamValidation } from "../validations/rag.validation.js";
import { getDocumentFileController } from "../controller/rag.controller.js";

const router = express.Router();

// POST /api/rag/documents
// Order matters: auth first (so unauthenticated users never upload), then multer, then the controller
router.post(
  "/documents",
  authenticateUser,
  uploadSinglePdf,
  createDocumentController,
);

//GET/api/rag/documents/:documentID/file

router.get(
  "/documents/:documentId/file",
  authenticateUser,
  documentIdParamValidation,
  getDocumentFileController,
);
export default router;
