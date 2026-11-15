import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import MDEditor, { commands } from "@uiw/react-md-editor";
import Avatar from "react-avatar";
import { getSingleQuestion } from "../../services/question.service.js";
import { assessAnswerFit } from "../../services/answer/answer.service.js";
import { postAnswer } from "../../services/answer/answer.service.js";
import { useAuth } from "../../contexts/AuthContext";

const getInitials = (name = "") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
let fullName = (author) =>
  `${author?.firstName ?? ""} ${author?.lastName ?? ""}`.trim();
let formatDate = (date) => new Date(date).toLocaleDateString();
function QuestionDetail() {
  let { questionHash } = useParams();
  let navigate = useNavigate();
  let [question, setQuestion] = useState();
  let [answers, setAnswers] = useState([]);
  let [related, setRelated] = useState([]);
  let [isLoading, setIsLoading] = useState(true);
  let [error, setError] = useState();
  //contribute an answer for a question
  let [answerText, setAnswerText] = useState("");
  let [isPosting, setIsPosting] = useState(false);
  let [postError, setPostError] = useState("");
  //check if answer is fit for the question
  const [fitResult, setFitResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [fitError, setFitError] = useState("");

  useEffect(() => {
    // on mounting the page a single detailed question will be fetched
    async function mount() {
      setIsLoading(true);
      try {
        let data = await getSingleQuestion(questionHash);

        setQuestion(data.question);
        setAnswers(data.answers);
        setRelated(data.related);
      } catch (err) {
        console.log("error occured");
        setError("Failed to load question");
      } finally {
        setIsLoading(false);
      }
    }
    mount();
  }, [questionHash]);
  let { user: currentUser } = useAuth();

  let isOwnQuestion = question?.author?.id === currentUser.id;
  let canSubmit = answerText.trim().length >= 20;
  // on click of the post button the answer will be posted as an answer
  async function handlePostAnswer() {
    if (!canSubmit) return;
    setIsPosting(true);

    try {
      const newAnswer = await postAnswer(question.id, answerText);

      setAnswers((prev) => [...prev, newAnswer]);
      setAnswerText("");
      setFitResult(null);
    } catch (err) {
      setPostError("Failed to post answer. Please try again.");
    } finally {
      setIsPosting(false);
    }
  }
  async function handleFitCheck() {
    if (!canSubmit) return;
    setIsChecking(true);
    setFitError("");
    setFitResult(null);
    try {
      const result = await assessAnswerFit(questionHash, answerText);

      setFitResult(result);
    } catch (error) {
      setFitError("Could not check your draft. Please try again.");
    } finally {
      setIsChecking(false);
    }
  }
  if (isLoading) return <p>Loading question details...</p>;

  if (error) {
    return (
      <div>
        <p>{error}</p>
        <button onClick={() => navigate("/dashboard")}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      <div>
        <Link to="/dashboard">Back to feed</Link>
      </div>
      <section>
        <div>
          <div>
            <Avatar name={getFullName(question.author)} size="40" round />
          </div>
          <div>
            <p>{fullName(question.author)}</p>
            <p>Posted {formatDate(question.createdAt)}</p>
          </div>
          <h1>{question.title}</h1>
          <ReactMarkdown>{question.content}</ReactMarkdown>
          <div>
            <div>
              <button type="button">Share</button>
            </div>
            <div>{answers.length} Answers</div>
          </div>
        </div>

        <div>
          <h2>Related Questions</h2>
          <div>
            {related.map((relatedquestion) => (
              <Link
                key={relatedquestion.id}
                to={`/questions/${relatedquestion.questionHash}`}
              >
                <p>{relatedquestion.title}</p>
                <p>{formatDate(relatedquestion.createdAt)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section>
        <div>
          <h2>Community Answers ({answers.length})</h2>
          {answers.length === 0 ? (
            <div>
              <p>Be the first to help!</p>
              <p>
                This question is waiting for an expert like you. Share your
                knowledge and earn reputation points.
              </p>
            </div>
          ) : (
            answers.map((givenanswers) => (
              <div key={givenanswers.id}>
                <div>
                  <div>
                    <p>
                      <Avatar
                        name={fullName(givenanswers.author)}
                        size="40"
                        round
                      />
                    </p>
                    <p>{fullName(givenanswers.author)}</p>
                  </div>
                  <div>
                    <p>{formatDate(givenanswers.createdAt)}</p>
                  </div>
                </div>
                <div>
                  <ReactMarkdown>{givenanswers.content}</ReactMarkdown>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      {!isOwnQuestion && (
        <section>
          <h2>Contribute an answer</h2>
          {postError && <p>{postError}</p>}
          <p>{answerText.length} characters</p>
          <div data-color-mode="light">
            <MDEditor
              value={answerText}
              onChange={(val) => {
                setAnswerText(val);
                setFitResult(null);
              }}
              preview="edit"
              height={250}
              commands={[
                commands.bold,
                commands.italic,
                commands.divider,
                commands.code,
                commands.link,
              ]}
              extraCommands={[
                {
                  name: "character-count",
                  keyCommand: "character-count",
                  icon: <p>{answerText.length} characters</p>,
                },
              ]}
              textareaProps={{
                placeholder:
                  "Type your answer here... You can use Markdown to format your code!",
              }}
            />
          </div>
          <p>
            Relevance only. Not grading correctness. You need at least 20
            characters.
          </p>
          <button
            type="button"
            onClick={handleFitCheck}
            disabled={!canSubmit || isChecking || isPosting}
          >
            {isChecking ? "Checking..." : "Check draft fit"}
          </button>
          {fitError && <p>{fitError}</p>}

          {fitResult && (
            <div>
              <p>Fit: {fitResult.level}</p>
              <p>{fitResult.note}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handlePostAnswer}
            disabled={!canSubmit || isPosting || isChecking}
          >
            {isPosting ? "Posting..." : "Post Your Answer"}
          </button>
        </section>
      )}
    </div>
  );
}

export default QuestionDetail;
