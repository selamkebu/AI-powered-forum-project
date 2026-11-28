import { db } from '../../../../db/config.js';
import { NotFoundError, ForbiddenError } from '../../../utils/errors/index.js';

export const createAnswerService = async (questionId, userId, content) => {
  // 1. Check if question exists
  const [questionRows] = await db.query(
    'SELECT user_id FROM questions WHERE question_id = ?',
    [questionId]
  );

  if (questionRows.length === 0) {
    const error = new Error('Question not found');
    error.status = 404;
    throw error;
  }

  // 2. Check ownership (Cannot answer own question)
  if (questionRows[0].user_id === userId) {
    const error = new Error('You cannot answer your own question');
    error.status = 400;
    throw error;
  }

  // 3. Insert Answer
  const [insertResult] = await db.query(
    'INSERT INTO answers (question_id, user_id, content) VALUES (?, ?, ?)',
    [questionId, userId, content]
  );

  // 4. Fetch the new answer to return formatted data
  const [newAnswerRows] = await db.query(
    `SELECT
       a.answer_id AS id,
       a.question_id AS questionId,
       a.content,
       a.created_at AS createdAt,
       a.updated_at AS updatedAt,
       u.user_id AS authorId,
       u.first_name AS firstName,
       u.last_name AS lastName
     FROM answers a
     JOIN users u ON a.user_id = u.user_id
     WHERE a.answer_id = ?`,
    [insertResult.insertId]
  );

  const row = newAnswerRows[0];

  return {
    id: row.id,
    questionId: row.questionId,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: {
      id: row.authorId,
      firstName: row.firstName,
      lastName: row.lastName
    }
  };
};

/**
 * Delete an answer if the requester owns it or is an admin.
 */
export const deleteAnswerService = async (answerId, userId, userRole) => {
  const [rows] = await db.query(
    "SELECT answer_id, user_id FROM answers WHERE answer_id = ? LIMIT 1",
    [answerId]
  );

  if (rows.length === 0) {
    throw new NotFoundError("Answer not found");
  }

  const answer = rows[0];

  if (userRole !== "admin" && Number(answer.user_id) !== Number(userId)) {
    throw new ForbiddenError("You are not allowed to delete this answer");
  }

  await db.query(
    "DELETE FROM answers WHERE answer_id = ?",
    [answer.answer_id]
  );

  return { answerId: answer.answer_id };
};
