import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";

import {
  getQuestionsController,
  getSingleQuestionController,
  generateQuestionDraftCoachController,
  getSimilarQuestionsController,
  searchQuestionsSemanticController,
  createQuestionController,
} from "../controller/question.controller.js";

import {
  getQuestionsValidation,
  singleQuestionValidation,
  generateQuestionDraftCoachValidation,
  getSimilarQuestionsValidation,
  searchQuestionsValidation,
  createQuestionValidation,
} from "../validations/question.validation.js";

const router = express.Router();

/**
 * @route POST /api/questions
 * @desc Create and publish a new question
 * @access Private
 */
router.post(
  "/",
  authenticateUser,
  createQuestionValidation,
  createQuestionController,
);

/**
 * @route GET /api/questions
 * @desc List questions
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
 * @route GET /api/questions/:questionHash
 * @desc Get a single question
 * @access Private
 */
router.get(
  "/:questionHash",
  authenticateUser,
  singleQuestionValidation,
  getSingleQuestionController,
);

export default router;
