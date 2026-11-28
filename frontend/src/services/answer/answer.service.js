import { apiClient } from "../core/api.client";

//send a post request to the backend to assess if anwswer is fit
async function assessAnswerFit(questionHash, answerText) {
  let response = await apiClient.post(
    `/api/questions/${questionHash}/answer-fit`,
    {
      answerText,
    },
  );
  return response.data.data;
}
//send a post request to the backend to post the answer
async function postAnswer(questionId, content) {
  let response = await apiClient.post("/api/answers", {
    questionId,
    content,
  });
  return response.data.data;
}

// Delete an answer (owner or admin).
async function deleteAnswer(answerId) {
  const response = await apiClient.delete(`/api/answers/${answerId}`);
  return response.data;
}

export { assessAnswerFit, postAnswer, deleteAnswer };
