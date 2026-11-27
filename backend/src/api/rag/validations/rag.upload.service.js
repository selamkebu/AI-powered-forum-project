import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 5,
    parts: 6,
  },

  fileFilter: (req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" &&
      file.originalname.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return cb(
        Object.assign(new Error("Only PDF files are allowed"), {
          statusCode: 415,
        })
      );
    }

    cb(null, true);
  },
});

export const uploadSinglePdf = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      error.statusCode =
        error.code === "LIMIT_FILE_SIZE" ? 413 : 400;

      return next(error);
    }

    if (error) return next(error);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "A PDF file is required",
      });
    }

    const signature = req.file.buffer
      .subarray(0, 5)
      .toString();

    if (signature !== "%PDF-") {
      return res.status(415).json({
        success: false,
        message: "Invalid PDF file",
      });
    }

    next();
  });
};