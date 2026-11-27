import { safeExecute } from "../../../../db/config.js";
import { NotFoundError } from "../../../utils/errors/index.js";


/**
 * 
  * Retrieves document metadata from the database using the document ID.
 * Joins the documents table with the users table to verify the document-user relationship.
 * Throws a NotFoundError if the document does not exist.
 *
 * @param {number} documentId - The unique ID of the uploaded document.
 * @returns {Promise<object>} A promise containing the document metadata.
 */

export const getDocumentMetaService= async (doumentId) => {
  const documentSql = `
    SELECT 
        d.document_id,         
        d.title,
        d.mime_type,        
        d.byte_size,
        d.status,
        d.error_message,
        d.created_at,
        d.updated_at,
        d.user_id,
        d.storage_path       
    FROM documents d
    INNER JOIN users u ON d.user_id = u.user_id
    WHERE d.document_id = ?
    LIMIT 1`;

  const documentRows = await safeExecute(documentSql, [doumentId]);

  if (documentRows.length === 0) {
    throw new NotFoundError("Documents not found");
  }

  const document =documentRows[0];  
  return{
    data:{
    id: document.doumentId,
    title: document.title,
    mime_type: document.mime_type,
    byte_size: document.byte_size,
    status: document.status,
    error_message: document.error_message,
    created_at: document.created_at,
    updated_at: document.updated_at,
    user_id: document.user_id,
    storage_path: document.storage_path
    }
  }
};
