import path from "node:path";
import { safeExecute } from "../../../../db/config.js";
import { NotFoundError } from "../../../utils/errors/index.js";

/**
 * Absolute folder where uploaded PDFs live (RAG_UPLOAD_DIR, default uploads/rag).
 * Read at call time so it always reflects the loaded .env.
 */
export const getUploadRoot = () =>
  path.resolve(process.cwd(), process.env.RAG_UPLOAD_DIR || "uploads/rag");

/**
 * Loads a document only if it belongs to the given user.
 * Returns 404 for "does not exist" AND "belongs to someone else", so ids can't be probed.
 *
 * @param {number} userId
 * @param {number} documentId
 * @returns {Promise<object>} the `documents` row
 */
export const assertOwnedDocument = async (userId, documentId) => {
  const rows = await safeExecute(
    `SELECT document_id, user_id, title, mime_type, storage_path, byte_size,
            status, error_message, created_at, updated_at
       FROM documents
      WHERE document_id = ? AND user_id = ?
      LIMIT 1`,
    [documentId, userId],
  );

  if (rows.length === 0) {
    throw new NotFoundError("Document not found.");
  }
  return rows[0];
};

/**
 * Turns the stored (relative) path, e.g. "1/1234-abc.pdf", into a safe location
 * inside the upload folder. Anything that would escape the folder (../, absolute
 * paths elsewhere) is treated as "not found".
 *
 * @param {string} storagePath value of documents.storage_path
 * @returns {{ absolutePath: string, relativePath: string }}
 */
export const resolveDocumentFilePath = (storagePath) => {
  const root = getUploadRoot();
  const absolutePath = path.resolve(root, String(storagePath ?? ""));
  const relativePath = path.relative(root, absolutePath);

  if (
    !storagePath ||
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new NotFoundError("PDF file not found.");
  }

  return { absolutePath, relativePath };
};

/**
 * Builds a safe download name from the document title, always ending in .pdf.
 * Returns an ASCII fallback plus a UTF-8 encoded version for non-English titles.
 *
 * @param {string} title
 * @returns {{ ascii: string, encoded: string }}
 */
export const buildPdfFileName = (title) => {
  let base = String(title ?? "")
    .replace(/[\r\n"\\/]+/g, "_")
    .trim();
  if (!base) base = "document";
  if (!/\.pdf$/i.test(base)) base += ".pdf";

  return {
    ascii: base.replace(/[^\x20-\x7E]/g, "_"),
    encoded: encodeURIComponent(base).replace(
      /['()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    ),
  };
};
