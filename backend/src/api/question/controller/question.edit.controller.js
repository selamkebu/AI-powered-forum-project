import { StatusCodes } from "http-status-codes";
import { updateQuestionService } from "../service/question.edit.service.js";

export const updateQuestionController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role; 

    const updatedQuestion = await updateQuestionService({
      questionHash,
      userId,
      userRole,
      title,
      content,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Question updated successfully",
      data: updatedQuestion,
    });
  } catch (error) {
    next(error);
  }
};