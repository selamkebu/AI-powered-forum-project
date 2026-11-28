import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import {
  getQuestionsController,
  getSingleQuestionController,
  assessAnswerAgainstQuestionController,
  generateQuestionDraftCoachController,
  getSimilarQuestionsController,
  searchQuestionsSemanticController,
  createQuestionController,
  deleteQuestionController,
} from "../controller/question.controller.js";
import {
  getQuestionsValidation,
  singleQuestionValidation,
  assessAnswerAgainstQuestionValidation,
  generateQuestionDraftCoachValidation,
  getSimilarQuestionsValidation,
  searchQuestionsValidation,
  createQuestionValidation,
} from "../validations/question.validation.js";

const router = express.Router();

/**
 * T-09: Create Question API
 * @route POST /api/questions
 * @desc Create a new question
 * @access Private
 */
router.post(
  "/",
  authenticateUser,
  createQuestionValidation,
  createQuestionController,
  deleteQuestionController,
);

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

/**
 * @route GET /api/questions/search
 * @desc Semantic search questions using vector cosine similarity
 * @access Private
 * NOTE: Must be declared BEFORE /:questionHash so Express does not treat "search" as an ID
 */
router.get(
  "/search",
  authenticateUser,
  searchQuestionsValidation,
  searchQuestionsSemanticController,
);

/**
 * @route POST /api/questions/draft-coach
 * @desc Generate AI suggestions for a question draft
 * @access Private
 */
router.post(
  "/draft-coach",
  authenticateUser,
  generateQuestionDraftCoachValidation,
  generateQuestionDraftCoachController,
);

/**
 * @route GET /api/questions/:questionHash/similar
 * @desc Get similar questions
 * @access Private
 */
router.get(
  "/:questionHash/similar",
  authenticateUser,
  getSimilarQuestionsValidation,
  getSimilarQuestionsController,
);


/**
 * DELETE /api/questions/:questionHash
 * Delete a question (owner or admin only).
 */
router.delete(
  "/:questionHash",
  authenticateUser,
  singleQuestionValidation,
  deleteQuestionController,
);

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
  assessAnswerAgainstQuestionController,

)


export default router;
