import { createAnswerService } from "../service/answer.service.js";

export const createAnswerController = async (req, res, next) => {
  try {
    const { questionId, content } = req.body;
    const userId = req.user.id; // Provided by your authenticateUser middleware

    // Call the service to handle the logic
    const newAnswer = await createAnswerService(questionId, userId, content);

    res.status(201).json({
      success: true,
      message: "Answer posted successfully",
      data: newAnswer,
    });
  } catch (error) {
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
