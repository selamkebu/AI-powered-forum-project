import { param } from 'express-validator';
import { validationErrorHandler } from '../../../middleware/validation-handler.js';

export const singleQuestionValidation = [
  param('questionHash')
    .matches(/^[a-f0-9]{16}$/)
    .withMessage(
      'Question hash must be exactly 16 lowercase hexadecimal characters'
    ),

  validationErrorHandler,
];
