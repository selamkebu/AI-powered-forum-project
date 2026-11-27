import { PDFParse } from "pdf-parse";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, safeExecute } from "../../../../db/config.js";
import { BadRequestError, NotFoundError } from "../../../utils/errors/index.js";
import { embedTexts } from "./ragGemini.service.js";
import { UPLOAD_ROOT } from "../validations/rag.upload.config.js";


/**
 * Reads a positive integer from an environment variable.
 *
 * Returns `fallback` if the variable is missing, not a number, zero or negative.
 *
 * @param {string} name - Environment variable name, e.g. "RAG_CHUNK_SIZE".
 * @param {number} fallback - Value to use when the variable is unset or invalid.
 * @returns {number} The parsed value, or `fallback`.
 */
const intFromEnv = (name, fallback) => {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

/**
 * Returns the RAG upload and chunking settings, each read from an environment
 * variable with a default if it's unset or invalid (see intFromEnv).
 *
 * Read on each call instead of at import time, so it works regardless of
 * when dotenv loads.
 *
 * @returns {{
 *
 *   chunkSize: number,
 *   chunkOverlap: number,
 *   maxChunksPerDoc: number,
 *   maxPdfsPerUser: number,
 *   minTextChars: number
 * }}
 */
const getRagConfig = () => ({
  chunkSize: intFromEnv("RAG_CHUNK_CHARS", 900), // target characters per chunk
  chunkOverlap: intFromEnv("RAG_CHUNK_OVERLAP", 120), // characters shared between neighbouring chunks
  maxChunksPerDoc: intFromEnv("RAG_MAX_CHUNKS_PER_DOC", 1000), // larger documents are rejected
  maxPdfsPerUser: intFromEnv("RAG_MAX_PDFS_PER_USER", 4), // failed uploads don't count
  minTextChars: intFromEnv("RAG_MIN_TEXT_CHARS", 50), // fewer than this usually means a scanned PDF
});

/**
 * Counts a user's documents, excluding failed uploads.
 *
 * Failed uploads are not counted so a user is never locked out of uploading
 * by attempts that didn't work.
 *
 * @param {number|string} userId
 * @returns {Promise<number>} Number of documents whose status is not 'failed'.
 */
const countDocumentsForUser = async (userId) => {
  const rows = await safeExecute(
    `SELECT COUNT(*) AS total FROM documents
     WHERE user_id = ? AND status <> 'failed'`,
    [userId],
  );
  // COUNT(*) can come back as a string or BigInt from the MySQL driver, so convert it.
  return Number(rows[0].total);
};

/**
 * Cleans raw extracted text (e.g. from a PDF) before it is chunked and embedded.
 *
 * - Removes null characters.
 * - Converts Windows/old-Mac line endings (\r\n, \r) to \n.
 * - Collapses runs of spaces and tabs into one space.
 * - Collapses 3+ newlines into a single blank line.
 * - Trims leading and trailing whitespace.
 *
 * @param {string} text - Raw extracted text.
 * @returns {string} The cleaned text.
 */
const normalizeText = (text) =>
  text
    .replace(/\u0000/g, "") // NUL characters can be left behind by PDF extraction and cause trouble when stored
    .replace(/\r\n?/g, "\n") // do this before the newline rules below so they only deal with \n
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n") // keep paragraph breaks, drop the extra empty lines
    .trim();

/**
 * Extracts and cleans the text of every page of a PDF.
 *
 * Pages are kept separate, with their page numbers, so chunks can later be
 * traced back to the page they came from. Pages with no extractable text
 * (e.g. scanned images) come back with an empty string and are not removed.
 *
 * @param {Buffer} buffer - The raw PDF file.
 * @returns {Promise<{ num: number, text: string }[]>} One entry per page, in page order.
 *
 * @example
 * [
 *  { num: 1, text: "React is a library..." },
 *  { num: 2, text: "Components let you..." },
 *  { num: 3, text: "" }, // no extractable text
 * ]
 */
const extractPages = async (buffer) => {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.pages.map((p) => ({
      num: p.num,
      text: normalizeText(p.text),
    }));
  } finally {
    // Runs on success and on error, so the parser is always released.
    await parser.destroy();
  }
};

/**
 * Splits page text into overlapping chunks for embedding, and records which
 * pages each chunk came from.
 *
 * Chunks are about `chunkSize` characters long. Each one ends at the best
 * natural break available, in this order of preference: paragraph, sentence,
 * line, then space. If none is found, it cuts at `chunkSize`. Each chunk
 * starts `overlap` characters before the previous one ended, so text near
 * a boundary appears in both chunks.
 *
 * @param {{ num: number, text: string }[]} pages - Output of extractPages. Empty pages are skipped.
 * @param {number} chunkSize - Target chunk length in characters.
 * @param {number} chunkOverlap - Characters shared between neighbouring chunks. Capped at a quarter of chunkSize.
 * @returns {{ content: string, pageStart: number, pageEnd: number }[]} Chunks in document order.
 */
const chunkPages = (pages, chunkSize, chunkOverlap) => {
  // Cap the overlap so each step forward is always positive. This only matters
  // if a misconfigured value is passed in, so it works as a safety guard against an endless loop.
  const overlap = Math.min(chunkOverlap, Math.floor(chunkSize / 4));

  // Step 1: join the pages into one string, so chunks can span page boundaries.
  let fullText = "";
  const ranges = []; // where each page starts in fullText
  for (const page of pages) {
    if (!page.text) continue;
    if (fullText) fullText += "\n\n";
    ranges.push({ num: page.num, start: fullText.length });
    fullText += page.text;
  }

  // Returns the page number that contains the given position in fullText.
  const pageAt = (offset) => {
    let found = ranges[0]?.num ?? null;
    for (const r of ranges) {
      if (r.start <= offset) found = r.num;
      else break;
    }
    return found;
  };

  // Step 2: cut the joined text into chunks.
  const chunks = [];
  // Ignore breaks in the first half of the window, so we never produce a tiny chunk.
  const minBreak = Math.floor(chunkSize * 0.5);
  let start = 0;

  while (start < fullText.length) {
    let end = Math.min(start + chunkSize, fullText.length);

    // Not the last chunk: pull `end` back to the last good break in the window.
    if (end < fullText.length) {
      const windowText = fullText.slice(start, end);
      for (const sep of ["\n\n", ". ", "\n", " "]) {
        const idx = windowText.lastIndexOf(sep);
        if (idx > minBreak) {
          end = start + idx + sep.length;
          break;
        }
      }
    }

    // Step 3: label the chunk with the pages it starts and ends on.
    const content = fullText.slice(start, end).trim();
    if (content) {
      chunks.push({
        content,
        pageStart: pageAt(start),
        pageEnd: pageAt(end - 1),
      });
    }

    if (end >= fullText.length) break;
    start = end - overlap; // step back so the next chunk overlaps this one
  }
  return chunks;
};

/**
 * Saves a document's chunks and their embeddings in one transaction.
 *
 * Either every chunk and vector is stored, or none are. If any insert fails,
 * everything is rolled back so a document is never left half-saved.
 *
 * `embeddings[i]` must be the vector for `chunks[i]`: they are matched by position.
 *
 * @param {number} documentId - The document the chunks belong to.
 * @param {{ content: string, pageStart: number, pageEnd: number }[]} chunks - Output of chunkPages.
 * @param {number[][]} embeddings - One vector per chunk, in the same order as `chunks`.
 * @returns {Promise<void>}
 * @throws Rethrows the original database error after rolling back.
 */
const storeChunksAndVectors = async (documentId, chunks, embeddings) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const [chunkResult] = await conn.execute(
        `INSERT INTO document_chunks (document_id, chunk_index, content, page_start, page_end)
         VALUES (?, ?, ?, ?, ?)`,
        [documentId, i, c.content, c.pageStart, c.pageEnd],
      );
      // The vector row needs the id MySQL just generated for the chunk.
      await conn.execute(
        `INSERT INTO document_chunk_vectors (chunk_id, source_text, embedding, status)
         VALUES (?, ?, ?, 'ready')`,
        [chunkResult.insertId, c.content, JSON.stringify(embeddings[i])],
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err; // let the caller decide how to handle and report the failure
  } finally {
    // Always return the connection to the pool, on success or failure.
    conn.release();
  }
};

/**
 * Turns an uploaded PDF into searchable data: validates it, extracts the text,
 * splits it into chunks, embeds each chunk and stores everything.
 *
 * All the cheap checks run first, so a bad file is rejected before any
 * Gemini calls are made.
 *
 * @param {number} documentId - The document record the chunks will belong to.
 * @param {{ path: string }} file - The uploaded file (its `path` on disk).
 * @param {{ minTextChars: number, chunkSize: number, chunkOverlap: number, maxChunksPerDoc: number }} cfg - Limits and chunking settings.
 * @returns {Promise<void>}
 * @throws {BadRequestError} If the file isn't a PDF, has too little text (e.g. a scan), or would create too many chunks.
 * @throws {ServiceUnavailableError} If embedding fails.
 */
const processDocument = async (documentId, file, cfg) => {
  const buffer = await fs.readFile(file.path);

  // The mimetype comes from the client and can be faked, so also check the PDF magic bytes.
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new BadRequestError("Uploaded file is not a valid PDF");
  }

  const pages = await extractPages(buffer);

  const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
  if (totalChars < cfg.minTextChars) {
    throw new BadRequestError(
      `Not enough readable text in this PDF (found ${totalChars} characters, need at least ${cfg.minTextChars}). It may be a scanned document.`,
    );
  }

  const chunks = chunkPages(pages, cfg.chunkSize, cfg.chunkOverlap);
  if (chunks.length === 0) {
    throw new BadRequestError("No readable text found in this PDF");
  }
  // Checked before embedding, so we don't waste Gemini calls on oversized documents.
  if (chunks.length > cfg.maxChunksPerDoc) {
    throw new BadRequestError(
      `Document is too large: it would create ${chunks.length} chunks (maximum ${cfg.maxChunksPerDoc})`,
    );
  }

  const embeddings = await embedTexts(chunks.map((c) => c.content));
  await storeChunksAndVectors(documentId, chunks, embeddings);
};

/**
 * Handles a PDF upload end to end: enforces the per-user limit, creates the
 * document record, processes the file and records the outcome.
 *
 * Status flow: 'processing' -> 'ready' or 'failed'.
 *
 * A failure while processing does NOT throw. The document is marked 'failed'
 * with the error message, its file is deleted, and the row is returned so the
 * caller can show the user what went wrong.
 *
 * @param {number} userId - The user who uploaded the file.
 * @param {{ path: string, originalname: string, mimetype: string, size: number }} file - The file saved by multer.
 * @returns {Promise<object>} The document row, with status 'ready' or 'failed'.
 * @throws {BadRequestError} If the user is already at their PDF limit.
 */
export const createDocumentFromUploadService = async (userId, file) => {
  const cfg = getRagConfig();

  // Multer already saved the file, so remove it if we reject the upload.
  if ((await countDocumentsForUser(userId)) >= cfg.maxPdfsPerUser) {
    await fs.unlink(file.path).catch(() => {});
    throw new BadRequestError(
      `You can upload at most ${cfg.maxPdfsPerUser} PDFs. Delete one to add another.`,
    );
  }

  // Multer reads filenames as latin1; convert back so non-English names survive.
  const title = Buffer.from(file.originalname, "latin1")
    .toString("utf8")
    .slice(0, 512);
  // Stored relative to UPLOAD_ROOT with forward slashes, so it doesn't depend on the OS.
  const storagePath = path
    .relative(UPLOAD_ROOT, file.path)
    .split(path.sep)
    .join("/");

  const insertResult = await safeExecute(
    `INSERT INTO documents (user_id, title, mime_type, storage_path, byte_size, status)
     VALUES (?, ?, ?, ?, ?, 'processing')`,
    [userId, title, file.mimetype, storagePath, file.size],
  );
  const documentId = insertResult.insertId;

  try {
    await processDocument(documentId, file, cfg);
    await safeExecute(
      `UPDATE documents SET status = 'ready', error_message = NULL WHERE document_id = ?`,
      [documentId],
    );
  } catch (err) {
    // Not rethrown on purpose: the failure is saved on the document instead.
    await safeExecute(
      `UPDATE documents SET status = 'failed', error_message = ? WHERE document_id = ?`,
      [String(err.message).slice(0, 1000), documentId], // truncated to keep the stored message short
    );
    // A failed document has no use for its file, so don't leave it on disk.
    await fs.unlink(file.path).catch(() => {});
  }

  const rows = await safeExecute(
    "SELECT * FROM documents WHERE document_id = ?",
    [documentId],
  );
  return rows[0];
};




/**
 * Absolute folder where uploaded PDFs live (RAG_UPLOAD_DIR, default uploads/rag).
 * Read at call time so it always reflects the loaded .env.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, "../../../../");
export const getUploadRoot = () =>
  path.resolve(BACKEND_ROOT, process.env.RAG_UPLOAD_DIR || "uploads/rag");

/**
 * Loads a document only if it belongs to the given user.
 * Returns 404 for "does not exist" AND "belongs to someone else", so ids can't be probed.
 *
 * @param {number} userId
 * @param {number} documentId
 * @returns {Promise<object>} the `documents` row
 */
export const assertOwnedDocument = async (userId, documentId) => {
  const rows = await safeExecute(
    `SELECT document_id, user_id, title, mime_type, storage_path, byte_size,
            status, error_message, created_at, updated_at
       FROM documents
      WHERE document_id = ? AND user_id = ?
      LIMIT 1`,
    [documentId, userId],
  );

  if (rows.length === 0) {
    throw new NotFoundError("Document not found.");
  }
  return rows[0];
};

/**
 * Turns the stored (relative) path, e.g. "1/1234-abc.pdf", into a safe location
 * inside the upload folder. Anything that would escape the folder (../, absolute
 * paths elsewhere) is treated as "not found".
 *
 * @param {string} storagePath value of documents.storage_path
 * @returns {{ absolutePath: string, relativePath: string }}
 */
export const resolveDocumentFilePath = (storagePath) => {
  const root = getUploadRoot();
  const absolutePath = path.resolve(root, String(storagePath ?? ""));
  const relativePath = path.relative(root, absolutePath);

  if (
    !storagePath ||
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new NotFoundError("PDF file not found.");
  }

  return { absolutePath, relativePath };
};

/**
 * Builds a safe download name from the document title, always ending in .pdf.
 * Returns an ASCII fallback plus a UTF-8 encoded version for non-English titles.
 *
 * @param {string} title
 * @returns {{ ascii: string, encoded: string }}
 */
export const buildPdfFileName = (title) => {
  let base = String(title ?? "")
    .replace(/[\r\n"\\/]+/g, "_")
    .trim();
  if (!base) base = "document";
  if (!/\.pdf$/i.test(base)) base += ".pdf";

  return {
    ascii: base.replace(/[^\x20-\x7E]/g, "_"),
    encoded: encodeURIComponent(base).replace(
      /['()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    ),
  };
};

/**
 * Deletes a document (PDF file + DB row) that belongs to the given user.
 * Related chunks and vectors are deleted through CASCADE.
 *
 * @param {number} documentId
 * @param {number} userId
 * @returns {Promise<{ id: number }>}
 */
export const deleteDocumentService = async (documentId, userId) => {
  // 1. Find the document and verify ownership
  const documents = await safeExecute(
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
  const uploadDirectory = getUploadRoot();

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
  await safeExecute(
    `DELETE FROM documents
     WHERE document_id = ? AND user_id = ?`,
    [documentId, userId],
  );

  // 8. Return the deleted document ID
  return {
    id: documentId,
  };
};

