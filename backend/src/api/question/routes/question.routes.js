import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import {
  getQuestionsController,
  getSingleQuestionController,
  getSimilarQuestionsController,
} from "../controller/question.controller.js";
import {
  getQuestionsValidation,
  singleQuestionValidation,
  getSimilarQuestionsValidation,
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
