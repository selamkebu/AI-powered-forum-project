import { safeExecute } from "../../../../db/config.js";
import { NotFoundError } from "../../../utils/errors/index.js";

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

  // DEBUG: Look at your terminal to see what is happening!
  console.log("--- PERMISSION CHECK ---");
  console.log(
    "Question Owner ID:",
    questionOwnerId,
    "Type:",
    typeof questionOwnerId,
  );
  console.log("Current User ID:", userId, "Type:", typeof userId);
  console.log("Current User Role:", `"${userRole}"`); // Quotes reveal hidden spaces

  // FIX: Use Number() to ensure type matching
  const isOwner = Number(questionOwnerId) === Number(userId);

  // FIX: Use trim() and check safely
  const isAdmin = userRole && userRole.trim() === "admin";

  if (!isOwner && !isAdmin) {
    const error = new Error("You are not authorized to edit this question");
    error.statusCode = 403;
    throw error;
  }

  await safeExecute(
    `UPDATE questions SET title = ?, content = ? WHERE question_id = ?`,
    [title, content, questionId],
  );

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
