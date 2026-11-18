import { StatusCodes } from 'http-status-codes';
import { getSingleQuestionService } from '../service/question.service.js';

export const getSingleQuestionController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;

    const result = await getSingleQuestionService(questionHash);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Question fetched successfully',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
