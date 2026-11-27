import { StatusCodes } from "http-status-codes";
import { extractPdfText } from "../service/rag.service.js";

export const createDocumentController = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.id;

    const extracted = await extractPdfText(
      req.file.buffer
    );

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "PDF uploaded and parsed successfully",
      data: {
        userId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        pageCount: extracted.pageCount,
        characterCount: extracted.characterCount,
      },
    });
  } catch (error) {
    next(error);
  }
};