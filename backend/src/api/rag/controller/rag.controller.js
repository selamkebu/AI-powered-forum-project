import { StatusCodes } from "http-status-codes";
import { BadRequestError, NotFoundError } from "../../../utils/errors/index.js";
import {
  assertOwnedDocument,
  buildPdfFileName,
  createDocumentFromUploadService,
  deleteDocumentService,
  getUploadRoot,
  resolveDocumentFilePath,
  getDocumentMetaService,
  listDocumentsForUserService,
} from "../service/rag.service.js";

export const createDocumentController = async (req, res, next) => {
  try {
    // uploadSinglePdf from rag.upload.config.js puts the file's details on req.file: path, filename, size, mimetype and originalname.

    if (!req.file) {
      throw new BadRequestError(
        'A PDF file is required in the "file" form field',
      );
    }

    const document = await createDocumentFromUploadService(
      req.user.id,
      req.file,
    );

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message:
        document.status === "ready"
          ? "Document uploaded and processed."
          : "Document uploaded, but processing failed.",
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get RAG Document Metadata - feature/T-24-rag-documents branch
 * @param {object} req - request object containing the documentId in URL parameters.
 * @param {object} res - response object used to return the document metadata.
 * @param {Function} next - next function used to forward errors to the error-handling middleware.
 * @returns {Promise<void>} Sends a JSON response containing the document metadata and a success message.
 */
export const getDocumentMetaController= async (req, res, next) => {
  try {
    const { documentId } = req.params;

    const result = await getDocumentMetaService(documentId);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Document metadata fetched successfully",
      ...result,

    })
  }
  catch(error) {
    next(error);
  }
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
 * T-24: GET /api/rag/documents
 * Lists documents uploaded by the authenticated user.
 */
export const listDocumentsController = async (req, res, next) => {
  try {
    const documents = await listDocumentsForUserService(req.user.id);

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Documents fetched successfully.",
      data: documents,
    });
  } catch (error) {
    next(error);
  }
};
