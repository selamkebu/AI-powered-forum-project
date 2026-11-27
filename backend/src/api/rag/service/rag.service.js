import { PDFParse } from "pdf-parse";

export const extractPdfText = async (buffer) => {
  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText();

    const text = result.text.trim();

    if (!text) {
      throw Object.assign(
        new Error("No readable text found in the PDF"),
        { statusCode: 422 }
      );
    }

    return {
      text,
      pageCount: result.total,
      characterCount: text.length,
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    throw Object.assign(
      new Error("Unable to extract text from the PDF"),
      { statusCode: 422 }
    );
  } finally {
    await parser.destroy();
  }
};