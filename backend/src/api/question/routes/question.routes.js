import express from 'express';
import { getSingleQuestionController } from '../controller/question.controller.js';
import { singleQuestionValidation } from '../validations/question.validation.js';
import { authenticateUser } from '../../../middleware/authentication.js';

const router = express.Router();

router.get(
  '/:questionHash',
  authenticateUser,
  singleQuestionValidation,
  getSingleQuestionController
);

export default router;
