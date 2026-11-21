export const createAnswerValidation = (req, res, next) => {
  const { questionId, content } = req.body;

  if (questionId === undefined || !Number.isInteger(questionId)) {
    return res
      .status(400)
      .json({ success: false, message: "questionId must be an integer" });
  }

  if (!content || content.trim().length < 20) {
    return res
      .status(400)
      .json({
        success: false,
        message: "content must be at least 20 characters long",
      });
  }

  next();
};
