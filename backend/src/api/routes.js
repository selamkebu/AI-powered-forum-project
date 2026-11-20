import express from "express";
import authRoutes from "./auth/routes/auth.routes.js";
import questionRoutes from "./question/routes/question.routes.js";
import answerRoutes from "./answer/routes/answer.routes.js";
import ragRoutes from "./rag/routes/rag.routes.js";

export const mainRouter = express.Router();

// Authentication routes
//  /api/auth
mainRouter.use("/auth", authRoutes);

//questions routes
//  /api/questions
mainRouter.use("/questions", questionRoutes);

//answers routes
//  /api/answers  <-- FIX: Change this to /answers
mainRouter.use("/answers", answerRoutes);

//rag routes
//  /api/rag
mainRouter.use("/rag", ragRoutes);
