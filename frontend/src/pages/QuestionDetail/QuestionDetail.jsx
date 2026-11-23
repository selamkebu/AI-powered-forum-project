import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import MDEditor, { commands } from "@uiw/react-md-editor";
import { ArrowLeft, Share2, MessageSquare, Sparkles } from "lucide-react";
import Avatar from "react-avatar";
import {
  getSingleQuestion,
  getRelatedQuestions,
} from "../../services/question/question.service.js";
import {
  assessAnswerFit,
  postAnswer,
} from "../../services/answer/answer.service.js";

import { useAuth } from "../../contexts/AuthContext";
import styles from "./QuestionDetail.module.css";

function QuestionDetail() {
  let { questionHash } = useParams();
  let navigate = useNavigate();
  let [question, setQuestion] = useState(null);
  let [answers, setAnswers] = useState([]);
  let [related, setRelated] = useState([]);
  let [isLoading, setIsLoading] = useState(true);
  let [error, setError] = useState();
  //contribute an answer for a question
  let [answerText, setAnswerText] = useState("");
  let [isPosting, setIsPosting] = useState(false);
  let [postError, setPostError] = useState("");
  //check if answer is fit for the question
  let [fitResult, setFitResult] = useState(null);
  let [isChecking, setIsChecking] = useState(false);
  let [fitError, setFitError] = useState("");
  let [fitColor, setFitColor] = useState("");

  let fullName = (author) => `${author.firstName} ${author.lastName}`.trim();
  let formatDate = (date) => new Date(date).toLocaleDateString();
  useEffect(() => {
    async function mount() {
      setIsLoading(true);
      setError("");
      try {
        const questionData = await getSingleQuestion(questionHash);

        setQuestion(questionData.question);
        setAnswers(questionData.answers ?? []);
      } catch (err) {
        setError("Failed to load question details.");
        setIsLoading(false);
        return;
      }

      try {
        const relatedData = await getRelatedQuestions(questionHash);

        setRelated(
          Array.isArray(relatedData) ? relatedData : (relatedData?.data ?? []),
        );
      } catch (err) {
        setRelated([]);
      }

      setIsLoading(false);
    }

    mount();
  }, [questionHash]);
  let { user: currentUser } = useAuth();

  let isOwnQuestion = question?.author.id === currentUser.id;
  let canSubmit = answerText.trim().length >= 20;
  // on click of the post button the answer will be posted as an answer
  async function handlePostAnswer() {
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
      const fitData = await assessAnswerFit(questionHash, answerText);

      console.log(fitData);
      setFitResult(fitData);
      if (fitData.level == "weak") {
        setFitColor("red");
      } else if (fitData.level == "partial") {
        setFitColor("grey");
      } else {
        setFitColor("green");
      }
    } catch (error) {
      setFitError("Could not check your draft. Please try again.");
    } finally {
      setIsChecking(false);
    }
  }
  if (isLoading)
    return <p className={`${styles.isloading}`}>Loading question details...</p>;

  if (error) {
    return (
      <div className={`${styles.loadingError}`}>
        <p>{error}</p>
        <button
          onClick={() => navigate("/dashboard")}
          className={`${styles.postButton}`}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      <section>
        <Link to="/dashboard" className={`${styles.backToFeed}`}>
          <ArrowLeft size={16} />
          Back to feed
        </Link>
      </section>
      <section className={`${styles.top}`}>
        <div className={`${styles.question}`}>
          <div className={`${styles.credentials}`}>
            <div>
              <Avatar name={fullName(question.author)} size="40" round />
            </div>
            <div>
              <p className={`${styles.name}`}>{fullName(question.author)}</p>
              <p className={`${styles.date}`}>
                Posted {formatDate(question.createdAt)}
              </p>
            </div>
          </div>

          <h1 className={`${styles.title}`}>{question.title}</h1>
          <ReactMarkdown>{question.content}</ReactMarkdown>

          <div className={`${styles.extra}`}>
            <div className={`${styles.share}`}>
              <button type="button">
                {" "}
                <Share2 size={16} />
                Share
              </button>
            </div>
            <button className={`${styles.comments}`}>
              <MessageSquare size={16} />
              {answers.length} Answers
            </button>
          </div>
        </div>

        <div className={`${styles.related}`}>
          <h2>Related Questions</h2>

          {related.map((relatedquestion) => (
            <div
              key={relatedquestion.id}
              className={`${styles.relatedQuestion}`}
            >
              <Link
                key={relatedquestion.id}
                to={`/question/${relatedquestion.questionHash}`}
              >
                <p className={`${styles.relatedtitle}`}>
                  {relatedquestion.title}
                </p>
                <p className={`${styles.date}`}>
                  {formatDate(relatedquestion.createdAt)}
                </p>
              </Link>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div>
          <h2 className={`${styles.sectiontitle}`}>
            Community Answers ({answers.length})
          </h2>
          {answers.length === 0 ? (
            <div className={`${styles.noanswer}`}>
              <MessageSquare size={25} />
              <p>Be the first to help!</p>
              <p>
                This question is waiting for an expert like you. Share your
                knowledge and earn reputation points.
              </p>
            </div>
          ) : (
            answers.map((givenanswers) => (
              <div key={givenanswers.id} className={`${styles.answer}`}>
                <div className={`${styles.credentials}`}>
                  <div>
                    <Avatar
                      name={fullName(givenanswers.author)}
                      size="40"
                      round
                    />
                  </div>
                  <div>
                    <p className={`${styles.name}`}>
                      {fullName(givenanswers.author)}
                    </p>
                    <p className={`${styles.date}`}>
                      Posted {formatDate(givenanswers.createdAt)}
                    </p>
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
        <section className={`${styles.contibute}`}>
          <h2 className={`${styles.sectiontitle}`}>Contribute an answer</h2>
          {postError && <p className={`${styles.postError}`}>{postError}</p>}

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
          {fitError && <p className={`${styles.postError}`}></p>}
          <div className={`${styles.fitCheck}`}>
            <button
              type="button"
              onClick={handleFitCheck}
              disabled={!canSubmit || isChecking || isPosting}
              className={`${styles.fitButton}`}
            >
              <Sparkles size={14} />
              {isChecking ? "Checking..." : "Check draft fit"}
            </button>
            <p className={`${styles.fitMessage}`}>
              Relevance only. Not grading correctness. You need at least 20
              characters.
            </p>
          </div>

          {fitResult && (
            <div className={`${styles.fitResponse}`}>
              <p className={`${styles[fitColor]}`}>{fitResult.level}</p>
              <p>{fitResult.note}</p>
            </div>
          )}
          <div className={`${styles.postButtonContainer}`}>
            <button
              type="button"
              onClick={handlePostAnswer}
              disabled={!canSubmit || isPosting || isChecking}
              className={`${styles.postButton}`}
            >
              {isPosting ? "Posting..." : "Post Your Answer"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default QuestionDetail;
