import { randomBytes } from "node:crypto";
import { safeExecute } from "../../../../db/config.js";
import { NotFoundError } from "../../../utils/errors/index.js";

import {
  generateEmbedding,
  parseEmbedding,
  cosineSimilarity,
  saveQuestionEmbedding,
} from "./vector.service.js";

const ANSWERS_LIMIT = 100;
const QUESTIONS_LIMIT = 100;

const escapeLike = (value) => value.replace(/[\\%_]/g, (ch) => `\\${ch}`);

// ======================================================
// 1. GET ALL QUESTIONS
// ======================================================

export const getQuestionsService = async ({
  userId,
  search = "",
  mine = false,
}) => {
  const where = [];
  const params = [];

  if (mine) {
    where.push("q.user_id = ?");
    params.push(userId);
  }

  const keyword = search.trim();

  if (keyword) {
    const pattern = `%${escapeLike(keyword)}%`;
    where.push("(q.title LIKE ? OR q.content LIKE ?)");
    params.push(pattern, pattern);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await safeExecute(
    `SELECT q.question_id, q.question_hash, q.title, q.content,
            q.created_at, q.updated_at,
            u.user_id, u.first_name, u.last_name,
            COUNT(a.answer_id) AS answer_count
     FROM questions q
     JOIN users u ON u.user_id = q.user_id
     LEFT JOIN answers a ON a.question_id = q.question_id
     ${whereSql}
     GROUP BY q.question_id, u.user_id
     ORDER BY q.created_at DESC, q.question_id DESC
     LIMIT ${QUESTIONS_LIMIT}`,
    params,
  );

  const questions = rows.map((r) => ({
    id: r.question_id,
    questionHash: r.question_hash,
    title: r.title,
    content: r.content,
    answerCount: Number(r.answer_count),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    author: {
      id: r.user_id,
      firstName: r.first_name,
      lastName: r.last_name,
    },
  }));

  return {
    questions,
    meta: {
      limit: QUESTIONS_LIMIT,
      total: questions.length,
      sortBy: "newest",
      sortOrder: "desc",
    },
  };
};

// ======================================================
// 2. GET SINGLE QUESTION
// ======================================================

export const getSingleQuestionService = async (questionHash) => {
  const questionSql = `
    SELECT
      q.question_id AS id,
      q.question_hash AS questionHash,
      q.title,
      q.content,
      q.created_at AS createdAt,
      q.updated_at AS updatedAt,
      u.user_id AS authorId,
      u.first_name AS authorFirstName,
      u.last_name AS authorLastName
    FROM questions q
    INNER JOIN users u ON q.user_id = u.user_id
    WHERE q.question_hash = ?
    LIMIT 1
  `;

  const questionRows = await safeExecute(questionSql, [questionHash]);

  if (questionRows.length === 0) {
    throw new NotFoundError("Question not found");
  }

  const question = questionRows[0];

  const answersSql = `
    SELECT
      a.answer_id AS id,
      a.content,
      a.created_at AS createdAt,
      a.updated_at AS updatedAt,
      u.user_id AS authorId,
      u.first_name AS authorFirstName,
      u.last_name AS authorLastName
    FROM answers a
    INNER JOIN users u ON a.user_id = u.user_id
    WHERE a.question_id = ?
    ORDER BY a.created_at ASC
    LIMIT ${ANSWERS_LIMIT}
  `;

  const answersRows = await safeExecute(answersSql, [question.id]);

  const countSql = `
    SELECT COUNT(*) AS total
    FROM answers
    WHERE question_id = ?
  `;

  const countRows = await safeExecute(countSql, [question.id]);
  const answerCount = Number(countRows[0]?.total ?? 0);

  return {
    question: {
      id: question.id,
      questionHash: question.questionHash,
      title: question.title,
      content: question.content,
      answerCount,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      author: {
        id: question.authorId,
        firstName: question.authorFirstName,
        lastName: question.authorLastName,
      },
    },

    answers: answersRows.map((a) => ({
      id: a.id,
      content: a.content,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      author: {
        id: a.authorId,
        firstName: a.authorFirstName,
        lastName: a.authorLastName,
      },
    })),

    answersMeta: {
      limit: ANSWERS_LIMIT,
      total: answerCount,
    },
  };
};

// ======================================================
// 3. HELPER: RESOLVE K
// ======================================================

/**
 * Default: 5
 * Minimum: 1
 * Maximum: 20
 */
const resolveK = (val) => {
  const parsed = Number(val);

  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 20) {
    return parsed;
  }

  const envVal = Number(process.env.RECOMMEND_K);

  if (Number.isInteger(envVal) && envVal >= 1 && envVal <= 20) {
    return envVal;
  }

  return 5;
};

// ======================================================
// 4. HELPER: RESOLVE THRESHOLD
// ======================================================

/**
 * Default: 0.75
 * Range: 0 to 1
 */
const resolveThreshold = (val) => {
  if (val !== undefined && val !== null && val !== "") {
    const parsed = Number(val);

    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
  }

  const envRaw = process.env.RECOMMEND_THRESHOLD;

  if (envRaw !== undefined && envRaw !== null && String(envRaw).trim() !== "") {
    const envParsed = Number(envRaw);

    if (!Number.isNaN(envParsed) && envParsed >= 0 && envParsed <= 1) {
      return envParsed;
    }
  }

  return 0.75;
};

// ======================================================
// 5. GET SIMILAR QUESTIONS
// ======================================================

export const getSimilarQuestionsService = async ({
  questionHash,
  k,
  threshold,
}) => {
  const effectiveK = resolveK(k);
  const effectiveThreshold = resolveThreshold(threshold);

  const sourceRows = await safeExecute(
    `SELECT q.question_id, qv.embedding
     FROM questions q
     INNER JOIN question_vectors qv
       ON q.question_id = qv.question_id
     WHERE q.question_hash = ? AND qv.status = 'ready'
     LIMIT 1`,
    [questionHash],
  );

  if (sourceRows.length === 0) {
    throw new NotFoundError("Question or its ready embedding was not found");
  }

  const sourceEmbedding = parseEmbedding(sourceRows[0].embedding);

  if (!sourceEmbedding) {
    throw new NotFoundError("Question embedding is invalid");
  }

  const vectorRows = await safeExecute(
    `SELECT question_id, embedding
     FROM question_vectors
     WHERE question_id != ? AND status = 'ready'`,
    [sourceRows[0].question_id],
  );

  const similarQuestions = vectorRows
    .map((row) => {
      const embedding = parseEmbedding(row.embedding);

      if (!embedding) return null;

      return {
        id: row.question_id,
        score: cosineSimilarity(sourceEmbedding, embedding),
      };
    })
    .filter(
      (question) => question !== null && question.score >= effectiveThreshold,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, effectiveK);

  if (similarQuestions.length === 0) {
    return {
      data: [],
      meta: {
        total: 0,
        k: effectiveK,
        threshold: effectiveThreshold,
        query: null,
        questionHash,
      },
    };
  }

  const questionIds = similarQuestions.map((question) => question.id);

  const placeholders = questionIds.map(() => "?").join(", ");

  const detailRows = await safeExecute(
    `SELECT
       q.question_id AS id,
       q.question_hash AS questionHash,
       q.title,
       q.content,
       q.created_at AS createdAt,
       q.updated_at AS updatedAt,
       u.user_id AS authorId,
       u.first_name AS firstName,
       u.last_name AS lastName,
       (SELECT COUNT(*)
        FROM answers a
        WHERE a.question_id = q.question_id) AS answerCount
     FROM questions q
     INNER JOIN users u ON q.user_id = u.user_id
     WHERE q.question_id IN (${placeholders})`,
    questionIds,
  );

  const detailsMap = new Map(detailRows.map((row) => [row.id, row]));

  const data = similarQuestions
    .map((similarQuestion) => {
      const question = detailsMap.get(similarQuestion.id);

      if (!question) return null;

      return {
        id: question.id,
        questionHash: question.questionHash,
        title: question.title,
        content: question.content,
        answerCount: Number(question.answerCount),
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
        author: {
          id: question.authorId,
          firstName: question.firstName,
          lastName: question.lastName,
        },
        score: similarQuestion.score,
      };
    })
    .filter(Boolean);

  return {
    data,
    meta: {
      total: data.length,
      k: effectiveK,
      threshold: effectiveThreshold,
      query: null,
      questionHash,
    },
  };
};

// ======================================================
// 6. SEMANTIC SEARCH QUESTIONS
// ======================================================

/**
 * T-11: Semantic Search Questions
 * GET /api/questions/search
 */
export const searchQuestionsSemanticService = async ({
  query,
  k,
  threshold,
}) => {
  const effectiveK = resolveK(k);
  const effectiveThreshold = resolveThreshold(threshold);

  // Step 1: Generate query embedding.
  const queryVector = await generateEmbedding(query, "RETRIEVAL_QUERY");

  // Step 2: Get all ready question embeddings.
  const vectorRows = await safeExecute(
    `SELECT question_id, embedding
     FROM question_vectors
     WHERE status = 'ready'`,
    [],
  );

  if (!vectorRows || vectorRows.length === 0) {
    return {
      data: [],
      meta: {
        total: 0,
        k: effectiveK,
        threshold: effectiveThreshold,
        query,
        questionHash: null,
      },
    };
  }

  // Step 3: Calculate cosine similarity.
  const scored = [];

  for (const row of vectorRows) {
    const vector = parseEmbedding(row.embedding);

    if (!vector) continue;

    const score = cosineSimilarity(queryVector, vector);

    if (score >= effectiveThreshold) {
      scored.push({
        questionId: row.question_id,
        score: Number(score.toFixed(6)),
      });
    }
  }

  // Step 4: Sort and select top K results.
  scored.sort((a, b) => b.score - a.score);

  const topMatches = scored.slice(0, effectiveK);

  if (topMatches.length === 0) {
    return {
      data: [],
      meta: {
        total: 0,
        k: effectiveK,
        threshold: effectiveThreshold,
        query,
        questionHash: null,
      },
    };
  }

  // Step 5: Fetch question details.
  const questionIds = topMatches.map((match) => match.questionId);

  const placeholders = questionIds.map(() => "?").join(", ");

  const detailRows = await safeExecute(
    `SELECT
       q.question_id AS id,
       q.question_hash AS questionHash,
       q.title,
       q.content,
       q.created_at AS createdAt,
       q.updated_at AS updatedAt,
       u.user_id AS authorId,
       u.first_name AS firstName,
       u.last_name AS lastName,
       (SELECT COUNT(*)
        FROM answers a
        WHERE a.question_id = q.question_id) AS answerCount
     FROM questions q
     INNER JOIN users u ON q.user_id = u.user_id
     WHERE q.question_id IN (${placeholders})`,
    questionIds,
  );

  const detailsMap = new Map(detailRows.map((row) => [row.id, row]));

  const data = topMatches
    .map((match) => {
      const question = detailsMap.get(match.questionId);

      if (!question) return null;

      return {
        id: question.id,
        questionHash: question.questionHash,
        title: question.title,
        content: question.content,
        answerCount: Number(question.answerCount),
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
        author: {
          id: question.authorId,
          firstName: question.firstName,
          lastName: question.lastName,
        },
        score: match.score,
      };
    })
    .filter(Boolean);

  return {
    data,
    meta: {
      total: data.length,
      k: effectiveK,
      threshold: effectiveThreshold,
      query,
      questionHash: null,
    },
  };
};

// ======================================================
// 7. CREATE QUESTION WITH VECTOR EMBEDDING
// ======================================================

/**
 * T-09: Create Question API
 *
 * Creates a question and generates its Gemini embedding.
 * If Gemini fails, the question is still created.
 */
export const createQuestionWithVectorService = async ({
  userId,
  title,
  content,
}) => {
  // Step 1: Generate a random 16-character question hash.
  const questionHash = randomBytes(8).toString("hex");

  // Step 2: Insert the question into MySQL.
  const sql = `
    INSERT INTO questions
      (question_hash, user_id, title, content)
    VALUES (?, ?, ?, ?)
  `;

  const result = await safeExecute(sql, [questionHash, userId, title, content]);

  // Step 3: Get the new question ID.
  const questionId = result.insertId;

  // Step 4: Generate and save the question embedding.
  try {
    await saveQuestionEmbedding(questionId, title);
  } catch (error) {
    console.error(
      `Failed to persist vector for question ${questionId}:`,
      error,
    );
  }

  // Step 5: Return the created question.
  return {
    id: questionId,
    questionHash,
    title,
    content,
    userId,
  };
};
