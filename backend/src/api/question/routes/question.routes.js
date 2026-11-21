import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import {
  getQuestionsController,
  getSingleQuestionController,
} from "../controller/question.controller.js";
import {
  getQuestionsValidation,
  singleQuestionValidation,
  assessAnswerAgainstQuestionValidation
} from "../validations/question.validation.js";

const router = express.Router();

/**
 * @route GET /api/questions
 * @desc List questions (optional ?search=keyword, ?mine=true)
 * @access Private
 */
router.get(
  "/",
  authenticateUser,
  getQuestionsValidation,
  getQuestionsController,
);

//implement your other routes here (declare /search before /:questionHash)

router.get(
  "/:questionHash",
  authenticateUser,
  singleQuestionValidation,
  getSingleQuestionController,
);

/** 
* @route POST /api/questions/:questionHash/answer-fit
* @desc AI relevance check for an answer draft vs the question
* @access Protected 

*/
router.post(
  '/:questionHash/answer-fit',
  authenticateUser,
  assessAnswerAgainstQuestionValidation,

)


export default router;
