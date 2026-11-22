import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import {
  getQuestionsController,
  getSingleQuestionController,
  generateQuestionDraftCoachController,
  getSimilarQuestionsController,
  searchQuestionsSemanticController,
} from "../controller/question.controller.js";
import {
  getQuestionsValidation,
  singleQuestionValidation,
  generateQuestionDraftCoachValidation,
  getSimilarQuestionsValidation,
  searchQuestionsValidation,
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

router.get(
  "/:questionHash",
  authenticateUser,
  singleQuestionValidation,
  getSingleQuestionController,
);

export default router;
