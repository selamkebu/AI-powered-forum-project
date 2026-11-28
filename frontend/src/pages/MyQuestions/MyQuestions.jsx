import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

// Same service the Dashboard uses
import { questionService } from "../../services/question/question.service.js";
// Shared card, exported from the Dashboard page
import { QuestionCard } from "../Dashboard/Dashboard";
import styles from "./MyQuestions.module.css";

export default function MyQuestions() {
  // ---- The three states from the documentation ----
  const [myQuestions, setMyQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [page, setPage] = useState(1);
const [limit, setLimit] = useState(10);
const [meta, setMeta] = useState(null);

  // Runs once on mount: GET /api/questions?mine=true
  useEffect(() => {
    let ignore = false; // drops the response if the page unmounts first

    questionService
  .getQuestions({ mine: true, page, limit })
  .then(({ questions, meta: resultMeta }) => {
    if (!ignore) {
      setMyQuestions(Array.isArray(questions) ? questions : []);
      setMeta(resultMeta);
    }
  })
      .catch(() => {
        if (!ignore) {
          setMyQuestions([]);
          setHasError(true);
          setMeta(null);
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    // Cleanup runs on unmount
    return () => {
      ignore = true;
    };
  }, [page, limit]);

  // Picks what the list card shows: loading -> error -> empty -> list
  function renderContent() {
    if (isLoading) {
      return <div className={styles.loading}>Loading your questions...</div>;
    }

    if (hasError) {
      return (
        <div className={`${styles.messageBox} ${styles.error}`}>
          Failed to fetch questions.
        </div>
      );
    }

    if (myQuestions.length === 0) {
      return (
        <div className={`${styles.messageBox} ${styles.empty}`}>
          You have not asked any questions yet. Use{" "}
          <Link to="/questions/ask" className={styles.emptyLink}>
            Ask a Question
          </Link>{" "}
          in the sidebar to start.
        </div>
      );
    }

    return (
  <>
    <ul className={styles.questionList}>
      {myQuestions.map((question, index) => (
        <li
          key={question.id ?? question.questionHash ?? index}
          className={styles.questionItem}
        >
          <QuestionCard question={question} />
        </li>
      ))}
    </ul>

    {meta && (
      <div className={styles.pagination}>
        <button
          onClick={() => setPage((prev) => prev - 1)}
          disabled={!meta.hasPreviousPage}
        >
          Previous
        </button>

        <span>
          Page {meta.page} of {meta.totalPages}
        </span>

        <button
          onClick={() => setPage((prev) => prev + 1)}
          disabled={!meta.hasNextPage}
        >
          Next
        </button>

        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(1);
          }}
        >
          <option value={10}>10 per page</option>
          <option value={20}>20 per page</option>
        </select>
      </div>
    )}
  </>
);
  }

  return (
    <div className={styles.page}>
      {/* Page header card: visible in every state */}
      <section className={styles.header}>
        <div>
          <p className={styles.eyebrow}>YOUR WORKSPACE</p>
          <h1 className={styles.heading}>Your topics</h1>
          <p className={styles.subtitle}>
            Only questions you created. Open one to read answers or add
            follow-ups. Rows use the same left accent as your threads on Home.
          </p>
        </div>

        <Link to="/questions/ask" className={styles.newButton}>
          <Plus size={16} aria-hidden />
          New question
        </Link>
      </section>

      {/* List card: content depends on the state */}
      <section className={styles.listCard}>{renderContent()}</section>
    </div>
  );
}