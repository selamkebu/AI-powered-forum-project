import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import {
  listQuestionsController,
  getSingleQuestionController,
} from "../controller/question.controller.js";
import {
  listQuestionsValidation,
  singleQuestionValidation,
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

//implement your other routes here (declare /search before /:questionHash)

router.get(
  "/:questionHash",
  authenticateUser,
  singleQuestionValidation,
  getSingleQuestionController,
);

export default router;
