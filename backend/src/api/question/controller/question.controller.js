import { StatusCodes } from "http-status-codes";

import { body } from 'express-validator';
import {
  getQuestionsService,
  getSingleQuestionService,
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


export const assessAnswerAgainstQuestionController = async (req ,res, next) =>{
  try{
    const { questionHash }= req.params;
    const { answerText }= req.body;
    const { question } = await getSingleQuestionService({questionHash});
    const data = await assessAnswerAgainstQuestionService({
      questionTitle: question.title,
      questionContent: question.content,
      answerText,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Answer fit assessed',
      data,
    });
  }catch(error){
    next(error);

  }
};
