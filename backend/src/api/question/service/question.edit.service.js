import { safeExecute } from "../../../../db/config.js";
import { NotFoundError } from "../../../utils/errors/index.js";
import { StatusCodes } from "http-status-codes";
import { saveQuestionEmbedding } from "./vector.service.js";

export const updateQuestionService = async ({
  questionHash,
  userId,
  userRole,
  title,
  content,
}) => {
  const questionRows = await safeExecute(
    `SELECT question_id, user_id FROM questions WHERE question_hash = ? LIMIT 1`,
    [questionHash],
  );

  if (questionRows.length === 0) {
    throw new NotFoundError("Question not found");
  }

  const questionId = questionRows[0].question_id;
  const questionOwnerId = questionRows[0].user_id;

  const isOwner = Number(questionOwnerId) === Number(userId);
  const isAdmin = userRole && userRole.trim() === "admin";

  if (!isOwner && !isAdmin) {
    const error = new Error("You are not authorized to edit this question");
    error.statusCode = StatusCodes.FORBIDDEN;
    throw error;
  }

  await safeExecute(
    `UPDATE questions SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE question_id = ?`,
    [title, content, questionId],
  );

  // Sync AI vector for semantic search
  try {
    await saveQuestionEmbedding(questionId, title);
  } catch (error) {
    console.error(`Failed to update vector for question ${questionId}:`, error);
  }

  const updatedRows = await safeExecute(
    `SELECT
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
     WHERE q.question_id = ?
     LIMIT 1`,
    [questionId],
  );

  const question = updatedRows[0];

  return {
    id: question.id,
    questionHash: question.questionHash,
    title: question.title,
    content: question.content,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    author: {
      id: question.authorId,
      firstName: question.authorFirstName,
      lastName: question.authorLastName,
    },
  };
};
