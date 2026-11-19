import { safeExecute } from "../../../../db/config.js";
import { NotFoundError } from "../../../utils/errors/index.js";

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
    ORDER BY a.created_at ASC
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
