import { questionService } from "../../services/question/question.service.js";


import {
  Bold,
  Italic,
  Code,
  Link as LinkIcon,
  Sparkles,
  Send,
  LoaderCircle,
  CheckCircle2,
  CircleAlert,
} from "lucide-react";

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../services/core/api.client.js";
import styles from "./PostQuestion.module.css";

function PostQuestion() {
  const navigate = useNavigate();
  const textareaRef = useRef(null);

  // Form data
  const [formData, setFormData] = useState({
    title: "",
    content: "",
  });

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCoaching, setIsCoaching] = useState(false);

  // Messages and AI feedback
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [coachFeedback, setCoachFeedback] = useState(null);

  // Store the published question hash for the View Question button
  const [publishedQuestionHash, setPublishedQuestionHash] = useState("");

  // Character counts
  const titleLength = formData.title.length;
  const contentLength = formData.content.length;

  // Update form fields
  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess(false);
  }

  // Validate the form
  function validateForm() {
    const title = formData.title.trim();
    const content = formData.content.trim();

    if (title.length < 5) {
      setError("Question title must be at least 5 characters.");
      return false;
    }

    if (title.length > 255) {
      setError("Question title cannot exceed 255 characters.");
      return false;
    }

    if (content.length < 10) {
      setError("Question details must contain at least 10 characters.");
      return false;
    }

    return true;
  }

  // Publish question
  async function handleSubmit(event) {
    event.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setError("");
    setCoachFeedback(null);

    try {
     

      const response = await questionService.createQuestion({
        title: formData.title.trim(),
        content: formData.content.trim(),
      });

      // Support a response containing data inside response.data.data
     const result = response?.data?.data || response?.data || response;

     setPublishedQuestionHash(result?.questionHash || "");

      setSuccess(true);
    } catch (err) {
      console.error("Question publishing error:", err);

      const message =
        err.message || "Failed to post question. Please try again.";

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Request AI draft suggestions
  async function handleCoach() {
    if (!validateForm()) return;

    setIsCoaching(true);
    setError("");
    setCoachFeedback(null);

    try {
    
      

      const response = await apiClient.post("/api/questions/draft-coach", {
        title: formData.title.trim(),
        content: formData.content.trim(),
      });

      const result = response.data?.data || response.data;

      setCoachFeedback(result);
    } catch (err) {
      console.error("AI Draft Coach error:", err);

      setError(
        err.response?.data?.message ||
          "AI suggestions are not available yet. The Draft Coach API may not be connected.",
      );
    } finally {
      setIsCoaching(false);
    }
  }

  // Insert Markdown formatting into the textarea
  function insertMarkdown(before, after = "") {
    const textarea = textareaRef.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selectedText = formData.content.substring(start, end);

    const updatedContent =
      formData.content.substring(0, start) +
      before +
      selectedText +
      after +
      formData.content.substring(end);

    setFormData((previous) => ({
      ...previous,
      content: updatedContent,
    }));

    // Restore cursor position after React updates the textarea
    requestAnimationFrame(() => {
      textarea.focus();

      const newPosition = start + before.length + selectedText.length;

      textarea.setSelectionRange(newPosition, newPosition);
    });
  }

  // Start a new question
  function handleAskAnother() {
    setFormData({
      title: "",
      content: "",
    });

    setSuccess(false);
    setError("");
    setCoachFeedback(null);
    setPublishedQuestionHash("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // Successful publishing screen
  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>ASK THE COHORT</span>

          <h1>Publish to the forum</h1>

          <p>
            Public threads help the whole cohort. Write as if a classmate will
            debug your issue tomorrow.
          </p>
        </div>

        <div className={styles.successCard}>
          <div className={styles.successIcon}>
            <CheckCircle2 size={40} />
          </div>

          <h2>Thread published</h2>

          <p>
            Your post has been submitted successfully. You can return to the
            dashboard or view your question.
          </p>

          <div className={styles.successActions}>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => navigate("/dashboard")}
            >
              Back to Dashboard
            </button>

            <button
              type="button"
              className={styles.submitButton}
              onClick={() => {
                if (publishedQuestionHash) {
                  navigate(`/questions/${publishedQuestionHash}`);
                } else {
                  navigate("/dashboard");
                }
              }}
            >
              View Question
            </button>

            <button
              type="button"
              className={styles.anotherButton}
              onClick={handleAskAnother}
            >
              Ask Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page heading */}
      <div className={styles.header}>
        <span className={styles.eyebrow}>ASK THE COHORT</span>

        <h1>Publish to the forum</h1>

        <p>
          Public threads help the whole cohort. Write as if a classmate will
          debug your issue tomorrow. They only know what you put on the page.
        </p>
      </div>

      {/* Instructions */}
      <section className={styles.instruction}>
        <h2>Write questions people can answer in one pass</h2>

        <p>
          Mentors volunteer their time. Give them runnable context, expected vs
          actual behavior, and a tight scope so they can reproduce the issue
          without guessing your setup.
        </p>

        <h3>Checklist before you post</h3>

        <ul>
          <li>
            <strong>Title as a headline:</strong> State the symptom and
            technology stack.
          </li>

          <li>
            <strong>Repro steps:</strong> Numbered steps, with environment
            information when it matters.
          </li>

          <li>
            <strong>Minimal code:</strong> Include relevant code snippets and
            remove unrelated lines.
          </li>

          <li>
            <strong>Exact errors:</strong> Copy error messages accurately when
            debugging.
          </li>
        </ul>

        <h3>Validation rules (enforced by the form)</h3>

        <ul>
          <li>
            <strong>Title length:</strong> Must be between 5 and 255 characters.
          </li>

          <li>
            <strong>Body length:</strong> Must contain a minimum of 10
            characters detailing your problem.
          </li>

          <li>
            <strong>Single topic:</strong> Split unrelated bugs into separate
            threads.
          </li>
        </ul>
      </section>

      {/* Question form */}
      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Error message */}
        {error && (
          <div className={styles.error} role="alert">
            <CircleAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Title field */}
        <div className={styles.field}>
          <label htmlFor="question-title">Title</label>

          <p className={styles.helpText}>
            Be specific and imagine you're asking a question to another person.
          </p>

          <input
            id="question-title"
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g. How do I handle state management using Context API in React?"
            maxLength={255}
            required
            aria-describedby="title-counter"
          />

          <div id="title-counter" className={styles.counter}>
            {titleLength}/255 characters
          </div>
        </div>

        {/* Question details */}
        <div className={styles.field}>
          <label htmlFor="question-content">
            What are the details of your problem?
          </label>

          <p className={styles.helpText}>
            Introduce the problem and expand on what you put in the title.
            Minimum 10 characters.
          </p>

          {/* Markdown editor */}
          <div className={styles.editor}>
            <div className={styles.toolbar}>
              <button
                type="button"
                onClick={() => insertMarkdown("**", "**")}
                title="Bold"
                aria-label="Bold"
              >
                <Bold size={18} />
              </button>

              <button
                type="button"
                onClick={() => insertMarkdown("*", "*")}
                title="Italic"
                aria-label="Italic"
              >
                <Italic size={18} />
              </button>

              <button
                type="button"
                onClick={() => insertMarkdown("`", "`")}
                title="Code"
                aria-label="Code"
              >
                <Code size={18} />
              </button>

              <button
                type="button"
                onClick={() => insertMarkdown("[", "](url)")}
                title="Link"
                aria-label="Link"
              >
                <LinkIcon size={18} />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              id="question-content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              placeholder="Include all the information someone would need to answer your question... You can use Markdown to format your code!"
              rows={12}
              required
            />

            <div className={styles.editorFooter}>
              <span>Markdown supported</span>

              <span>{contentLength} characters</span>
            </div>
          </div>
        </div>

        {/* AI suggestions */}
        {coachFeedback && (
          <div className={styles.feedback}>
            <h3>AI Draft Coach Suggestions</h3>

            {coachFeedback.tips?.length > 0 ? (
              coachFeedback.tips.map((tip, index) => <p key={index}>{tip}</p>)
            ) : (
              <p>
                {coachFeedback.message ||
                  "Suggestions received. Check the response format with the backend developer."}
              </p>
            )}
          </div>
        )}

        {/* Form actions */}
        <div className={styles.actions}>
          <div className={styles.aiActions}>
            <button
              type="button"
              className={styles.aiButton}
              onClick={handleCoach}
              disabled={isCoaching || isSubmitting}
            >
              {isCoaching ? (
                <>
                  <LoaderCircle size={18} className={styles.spinner} />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  AI Suggestions
                </>
              )}
            </button>

            <span className={styles.aiHint}>
              Suggestions only. You still choose what to post.
            </span>
          </div>

          <div className={styles.rightActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => navigate("/dashboard")}
              disabled={isSubmitting || isCoaching}
            >
              Cancel
            </button>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting || isCoaching}
            >
              {isSubmitting ? "Posting..." : "Post Question"}
              {!isSubmitting && (
                <span>
                  <Send size={18} />
                </span>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default PostQuestion;
