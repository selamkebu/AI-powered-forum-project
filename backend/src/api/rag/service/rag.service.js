import { db } from "../../../../db/config.js";
import fs from "fs/promises";
import path from "path";

import { NotFoundError, BadRequestError } from "../../../utils/errors/index.js";

export const deleteDocumentService = async (documentId, userId) => {
  // 1. Find the document and verify ownership
  const [documents] = await db.query(
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
  const uploadDirectory = path.resolve(
    process.cwd(),
    process.env.RAG_UPLOAD_DIR || "uploads/rag",
  );

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
  // Related chunks and vectors are deleted through CASCADE.
  await db.query(
    `DELETE FROM documents
     WHERE document_id = ? AND user_id = ?`,
    [documentId, userId],
  );

  // 8. Return the deleted document ID
  return {
    id: documentId,
  };
};
