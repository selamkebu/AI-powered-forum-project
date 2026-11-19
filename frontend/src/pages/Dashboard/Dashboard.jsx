/**
 * Dashboard: default home after login; question list, quick actions, URL-driven search.
 * Data: `questionService` (keyword `q`, semantic `semantic`, or full list).
 * The Navbar owns the search box and writes `?q=` / `?semantic=`; this page only reads them.
 */

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, Library, MessageSquare, SquarePen } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { questionService } from "../../services/question/question.service.js";
import { isAuthoredByUser, timeAgo } from "../../lib/utils.js";
import styles from "./Dashboard.module.css";

/** Backend rejects semantic queries shorter than this. */
const SEMANTIC_MIN_LENGTH = 5;
const SEMANTIC_RESULT_LIMIT = 20;

const QUICK_ACTIONS = [
  {
    icon: SquarePen,
    title: "New question",
    text: "Share context, errors, and what you already tried",
    to: "/questions/ask",
  },
  {
    icon: Library,
    title: "Your topics",
    text: "Filtered list of threads you authored",
    to: "/my-questions",
  },
  {
    icon: BookOpen,
    title: "Knowledge base",
    text: "Course library, uploads, and retrieval-backed context for threads",
    to: "/rag-documents",
  },
];

function getInitials(author) {
  const first = author?.firstName?.trim()?.[0] ?? "";
  const last = author?.lastName?.trim()?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

/** Stable pastel colour per author so the same person always gets the same avatar. */
function getAvatarColor(authorId) {
  const seed = Number(authorId) || 0;
  return `hsl(${(seed * 47) % 360} 75% 80%)`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // the Navbar owns the search box; we only READ ?q= and ?semantic=.
  const keyword = searchParams.get("q")?.trim() ?? "";
  const semanticQuery = searchParams.get("semantic")?.trim() ?? "";
  const isSemantic = semanticQuery !== "";
  const queryTooShort =
    isSemantic && semanticQuery.length < SEMANTIC_MIN_LENGTH;

  // page state (questions, isLoading, error flag).
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // fetch on mount and whenever the URL search changes.
  useEffect(() => {
    // Too-short semantic queries never hit the API (it would answer 400).
    if (queryTooShort) return undefined;

    let ignore = false; // drops stale responses (fast typing, StrictMode double run)
    setIsLoading(true);
    setHasError(false);

    const request = isSemantic
      ? questionService.searchQuestionsSemantic(semanticQuery, {
          k: SEMANTIC_RESULT_LIMIT,
        })
      : questionService.getQuestions({ search: keyword });

    request
      .then(({ questions: result }) => {
        if (!ignore) setQuestions(result);
      })
      .catch(() => {
        if (!ignore) {
          setQuestions([]);
          setHasError(true);
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [keyword, semanticQuery, isSemantic, queryTooShort]);

  const firstName = user?.firstName?.trim();
  const welcomeLine = firstName
    ? `Good to see you, ${firstName}.`
    : "Welcome to the forum.";

  const visibleQuestions = queryTooShort ? [] : questions;
  const showLoading = isLoading && !queryTooShort;

  // stats are computed from the list on screen (no extra API call).
  const stats = {
    questions: visibleQuestions.length,
    replies: visibleQuestions.reduce(
      (sum, q) => sum + (Number(q.answerCount) || 0),
      0,
    ),
    unanswered: visibleQuestions.filter((q) => !Number(q.answerCount)).length,
    yours: visibleQuestions.filter((q) => isAuthoredByUser(q, user)).length,
  };

  // True whenever ?q= or ?semantic= is in the URL. Hides the hero section.
  const isSearching = isSemantic || keyword !== "";
  const searchLabel = isSemantic ? semanticQuery : keyword;
  const badgeText = isSemantic
    ? "AI matches"
    : keyword
      ? "Search results"
      : "Newest threads";
  const feedSubtitle = isSemantic
    ? `AI similarity results for “${semanticQuery}”`
    : keyword
      ? `Keyword results for “${keyword}”`
      : "Your threads use a slim left accent in this list.";

  // pick ONE feed state, in the order of your flowchart.
  const renderFeedBody = () => {
    if (queryTooShort) {
      return (
        <div className={styles.dashboard__state}>
          <p className={styles.dashboard__notice}>
            Type at least {SEMANTIC_MIN_LENGTH} characters to run an AI search.
          </p>
        </div>
      );
    }

    if (showLoading) {
      return (
        <div className={styles.dashboard__state} role="status">
          <div className={styles.dashboard__spinner} aria-hidden />
          <p className={styles.dashboard__stateText}>
            Loading recent questions…
          </p>
        </div>
      );
    }

    if (hasError) {
      return (
        <div className={styles.dashboard__state}>
          <p className={styles.dashboard__error} role="alert">
            Failed to load questions.
          </p>
        </div>
      );
    }

    if (visibleQuestions.length === 0) {
      return (
        <div className={styles.dashboard__state}>
          <p className={styles.dashboard__empty}>
            {isSearching
              ? `No questions found for “${searchLabel}”.`
              : "No questions found. Be the first to ask!"}
          </p>
        </div>
      );
    }

    return (
      <ul className={styles.dashboard__list}>
        {visibleQuestions.map((question) => {
          const mine = isAuthoredByUser(question, user);
          const answerCount = Number(question.answerCount) || 0;
          const authorName = mine
            ? "You"
            : `${question.author?.firstName ?? ""} ${question.author?.lastName ?? ""}`.trim() ||
              "Unknown";

          return (
            <li key={question.id}>
              {/* whole card is a Link => navigates to the detail route from App.jsx */}
              <Link
                to={`/question/${question.questionHash}`}
                className={`${styles.dashboard__card} ${
                  mine ? styles["dashboard__card--mine"] : ""
                }`}
              >
                <div
                  className={`${styles.dashboard__avatar} ${
                    mine ? styles["dashboard__avatar--mine"] : ""
                  }`}
                  style={{
                    backgroundColor: getAvatarColor(question.author?.id),
                  }}
                  aria-hidden
                >
                  {getInitials(question.author)}
                </div>

                <div className={styles.dashboard__cardBody}>
                  <div className={styles.dashboard__cardTop}>
                    <h3 className={styles.dashboard__cardTitle}>
                      {question.title}
                    </h3>
                    {mine && (
                      <span className={styles.dashboard__yoursBadge}>
                        Yours
                      </span>
                    )}
                    {typeof question.score === "number" && (
                      <span className={styles.dashboard__scoreBadge}>
                        {Math.round(question.score * 100)}% match
                      </span>
                    )}
                  </div>

                  {question.content && (
                    <p className={styles.dashboard__cardExcerpt}>
                      {question.content}
                    </p>
                  )}

                  <div className={styles.dashboard__cardMeta}>
                    <span className={styles.dashboard__metaItem}>
                      <MessageSquare size={12} aria-hidden />
                      {answerCount} {answerCount === 1 ? "reply" : "replies"}
                    </span>
                    <span className={styles.dashboard__metaItem}>
                      {timeAgo(question.createdAt)} by {authorName}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className={styles.dashboard}>
      {/* Welcome + quick actions + stats (hidden while a search is active) */}
      {!isSearching && (
        <section className={styles.dashboard__hero}>
          <p className={styles.dashboard__eyebrow}>Forum home</p>
          <h1 className={styles.dashboard__title}>{welcomeLine}</h1>
          <p className={styles.dashboard__intro}>
            Start a topic, revisit your own threads, or skim the live feed.
            Search above works from any page once you are back on Home.
          </p>

          <div className={styles.dashboard__actions}>
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className={styles.dashboard__action}
              >
                <span className={styles.dashboard__actionIcon} aria-hidden>
                  <action.icon size={18} />
                </span>
                <span>
                  <span className={styles.dashboard__actionTitle}>
                    {action.title}
                  </span>
                  <span className={styles.dashboard__actionText}>
                    {action.text}
                  </span>
                </span>
              </Link>
            ))}
          </div>

          {showLoading ? (
            <p className={styles.dashboard__snapshot}>
              Loading snapshot for the list below…
            </p>
          ) : (
            !hasError && (
              <div className={styles.dashboard__statsWrap}>
                <p className={styles.dashboard__statsNote}>
                  Figures below describe the newest threads in this feed (up to
                  100 from the API).
                </p>
                <div className={styles.dashboard__stats}>
                  {[
                    ["Questions", stats.questions],
                    ["Replies", stats.replies],
                    ["Unanswered", stats.unanswered],
                    ["Yours", stats.yours],
                  ].map(([label, value]) => (
                    <div key={label} className={styles.dashboard__stat}>
                      <span className={styles.dashboard__statLabel}>
                        {label}
                      </span>
                      <span className={styles.dashboard__statValue}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </section>
      )}

      {/* Discussion feed */}
      <section className={styles.dashboard__feed}>
        <header className={styles.dashboard__feedHeader}>
          <div>
            <h2 className={styles.dashboard__feedTitle}>Discussion feed</h2>
            <p className={styles.dashboard__feedSubtitle}>
              {feedSubtitle}
              {isSearching && (
                <>
                  {" · "}
                  <Link to="/dashboard" className={styles.dashboard__clear}>
                    Clear search
                  </Link>
                </>
              )}
            </p>
          </div>
          <span className={styles.dashboard__badge}>{badgeText}</span>
        </header>

        {renderFeedBody()}
      </section>
    </div>
  );
}
