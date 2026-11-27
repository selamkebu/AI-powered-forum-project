import { StatusCodes } from "http-status-codes";
import { BadRequestError } from "../../../utils/errors/index.js";
import { createDocumentFromUploadService } from "../service/rag.service.js";

export const createDocumentController = async (req, res) => {
  // uploadSinglePdf from rag.upload.config.js puts the file's details on req.file: path, filename, size, mimetype and originalname.

  if (!req.file) {
    throw new BadRequestError(
      'A PDF file is required in the "file" form field',
    );
  }

  const document = await createDocumentFromUploadService(req.user.id, req.file);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message:
      document.status === "ready"
        ? "Document uploaded and processed."
        : "Document uploaded, but processing failed.",
    data: document,
  });
};
