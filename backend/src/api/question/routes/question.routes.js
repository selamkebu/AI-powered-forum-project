import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import {
  listQuestionsController,
  getSingleQuestionController,
  generateQuestionDraftCoachController,
} from "../controller/question.controller.js";
import {
  listQuestionsValidation,
  singleQuestionValidation,
  generateQuestionDraftCoachValidation,
} from "../validations/question.validation.js";

const router = express.Router();

/**
 * @route GET /api/questions
 * @desc List questions (optional ?search=keyword, ?mine=true, ?page, ?limit)
 * @access Private
 */
router.get(
  "/",
  authenticateUser,
  listQuestionsValidation,
  listQuestionsController,
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

//implement your other routes here (declare /search before /:questionHash)

router.get(
  "/:questionHash",
  authenticateUser,
  singleQuestionValidation,
  getSingleQuestionController,
);

export default router;
