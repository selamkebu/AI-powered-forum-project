import { apiClient } from "../core/api.client.js";

// Get questions from the backend.
async function getQuestions({ search, mine } = {}) {
  try {
    const params = {};
    const term = search?.trim();

    if (term) params.search = term;
    if (mine) params.mine = true;

    const response = await apiClient.get("/api/questions", { params });

    return {
      questions: response.data?.data ?? [],
      meta: response.data?.meta ?? null,
    };
  } catch (error) {
    throw handleQuestionError(error);
  }
}

// Search questions using AI semantic search.
async function searchQuestionsSemantic(query, { k, threshold } = {}) {
  try {
    const params = { query: query?.trim() };

    if (k !== undefined) params.k = k;
    if (threshold !== undefined) params.threshold = threshold;

    const response = await apiClient.get("/api/questions/search", {
      params,
    });

    return {
      questions: response.data?.data ?? [],
      meta: response.data?.meta ?? null,
    };
  } catch (error) {
    throw handleQuestionError(error);
  }
}

// Create and publish a new question.
async function createQuestion({ title, description }) {
  try {
    const response = await apiClient.post("/api/questions", {
      title,
      description,
    });

    return response.data;
  } catch (error) {
    throw handleQuestionError(error);
  }
}

// Convert API errors into friendly messages.
function handleQuestionError(error) {
  if (!error.response) {
    if (error.code === "ECONNABORTED") {
      return new Error("Request timed out. Please try again.");
    }

    return new Error(
      "Unable to connect to server. Please check your internet connection.",
    );
  }

  const status = error.response.status;
  const backendMessage =
    error.response.data?.msg || error.response.data?.message;

  switch (status) {
    case 400:
      return new Error(backendMessage || "Invalid request.");

    case 401:
      return new Error("Please log in to continue.");

    case 500:
      return new Error(
        "Something went wrong on our end. Please try again later.",
      );

    default:
      return new Error(backendMessage || "An unexpected error occurred.");
  }
}

//fetch a single quesion from the backend
async function getSingleQuestion(questionHash) {
  let response = await apiClient.get(`/api/questions/${questionHash}`);
  return response.data;
}

// fetch the related questions from the backend
async function getRelatedQuestions(questionHash) {
  let response = await apiClient.get(`/api/questions/${questionHash}/similar`);
  return response.data;
}

export { getRelatedQuestions, getSingleQuestion };

export const questionService = {
  getQuestions,
  searchQuestionsSemantic,
  createQuestion,
};

export { getQuestions, searchQuestionsSemantic, createQuestion };
