import { StatusCodes } from "http-status-codes";
import { BadRequestError, NotFoundError } from "../../../utils/errors/index.js";
import {
  createDocumentFromUploadService,
  assertOwnedDocument,
  buildPdfFileName,
  deleteDocumentService,
  getUploadRoot,
  resolveDocumentFilePath,
  searchInDocumentService,
} from "../service/rag.service.js";

export const createDocumentController = async (req, res) => {
  // uploadSinglePdf from rag.upload.config.js puts the file's details on req.file: path, filename, size, mimetype and originalname.

  if (!req.file) {
    throw new BadRequestError(
      'A PDF file is required in the "file" form field',
    );
  }

  const document = await createDocumentFromUploadService(req.user.id, req.file);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message:
      document.status === "ready"
        ? "Document uploaded and processed."
        : "Document uploaded, but processing failed.",
    data: document,
  });
};


/**
 * GET /api/rag/documents/:documentId/file
 * Streams the user's own PDF so the browser can render it inline.
 */
export const getDocumentFileController = async (req, res, next) => {
  try {
    // 1. Ownership check (404 if missing or not yours) and get storage_path
    const document = await assertOwnedDocument(
      req.user.id,
      Number(req.params.documentId),
    );

    // 2. Resolve the stored relative path to a safe location inside the upload folder
    const { relativePath } = resolveDocumentFilePath(document.storage_path);
    const { ascii, encoded } = buildPdfFileName(document.title);

    // 3. Stream it. `root` keeps the lookup inside the upload folder;
    //    sendFile also handles Range requests, which PDF viewers use.
    res.sendFile(
      relativePath,
      {
        root: getUploadRoot(),
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`,
          "Cache-Control": "private, no-cache",
          "X-Content-Type-Options": "nosniff",
        },
      },
      (error) => {
        if (!error) return;
        // Client closed the tab mid-download: nothing left to send.
        if (res.headersSent) return;
        if (error.code === "ENOENT" || error.status === 404) {
          return next(new NotFoundError("PDF file not found on the server."));
        }
        return next(error);
      },
    );
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/rag/documents/:documentId
 * Deletes the user's own document (PDF file + DB row).
 */
export const deleteDocumentController = async (req, res, next) => {
  try {
    // Get document ID from URL
    const documentId = Number(req.params.documentId);

    // Get authenticated user's ID
    const userId = req.user.id;

    // Call the service
    const result = await deleteDocumentService(documentId, userId);

    // Send success response
    return res.status(200).json({
      success: true,
      message: "Document deleted successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rag/documents/:documentId/search
 * Performs semantic search within the user's ready PDF and returns ranked excerpts.
 */
export const searchInDocumentController = async (req, res, next) => {
  try {
    const data = await searchInDocumentService({
      userId: req.user.id,
      documentId: Number(req.params.documentId),
      query: req.query.query,
      k: req.query.k,
      threshold: req.query.threshold,
    });

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Ranked chunk excerpts",
      data,
    });
  } catch (error) {
    next(error);
  }
};
