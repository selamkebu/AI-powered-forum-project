import { StatusCodes } from "http-status-codes";

import {
  getQuestionsService,
  getSingleQuestionService,
  getSimilarQuestionsService,
  createQuestionWithVectorService,
} from "../service/question.service.js";
/**
 * GET /api/questions
 * Query: search, mine
 */
export const getQuestionsController = async (req, res, next) => {
  try {
    const { search, mine } = req.query;

    const { questions, meta } = await getQuestionsService({
      userId: req.user.id,
      search: search || "",
      mine: mine === "true" || mine === "1",
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Questions fetched successfully.",
      data: questions,
      meta,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/questions/:questionHash
 */
export const getSingleQuestionController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;

    const result = await getSingleQuestionService(questionHash);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Question fetched successfully",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/questions/:questionHash/similar
 * Query: k, threshold
 */
export const getSimilarQuestionsController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;
    const { k, threshold } = req.query;

    const result = await getSimilarQuestionsService({
      questionHash,
      k,
      threshold,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Similar questions fetched successfully",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};


export const createQuestionController = async (req, res, next) => {
  try {
    const { title, content } = req.body;
    const userId = req.user.id;

    const question = await createQuestionWithVectorService({
      userId,
      title,
      content,
    });

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Question posted successfully.",
      data: question,
    });
  } catch (error) {
    next(error);
  }
};
