import { deleteDocumentService } from "../service/rag.service.js";

export const deleteDocumentController = async (req, res, next) => {
  try {
    // Get document ID from URL
    const documentId = req.params.documentId;

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
