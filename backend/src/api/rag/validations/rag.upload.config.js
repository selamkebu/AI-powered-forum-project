/**
 * Upload rules for the RAG PDF endpoint, built on multer. Multer reads the
 * file out of the multipart/form-data request before the controller runs,
 * so the controller can just use `req.file`.
 *
 * Use it as: authenticateUser -> uploadPdf -> controller. authenticateUser
 * must run first because files are saved under the user's id.
 *
 * What it does:
 * 1. Storage: saves each PDF to `<UPLOAD_ROOT>/<userId>/` (by default
 *    `uploads/rag/<userId>/`), one folder per user.
 * 2. Renaming: the saved name is a timestamp plus random hex, like
 *    `1732600000000-a1b2c3d4e5f6.pdf`. Two uploads can't collide, and a
 *    hostile filename like `../../x` can't write outside the folder.
 * 3. Type filter: rejects anything whose mimetype isn't application/pdf
 *    or whose extension isn't .pdf.
 * 4. Size limit: caps the file at RAG_MAX_UPLOAD_MB (default 10) and
 *    allows one file per request.
 * 5. Content check: after saving, confirms the file really starts with the
 *    PDF signature, because the type and name come from the client and can
 *    be faked. Fakes are deleted and rejected with a 400.
 * 6. Error mapping: turns multer's errors into 400 responses. They carry
 *    no status code, so errorHandler would otherwise answer 500.
 */

import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BadRequestError } from "../../../utils/errors/index.js";

// This file lives in backend/src/api/rag/validations/, so going up four
// folders gives the backend root (the folder that contains src/).
// ES modules have no __dirname, so it's rebuilt from import.meta.url (this
// file's URL): fileURLToPath turns it into a path, and path.dirname drops
// the filename.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, "../../../../");

// Size limit from .env (default 10 MB), converted to bytes because that's
// what multer expects: 10 * 1024 * 1024 = 10,485,760.
const MAX_UPLOAD_MB = Number(process.env.RAG_MAX_UPLOAD_MB) || 10;
export const MAX_FILE_SIZE = MAX_UPLOAD_MB * 1024 * 1024;

// Where uploads are stored: <backend>/uploads/rag by default. RAG_UPLOAD_DIR
// can override it (relative to the backend folder, or absolute).
export const UPLOAD_ROOT = path.resolve(
  BACKEND_ROOT,
  process.env.RAG_UPLOAD_DIR || "uploads/rag",
);
const storage = multer.diskStorage({
  // Saves to <UPLOAD_ROOT>/<userId>/. authenticateUser must run before multer so req.user exists.
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_ROOT, String(req.user.id));
    // recursive: also creates uploads/rag if missing, and does nothing if the folder exists.
    // cb gets the error if mkdir failed, or the folder path on success.
    fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
  },
  // Never use the client's filename on disk. A random name means two uploads
  // can't overwrite each other, and a name like ../../app.js can't write
  // outside the folder.
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.pdf`);
  },
});
// First check: what the client claims (mimetype and extension). Both can be
// faked, so uploadPdf also checks the file's contents after it is saved.
const fileFilter = (req, file, cb) => {
  const isPdf =
    file.mimetype === "application/pdf" &&
    path.extname(file.originalname).toLowerCase() === ".pdf";
  if (!isPdf) return cb(new BadRequestError("Only PDF files are allowed"));
  cb(null, true);
};

// Combines the storage rules, the filter and the limits (max size, one file per request).
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

/**
 * Turns multer errors into 400 responses instead of 500s.
 *
 * Multer throws its own MulterError, which has no HTTP status, so the global
 * errorHandler would answer 500 for what is really a user mistake. For a
 * MulterError this picks a readable message from `err.code` (for example
 * LIMIT_FILE_SIZE) and wraps it in a BadRequestError. Any other error, such as
 * the filter's "Only PDF files are allowed" or an auth error, is passed on
 * unchanged.
 *
 * Has four parameters so Express treats it as an error handler. uploadPdf
 * also calls it directly.
 *
 * @param {Error} err
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export const createDocumentMulterErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: "File too large. Maximum size is 10MB",
      LIMIT_FILE_COUNT: "Only one file can be uploaded",
      LIMIT_UNEXPECTED_FILE:
        'Unexpected field. Send the PDF in the "file" field',
    };
    return next(new BadRequestError(messages[err.code] || err.message));
  }
  next(err); // other errors (e.g. the PDF-only filter) pass through untouched
};

// Middleware that expects exactly one file in the form field named "file"
// (the key to use in Postman). On success multer saves it and sets req.file
// (path, filename, size, mimetype, originalname) for the controller and service.
const uploadSingle = upload.single("file");

/**
 * Second check: reads the first 5 bytes of the saved file and confirms they
 * are the PDF signature "%PDF-".
 *
 * @param {string} filePath - Path of the saved file.
 * @returns {Promise<boolean>}
 */
const hasPdfSignature = async (filePath) => {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const { buffer } = await handle.read(Buffer.alloc(5), 0, 5, 0);
    return buffer.toString("latin1") === "%PDF-";
  } finally {
    await handle.close();
  }
};

/**
 * Express middleware: runs multer, then lets only genuine PDFs through.
 * A fake PDF gets a 400 and its saved file is deleted.
 *
 * If the request contains no file at all, it passes through, so the
 * controller must check that `req.file` exists.
 */
export const uploadSinglePdf = (req, res, next) => {
  uploadSingle(req, res, async (err) => {
    if (err) return createDocumentMulterErrorHandler(err, req, res, next);

    try {
      if (req.file && !(await hasPdfSignature(req.file.path))) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return next(new BadRequestError("Uploaded file is not a valid PDF"));
      }
      next();
    } catch (error) {
      next(error);
    }
  });
};
