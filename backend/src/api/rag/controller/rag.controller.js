import { StatusCodes } from "http-status-codes";
import { getDocumentMetaService } from "../service/rag.service.js";


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