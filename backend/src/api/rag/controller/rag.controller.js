import { StatusCodes } from "http-status-codes";
import { getDocumentMetaService } from "../service/rag.service.js";

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

    console.log(result);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Document metadata fetched successfully",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};