import { NotFoundError } from "../../../utils/errors/index.js";
import {
  assertOwnedDocument,
  buildPdfFileName,
  getUploadRoot,
  resolveDocumentFilePath,
} from "../service/rag.service.js";

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
