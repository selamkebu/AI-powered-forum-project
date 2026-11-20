import { apiClient } from "../core/api.client.js";

// :keyword list. Sends ?search= (and ?mine= if given). Returns { questions, meta }.
async function getQuestions({ search, mine } = {}) {
  try {
    const params = {};
    const term = search?.trim();
    if (term) params.search = term; // only send filters that have a value
    if (mine) params.mine = true;

    const response = await apiClient.get("/api/questions", { params });
    return {
      questions: response.data?.data ?? [], // backend shape: { success, message, data, meta }
      meta: response.data?.meta ?? null,
    };
  } catch (error) {
    throw handleQuestionError(error);
  }
}

// : semantic search. The backend requires query >= 5 chars; k is capped at 20.
async function searchQuestionsSemantic(query, { k, threshold } = {}) {
  try {
    const params = { query: query?.trim() };
    if (k !== undefined) params.k = k;
    if (threshold !== undefined) params.threshold = threshold;

    const response = await apiClient.get("/api/questions/search", { params });
    return {
      questions: response.data?.data ?? [], // each item also has a `score`
      meta: response.data?.meta ?? null,
    };
  } catch (error) {
    throw handleQuestionError(error);
  }
}

// : turn axios errors into friendly messages (same pattern as auth.service.js).
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
      return new Error(backendMessage || "Invalid search input.");
    case 500:
      return new Error(
        "Something went wrong on our end. Please try again later.",
      );
    default:
      return new Error(backendMessage || "An unexpected error occurred.");
  }
}

export const questionService = { getQuestions, searchQuestionsSemantic };
export { getQuestions, searchQuestionsSemantic };
