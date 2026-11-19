import express from "express";
import { createAnswerController } from "../controller/answer.controller.js";
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

export default router;
