
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  MessageSquare,
  Clock,
  CircleHelp,
  RefreshCw,
} from 'lucide-react';

import { getQuestions } from '../../services/myQuestion/question.service';
import styles from './MyQuestions.module.css';

// Handles common API response formats.
// Ideally, getQuestions should return an array directly.
const extractQuestions = (response) => {
  if (Array.isArray(response)) return response;

  const possibleArrays = [
    response?.questions,
    response?.data,
    response?.data?.questions,
    response?.data?.data,
    response?.data?.data?.questions,
  ];

  return possibleArrays.find(Array.isArray) ?? null;
};

// Formats the question creation date.
const formatDate = (dateValue) => {
  if (!dateValue) return 'Date unavailable';

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// A question card styled to match the Dashboard design.
// Replace this markup with your existing Dashboard QuestionCard
// once its actual component path and props are confirmed.
function MyQuestionCard({ question }) {
  const questionId =
    question.questionHash ||
    question.question_hash ||
    question.questionid ||
    question.id;

  const title =
    question.title ||
    question.questionTitle ||
    question.question_title ||
    'Untitled question';

  const description =
    question.description ||
    question.content ||
    question.body ||
    question.question ||
    '';

  const author =
    question.user ||
    question.author ||
    question.createdBy ||
    {};

  const authorName =
    typeof author === 'string'
      ? author
      : `${author.firstName || author.first_name || ''} ${
          author.lastName || author.last_name || ''
        }`.trim();

  const initials = authorName
    ? authorName
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'ME';

  const answerCount =
    question.answerCount ??
    question.answer_count ??
    question.answersCount ??
    question.answers?.length ??
    0;

  const createdDate =
    question.createdAt ||
    question.created_at ||
    question.createdDate;

  const questionPath = questionId
    ? `/question/${questionId}`
    : '/my-questions';

  return (
    <article className={styles.questionCard}>
      <div className={styles.avatar}>
        {initials}
      </div>

      <div className={styles.questionContent}>
        <div className={styles.questionTop}>
          <Link
            to={questionPath}
            className={styles.questionTitle}
          >
            {title}
          </Link>

          <span className={styles.yoursLabel}>YOURS</span>
        </div>

        {description && (
          <p className={styles.questionDescription}>
            {description}
          </p>
        )}

        <div className={styles.questionMeta}>
          <span>
            <MessageSquare size={13} />
            {answerCount} {answerCount === 1 ? 'reply' : 'replies'}
          </span>

          <span>
            <Clock size={13} />
            {formatDate(createdDate)}
          </span>

          <span className={styles.authorLabel}>by You</span>
        </div>
      </div>
    </article>
  );
}

export default function MyQuestions() {
  const [myQuestions, setMyQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMyQuestions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // GET /api/questions?mine=true
      const response = await getQuestions({ mine: true });

      const questions = extractQuestions(response);

      if (!questions) {
        throw new Error(
          'Unexpected response from the questions API.'
        );
      }

      setMyQuestions(questions);
    } catch (err) {
      console.error('Failed to fetch my questions:', err);

      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to fetch questions.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyQuestions();
  }, []);

  return (
    <div className={styles.myQuestionsPage}>

      {/* PAGE HEADER */}
      <section className={styles.pageHeader}>
        <div className={styles.headerContent}>
          <span className={styles.eyebrow}>
            YOUR WORKSPACE
          </span>

          <h1>Your topics</h1>

          <p>
            Only questions you created. Open one to read answers
            or add follow-ups. Rows use the same left accent
            as your threads on Home.
          </p>
        </div>

        <Link
          to="/questions/ask"
          className={styles.newQuestionButton}
        >
          <Plus size={17} />
          New question
        </Link>
      </section>

      {/* QUESTIONS CONTENT */}
      <section className={styles.questionsContainer}>

        {/* 1. LOADING STATE */}
        {isLoading && (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading your questions...</p>
          </div>
        )}

        {/* 2. ERROR STATE */}
        {!isLoading && error && (
          <div className={styles.errorState}>
            <p>{error}</p>

            <button
              type="button"
              onClick={fetchMyQuestions}
              className={styles.retryButton}
            >
              <RefreshCw size={15} />
              Try again
            </button>
          </div>
        )}

        {/* 3. EMPTY STATE */}
        {!isLoading &&
          !error &&
          myQuestions.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <CircleHelp size={32} />
              </div>

              <h2>You haven't asked any questions yet</h2>

              <p>
                Your questions will appear here after you post them.
                Start a conversation with the Evangadi community
                and get helpful answers from other learners.
              </p>

              <Link
                to="/questions/ask"
                className={styles.emptyButton}
              >
                <Plus size={17} />
                Ask your first question
              </Link>
            </div>
          )}

        {/* 4. QUESTIONS LIST */}
        {!isLoading &&
          !error &&
          myQuestions.length > 0 && (
            <div className={styles.questionList}>
              {myQuestions.map((question, index) => (
                <MyQuestionCard
                  key={
                    question.questionHash ||
                    question.question_hash ||
                    question.questionid ||
                    question.id ||
                    index
                  }
                  question={question}
                />
              ))}
            </div>
          )}

      </section>
    </div>
  );
}
