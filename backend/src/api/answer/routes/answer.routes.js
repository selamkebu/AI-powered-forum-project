import express from "express";
import { createAnswerController, deleteAnswerController } from "../controller/answer.controller.js";
import { createAnswerValidation } from "../validations/answer.validation.js";
import { authenticateUser } from "../../../middleware/authentication.js";

const router = express.Router();

// POST /api/answers
router.post(
  "/",
  authenticateUser,
  createAnswerValidation,
  createAnswerController,
);


// DELETE /api/answers/:answerId
router.delete(
  "/:answerId",
  authenticateUser,
  deleteAnswerController,
);

export default router;
