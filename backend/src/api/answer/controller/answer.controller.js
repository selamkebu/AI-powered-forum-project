import { createAnswerService, deleteAnswerService } from "../service/answer.service.js";
import { BadRequestError } from "../../../utils/errors/index.js";

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


/**
 * DELETE /api/answers/:answerId
 * Allows answer owners and admins to delete answers.
 */
export const deleteAnswerController = async (req, res, next) => {
  try {
    const answerId = Number(req.params.answerId);

    if (!Number.isInteger(answerId) || answerId <= 0) {
      throw new BadRequestError("Invalid answer ID");
    }

    await deleteAnswerService(
      answerId,
      req.user.id,
      req.user.role,
    );

    res.status(200).json({
      success: true,
      message: "Answer deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
