import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import { documentIdParamValidation } from "../validations/rag.validation.js";
import {getDocumentMetaController } from "../controller/rag.controller.js";

const router = express.Router();

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

export default router;
