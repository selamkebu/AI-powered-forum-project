import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { safeExecute } from "../../../../db/config.js";
import { NotFoundError, BadRequestError } from "../../../utils/errors/index.js";

/**
 * Absolute folder where uploaded PDFs live (RAG_UPLOAD_DIR, default uploads/rag).
 * Read at call time so it always reflects the loaded .env.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, "../../../../");
export const getUploadRoot = () =>
  path.resolve(BACKEND_ROOT, process.env.RAG_UPLOAD_DIR || "uploads/rag");

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

/**
 * Deletes a document (PDF file + DB row) that belongs to the given user.
 * Related chunks and vectors are deleted through CASCADE.
 *
 * @param {number} documentId
 * @param {number} userId
 * @returns {Promise<{ id: number }>}
 */
export const deleteDocumentService = async (documentId, userId) => {
  // 1. Find the document and verify ownership
  const documents = await safeExecute(
    `SELECT document_id, storage_path
     FROM documents
     WHERE document_id = ? AND user_id = ?`,
    [documentId, userId],
  );

  // 2. Return 404 if the document doesn't exist
  // or doesn't belong to the authenticated user
  if (documents.length === 0) {
    throw new NotFoundError("Document not found");
  }

  const document = documents[0];

  // 3. Resolve the PDF storage directory
  const uploadDirectory = getUploadRoot();

  // 4. Resolve the actual PDF file path
  const filePath = path.isAbsolute(document.storage_path)
    ? path.resolve(document.storage_path)
    : path.resolve(uploadDirectory, document.storage_path);

  // 5. Ensure the file is inside the configured upload directory
  // This prevents deleting files outside the PDF storage directory.
  const relativePath = path.relative(uploadDirectory, filePath);

  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new BadRequestError("Invalid document storage path");
  }

  // 6. Delete the PDF from disk
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // If the file is already missing, continue with DB deletion
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  // 7. Delete the document record from MySQL
  await safeExecute(
    `DELETE FROM documents
     WHERE document_id = ? AND user_id = ?`,
    [documentId, userId],
  );

  // 8. Return the deleted document ID
  return {
    id: documentId,
  };
};
