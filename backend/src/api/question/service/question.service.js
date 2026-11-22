import { randomBytes } from "node:crypto";
import { safeExecute } from "../../../../db/config.js";
import { NotFoundError } from "../../../utils/errors/index.js";
import { saveQuestionEmbedding } from "./vector.service.js";


const ANSWERS_LIMIT = 100;
const QUESTIONS_LIMIT = 100;

const escapeLike = (value) => value.replace(/[\\%_]/g, (ch) => `\\${ch}`);

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

  const questionData = questionRows[0];

  const countSql = `
    SELECT COUNT(*) AS total
    FROM answers
    WHERE question_id = ?
  `;

  const countRows = await safeExecute(countSql, [questionData.id]);
  const answerCount = Number(countRows[0].total);

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
    ORDER BY a.created_at DESC
    LIMIT ${ANSWERS_LIMIT}
  `;

  const answerRows = await safeExecute(answersSql, [questionData.id]);

  const question = {
    id: questionData.id,
    questionHash: questionData.questionHash,
    title: questionData.title,
    content: questionData.content,
    answerCount,
    createdAt: questionData.createdAt,
    updatedAt: questionData.updatedAt,
    author: {
      id: questionData.authorId,
      firstName: questionData.authorFirstName,
      lastName: questionData.authorLastName,
    },
  };

  const answers = answerRows.map((answer) => ({
    id: answer.id,
    content: answer.content,
    createdAt: answer.createdAt,
    updatedAt: answer.updatedAt,
    author: {
      id: answer.authorId,
      firstName: answer.authorFirstName,
      lastName: answer.authorLastName,
    },
  }));

  return {
    question,
    answers,
    answersMeta: {
      limit: ANSWERS_LIMIT,
      total: answerCount,
    },
  };
};

//n

// T-11: Find Similar Questions

const parseEmbedding = (embedding) => {
  try {
    const parsed =
      typeof embedding === "string" ? JSON.parse(embedding) : embedding;

    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every((value) => Number.isFinite(Number(value)))
    ) {
      return null;
    }

    return parsed.map(Number);
  } catch {
    return null;
  }
};

const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return -1;

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  if (magnitudeA === 0 || magnitudeB === 0) return -1;

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
};

export const getSimilarQuestionsService = async ({
  questionHash,
  k = Number(process.env.RECOMMEND_K) || 5,
  threshold = Number(process.env.RECOMMEND_THRESHOLD ?? 0.75),
}) => {
  k = Number(k);
  threshold = Number(threshold);

  const sourceRows = await safeExecute(
    `SELECT q.question_id, qv.embedding
     FROM questions q
     INNER JOIN question_vectors qv
       ON q.question_id = qv.question_id
     WHERE q.question_hash = ? AND qv.status = 'ready'
     LIMIT 1`,
    [questionHash]
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
    [sourceRows[0].question_id]
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
      (question) => question !== null && question.score >= threshold
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  if (similarQuestions.length === 0) {
    return {
      data: [],
      meta: { total: 0, k, threshold, query: null, questionHash },
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
    questionIds
  );

  const detailsMap = new Map(
    detailRows.map((row) => [row.id, row])
  );

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
      k,
      threshold,
      query: null,
      questionHash,
    },
  };
};



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
  // Step 1: Generate a random 16-character hash
  const questionHash = randomBytes(8).toString("hex");

  // Step 2: Insert the new question
  const sql = `
    INSERT INTO questions
      (question_hash, user_id, title, content)
    VALUES (?, ?, ?, ?)
  `;

  const result = await safeExecute(sql, [
    questionHash,
    userId,
    title,
    content,
  ]);

  // Step 3: Retrieve the new question ID
  const questionId = result.insertId;


  // Step 4: Generate and save the embedding
  try {
    await saveQuestionEmbedding(questionId, title);
  } catch (error) {
    console.error(
      `Failed to persist vector for question ${questionId}:`,
      error
    );
  }


  // Step 5: Return the created question
  return {
    id: questionId,
    questionHash,
    title,
    content,
    userId,
  };
};
