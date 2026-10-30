import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Eye,
  EyeOff,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import {
  formatDateTime,
  roundOne,
} from "../../lib/courseHelpers";


// =========================================================
// QUIZZES TAB
// Teacher: build multiple-choice quizzes (open/close time,
//          time limit, weight), publish, see results.
// Student: take the quiz once, with a timer. Marked straight
//          away; correct answers shown after the quiz closes.
// The answers never reach a student's browser before that.
// =========================================================

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromLocalInput(value) {
  return value ? new Date(value).toISOString() : null;
}

function quizState(quiz) {
  const now = new Date();
  if (!quiz.is_published) return { key: "neutral", label: "Draft" };
  if (quiz.opens_at && new Date(quiz.opens_at) > now) return { key: "open", label: `Opens ${formatDateTime(quiz.opens_at)}` };
  if (quiz.closes_at && new Date(quiz.closes_at) < now) return { key: "neutral", label: "Closed" };
  return { key: "submitted", label: quiz.closes_at ? `Open until ${formatDateTime(quiz.closes_at)}` : "Open" };
}

function blankQuestion() {
  return { prompt: "", options: ["", ""], correct_index: 0, points: 1 };
}


// ---------------------------------------------------------
// TEACHER: build / edit a quiz
// ---------------------------------------------------------

function QuizEditor({ groupId, userId, quiz, locked, onDone, onCancel }) {
  const [title, setTitle] = useState(quiz?.title || "");
  const [instructions, setInstructions] = useState(quiz?.instructions || "");
  const [opensAt, setOpensAt] = useState(toLocalInput(quiz?.opens_at));
  const [closesAt, setClosesAt] = useState(toLocalInput(quiz?.closes_at));
  const [limit, setLimit] = useState(quiz?.time_limit_minutes ? String(quiz.time_limit_minutes) : "");
  const [weight, setWeight] = useState(quiz?.weight !== null && quiz?.weight !== undefined ? String(Number(quiz.weight)) : "");
  const [questions, setQuestions] = useState(quiz ? [] : [blankQuestion()]);
  const [loading, setLoading] = useState(Boolean(quiz));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!quiz) return;

    let active = true;

    supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", quiz.id)
      .order("position")
      .then(({ data }) => {
        if (!active) return;
        setQuestions(
          (data || []).length
            ? data.map((row) => ({
                prompt: row.prompt,
                options: row.options,
                correct_index: row.correct_index,
                points: Number(row.points),
              }))
            : [blankQuestion()]
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [quiz]);

  function updateQuestion(index, change) {
    setQuestions((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));
  }

  function updateOption(qIndex, oIndex, value) {
    setQuestions((current) =>
      current.map((row, i) =>
        i === qIndex ? { ...row, options: row.options.map((option, j) => (j === oIndex ? value : option)) } : row
      )
    );
  }

  function addOption(qIndex) {
    setQuestions((current) =>
      current.map((row, i) => (i === qIndex && row.options.length < 6 ? { ...row, options: [...row.options, ""] } : row))
    );
  }

  function removeOption(qIndex, oIndex) {
    setQuestions((current) =>
      current.map((row, i) => {
        if (i !== qIndex || row.options.length <= 2) return row;
        const options = row.options.filter((_, j) => j !== oIndex);
        const correct =
          row.correct_index === oIndex ? 0 : row.correct_index > oIndex ? row.correct_index - 1 : row.correct_index;
        return { ...row, options, correct_index: correct };
      })
    );
  }

  async function save(event) {
    event.preventDefault();
    setError("");

    if (!title.trim()) return setError("Give the quiz a title.");

    const limitValue = limit.trim() === "" ? null : Number(limit);
    if (limitValue !== null && (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 300)) {
      return setError("Time limit must be 1 to 300 minutes (or empty for no limit).");
    }

    const weightValue = weight.trim() === "" ? null : Number(weight);
    if (weightValue !== null && (Number.isNaN(weightValue) || weightValue < 0 || weightValue > 100)) {
      return setError("Weight must be between 0 and 100%.");
    }

    if (opensAt && closesAt && new Date(closesAt) <= new Date(opensAt)) {
      return setError("The closing time must be after the opening time.");
    }

    if (!locked) {
      for (const [index, question] of questions.entries()) {
        if (!question.prompt.trim()) return setError(`Question ${index + 1} needs text.`);
        if (question.options.some((option) => !option.trim())) return setError(`Fill in every answer in question ${index + 1}, or remove the empty one.`);
        if (!(Number(question.points) > 0)) return setError(`Question ${index + 1} needs points above 0.`);
      }
      if (questions.length === 0) return setError("Add at least one question.");
    }

    setSaving(true);

    try {
      const row = {
        title: title.trim(),
        instructions: instructions.trim() || null,
        opens_at: fromLocalInput(opensAt),
        closes_at: fromLocalInput(closesAt),
        time_limit_minutes: limitValue,
        weight: weightValue,
      };

      let quizId = quiz?.id;

      if (quiz) {
        const { error: updateError } = await supabase.from("quizzes").update(row).eq("id", quiz.id);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } =
          await supabase
            .from("quizzes")
            .insert({ ...row, group_id: groupId, created_by: userId, is_published: false })
            .select()
            .single();
        if (insertError) throw insertError;
        quizId = data.id;
      }

      if (!locked) {
        if (quiz) {
          const { error: deleteError } = await supabase.from("quiz_questions").delete().eq("quiz_id", quizId);
          if (deleteError) throw deleteError;
        }

        const { error: questionError } =
          await supabase
            .from("quiz_questions")
            .insert(
              questions.map((question, index) => ({
                quiz_id: quizId,
                position: index + 1,
                prompt: question.prompt.trim(),
                options: question.options.map((option) => option.trim()),
                correct_index: question.correct_index,
                points: Number(question.points),
              }))
            );
        if (questionError) throw questionError;
      }

      onDone();
    } catch (saveError) {
      setError(
        /quizzes|quiz_questions|schema cache/i.test(saveError.message || "")
          ? "Quizzes aren't set up yet. Run supabase/14-real-classroom.sql in Supabase."
          : saveError.message || "Couldn't save the quiz."
      );
      setSaving(false);
    }
  }

  const totalPoints =
    questions.reduce((sum, question) => sum + (Number(question.points) || 0), 0);

  return (
    <form className="course-quiz-editor" onSubmit={save}>
      <div className="course-quiz-editor-head">
        <button type="button" className="course-button small" onClick={onCancel}>
          <ChevronLeft size={14} aria-hidden="true" />
          Back
        </button>
        <h3>{quiz ? "Edit quiz" : "New quiz"}</h3>
      </div>

      {error && <p className="course-error" role="alert">{error}</p>}

      <label className="course-field">
        <span>Title</span>
        <input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Week 4 quiz: Pointers" />
      </label>

      <label className="course-field">
        <span>Instructions <em>(optional)</em></span>
        <textarea rows={2} maxLength={3000} value={instructions} onChange={(event) => setInstructions(event.target.value)} />
      </label>

      <div className="course-field-row wrap">
        <label className="course-field">
          <span>Opens <em>(optional)</em></span>
          <input type="datetime-local" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} />
        </label>
        <label className="course-field">
          <span>Closes <em>(optional)</em></span>
          <input type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} />
        </label>
        <label className="course-field">
          <span>Time limit <em>(minutes)</em></span>
          <input type="number" min="1" max="300" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="No limit" />
        </label>
        <label className="course-field">
          <span>Weight <em>% of final</em></span>
          <input type="number" min="0" max="100" step="0.5" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="e.g. 5" />
        </label>
      </div>

      {locked ? (
        <p className="course-note">Students have already started this quiz, so only the settings above can change.</p>
      ) : loading ? (
        <p className="course-empty">Loading questions...</p>
      ) : (
        <>
          <ol className="course-quiz-questions">
            {questions.map((question, qIndex) => (
              <li key={qIndex}>
                <div className="course-quiz-q-head">
                  <strong>Question {qIndex + 1}</strong>
                  <label className="course-quiz-points">
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={question.points}
                      onChange={(event) => updateQuestion(qIndex, { points: event.target.value })}
                      aria-label={`Points for question ${qIndex + 1}`}
                    />
                    points
                  </label>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      className="course-icon-button"
                      onClick={() => setQuestions((current) => current.filter((_, i) => i !== qIndex))}
                      aria-label={`Remove question ${qIndex + 1}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <textarea
                  rows={2}
                  value={question.prompt}
                  maxLength={2000}
                  onChange={(event) => updateQuestion(qIndex, { prompt: event.target.value })}
                  placeholder="Type the question"
                  aria-label={`Question ${qIndex + 1}`}
                />

                <p className="course-muted">Tick the correct answer:</p>
                <ul className="course-quiz-options edit">
                  {question.options.map((option, oIndex) => (
                    <li key={oIndex} className={question.correct_index === oIndex ? "correct" : ""}>
                      <input
                        type="radio"
                        name={`correct-${qIndex}`}
                        checked={question.correct_index === oIndex}
                        onChange={() => updateQuestion(qIndex, { correct_index: oIndex })}
                        aria-label={`Answer ${oIndex + 1} is correct`}
                      />
                      <input
                        value={option}
                        maxLength={500}
                        onChange={(event) => updateOption(qIndex, oIndex, event.target.value)}
                        placeholder={`Answer ${String.fromCharCode(65 + oIndex)}`}
                        aria-label={`Answer ${String.fromCharCode(65 + oIndex)}`}
                      />
                      {question.options.length > 2 && (
                        <button type="button" className="course-icon-button" onClick={() => removeOption(qIndex, oIndex)} aria-label="Remove answer">
                          <X size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {question.options.length < 6 && (
                  <button type="button" className="course-button small" onClick={() => addOption(qIndex)}>
                    <Plus size={14} aria-hidden="true" />
                    Add answer
                  </button>
                )}
              </li>
            ))}
          </ol>

          <div className="course-actions">
            <button type="button" className="course-button" onClick={() => setQuestions((current) => [...current, blankQuestion()])}>
              <Plus size={15} aria-hidden="true" />
              Add question
            </button>
            <span className="course-muted">{questions.length} questions · {roundOne(totalPoints)} points</span>
          </div>
        </>
      )}

      <div className="course-actions right">
        <button type="button" className="course-button" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="course-button primary" disabled={saving || loading}>
          {saving ? "Saving..." : "Save quiz"}
        </button>
      </div>
      {!quiz && <p className="course-muted">The quiz is saved as a draft. Students see it after you click Publish.</p>}
    </form>
  );
}


// ---------------------------------------------------------
// TEACHER: results
// ---------------------------------------------------------

function QuizResults({ quiz, attempts, students, onBack }) {
  const done =
    attempts.filter((row) => row.submitted_at);

  const average =
    done.length && done[0].max_score
      ? roundOne(done.reduce((sum, row) => sum + Number(row.score || 0) / Number(row.max_score || 1), 0) / done.length * 100)
      : null;

  return (
    <div className="course-quiz-results">
      <div className="course-quiz-editor-head">
        <button type="button" className="course-button small" onClick={onBack}>
          <ChevronLeft size={14} aria-hidden="true" />
          Back
        </button>
        <h3>{quiz.title}: results</h3>
      </div>

      <div className="course-mini-stats">
        <span><strong>{done.length}</strong> of {students.length} done</span>
        {average !== null && <span>Average <strong>{average}%</strong></span>}
      </div>

      <div className="course-table-wrap">
        <table className="course-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Score</th>
              <th>Handed in</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const attempt = attempts.find((row) => row.student_id === student.id);
              return (
                <tr key={student.id}>
                  <td data-label="Student">
                    <strong>{student.full_name}</strong>
                    <small className="course-muted">{student.campus_id}</small>
                  </td>
                  <td data-label="Score">
                    {attempt?.submitted_at
                      ? <strong>{roundOne(Number(attempt.score))} / {roundOne(Number(attempt.max_score))}</strong>
                      : attempt ? <span className="course-chip late">Started</span> : "—"}
                  </td>
                  <td data-label="Handed in">{attempt?.submitted_at ? formatDateTime(attempt.submitted_at) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ---------------------------------------------------------
// STUDENT: take the quiz
// ---------------------------------------------------------

function storageKey(quizId) {
  return `campusmate-quiz-${quizId}`;
}

function readSaved(quizId) {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(quizId)) || "null");
  } catch {
    return null;
  }
}

function writeSaved(quizId, value) {
  try {
    if (value === null) window.localStorage.removeItem(storageKey(quizId));
    else window.localStorage.setItem(storageKey(quizId), JSON.stringify(value));
  } catch {
    // Private mode: answers just aren't kept on refresh
  }
}


function QuizTaker({ quiz, onDone, onBack }) {
  const [paper, setPaper] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const sentRef = useRef(false);

  useEffect(() => {
    let active = true;

    supabase.rpc("start_quiz", { input_quiz_id: quiz.id }).then(({ data, error: startError }) => {
      if (!active) return;

      if (startError) {
        setError(startError.message);
        return;
      }

      const saved = readSaved(quiz.id);
      setPaper(data);
      setAnswers(
        saved?.attempt === data.attempt_id && Array.isArray(saved.answers)
          ? saved.answers
          : data.questions.map(() => -1)
      );
    });

    return () => {
      active = false;
    };
  }, [quiz.id]);

  const submit = useCallback(async (auto = false) => {
    if (sentRef.current || !paper) return;

    if (!auto) {
      const blank = answers.filter((value) => value < 0).length;
      const text = blank
        ? `You haven't answered ${blank} ${blank === 1 ? "question" : "questions"}. Hand in anyway?`
        : "Hand in your answers? You can't change them afterwards.";
      if (!window.confirm(text)) return;
    }

    sentRef.current = true;
    setSubmitting(true);

    const { data, error: submitError } =
      await supabase.rpc("submit_quiz", { input_quiz_id: quiz.id, input_answers: answers });

    setSubmitting(false);

    if (submitError) {
      sentRef.current = false;
      setError(submitError.message);
      return;
    }

    writeSaved(quiz.id, null);
    setResult(data);
  }, [answers, paper, quiz.id]);

  // Timer + auto hand-in when time runs out
  useEffect(() => {
    if (!paper?.deadline || result) return undefined;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [paper, result]);

  const secondsLeft =
    paper?.deadline ? Math.max(0, Math.floor((new Date(paper.deadline).getTime() - now) / 1000)) : null;

  useEffect(() => {
    if (secondsLeft === 0 && !result && !sentRef.current) {
      // Time is up: hand in automatically
      submit(true);
    }
  }, [secondsLeft, result, submit]);

  function choose(index, option) {
    setAnswers((current) => {
      const next = current.map((value, i) => (i === index ? option : value));
      writeSaved(quiz.id, { attempt: paper.attempt_id, answers: next });
      return next;
    });
  }

  if (result) {
    const percent =
      result.max_score ? Math.round((Number(result.score) / Number(result.max_score)) * 100) : 0;

    return (
      <div className="course-quiz-done">
        <CheckCircle2 size={40} aria-hidden="true" />
        <h3>Handed in</h3>
        <p className="course-quiz-score">
          {roundOne(Number(result.score))} / {roundOne(Number(result.max_score))} <span>({percent}%)</span>
        </p>
        <p className="course-muted">
          {quiz.closes_at && new Date(quiz.closes_at) > new Date()
            ? `You can see the correct answers after the quiz closes on ${formatDateTime(quiz.closes_at)}.`
            : "You can now review the correct answers."}
        </p>
        <button type="button" className="course-button primary" onClick={onDone}>Done</button>
      </div>
    );
  }

  return (
    <div className="course-quiz-taker">
      <div className="course-quiz-editor-head sticky">
        <button type="button" className="course-button small" onClick={onBack}>
          <ChevronLeft size={14} aria-hidden="true" />
          Leave
        </button>
        <h3>{quiz.title}</h3>
        {secondsLeft !== null && (
          <span className={`course-quiz-timer ${secondsLeft < 60 ? "urgent" : ""}`} role="timer" aria-live="off">
            <Clock size={15} aria-hidden="true" />
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
          </span>
        )}
      </div>

      {error && <p className="course-error" role="alert">{error}</p>}

      {!paper && !error && <p className="course-empty">Opening quiz...</p>}

      {paper && (
        <>
          {quiz.instructions && <p className="course-about">{quiz.instructions}</p>}
          <p className="course-muted">
            Your answers are saved on this device as you go. If you leave, the timer keeps running.
          </p>

          <ol className="course-quiz-questions">
            {paper.questions.map((question, qIndex) => (
              <li key={question.id}>
                <div className="course-quiz-q-head">
                  <strong>Question {qIndex + 1}</strong>
                  <span className="course-muted">{roundOne(Number(question.points))} {Number(question.points) === 1 ? "point" : "points"}</span>
                </div>
                <p className="course-quiz-prompt">{question.prompt}</p>
                <ul className="course-quiz-options">
                  {question.options.map((option, oIndex) => (
                    <li key={oIndex}>
                      <label className={answers[qIndex] === oIndex ? "chosen" : ""}>
                        <input
                          type="radio"
                          name={`q-${question.id}`}
                          checked={answers[qIndex] === oIndex}
                          onChange={() => choose(qIndex, oIndex)}
                        />
                        <span className="course-quiz-letter">{String.fromCharCode(65 + oIndex)}</span>
                        <span>{option}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <div className="course-actions right">
            <span className="course-muted">
              {answers.filter((value) => value >= 0).length} of {paper.questions.length} answered
            </span>
            <button type="button" className="course-button primary" onClick={() => submit(false)} disabled={submitting}>
              {submitting ? "Handing in..." : "Hand in"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}


function QuizReview({ quiz, onBack }) {
  const [review, setReview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    supabase.rpc("review_quiz", { input_quiz_id: quiz.id }).then(({ data, error: reviewError }) => {
      if (!active) return;
      if (reviewError) setError(reviewError.message);
      else setReview(data);
    });
    return () => {
      active = false;
    };
  }, [quiz.id]);

  return (
    <div className="course-quiz-taker">
      <div className="course-quiz-editor-head">
        <button type="button" className="course-button small" onClick={onBack}>
          <ChevronLeft size={14} aria-hidden="true" />
          Back
        </button>
        <h3>{quiz.title}: your answers</h3>
      </div>

      {error && <p className="course-note">{error}</p>}

      {review && (
        <>
          <p className="course-quiz-score">
            {roundOne(Number(review.score))} / {roundOne(Number(review.max_score))}
          </p>
          <ol className="course-quiz-questions">
            {review.questions.map((question, qIndex) => (
              <li key={qIndex}>
                <div className="course-quiz-q-head">
                  <strong>Question {qIndex + 1}</strong>
                  <span className={`course-chip ${question.picked === question.correct_index ? "submitted" : "missing"}`}>
                    {question.picked === question.correct_index ? "Correct" : question.picked < 0 ? "No answer" : "Wrong"}
                  </span>
                </div>
                <p className="course-quiz-prompt">{question.prompt}</p>
                <ul className="course-quiz-options">
                  {question.options.map((option, oIndex) => (
                    <li key={oIndex}>
                      <label
                        className={[
                          oIndex === question.correct_index ? "correct" : "",
                          oIndex === question.picked && oIndex !== question.correct_index ? "wrong" : "",
                        ].join(" ")}
                      >
                        <span className="course-quiz-letter">{String.fromCharCode(65 + oIndex)}</span>
                        <span>{option}</span>
                        {oIndex === question.picked && <small>Your answer</small>}
                      </label>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}


// ---------------------------------------------------------
// LIST
// ---------------------------------------------------------

function CourseQuizzes({ groupId, userId, isTeacher, quizzes, attempts, students, onChanged }) {
  const [view, setView] = useState({ mode: "list" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted =
    [...quizzes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  async function setPublished(quiz, published) {
    setBusy(true);
    setError("");
    const { error: updateError } = await supabase.from("quizzes").update({ is_published: published }).eq("id", quiz.id);
    setBusy(false);
    if (updateError) setError(updateError.message);
    else onChanged();
  }

  async function remove(quiz) {
    const count = attempts.filter((row) => row.quiz_id === quiz.id).length;
    if (!window.confirm(count ? `Delete "${quiz.title}" and ${count} students' results?` : `Delete "${quiz.title}"?`)) return;
    const { error: deleteError } = await supabase.from("quizzes").delete().eq("id", quiz.id);
    if (deleteError) setError(deleteError.message);
    else onChanged();
  }

  const finish = () => {
    setView({ mode: "list" });
    onChanged();
  };

  if (view.mode === "edit") {
    return (
      <section className="course-section">
        <QuizEditor
          groupId={groupId}
          userId={userId}
          quiz={view.quiz}
          locked={Boolean(view.quiz && attempts.some((row) => row.quiz_id === view.quiz.id))}
          onCancel={() => setView({ mode: "list" })}
          onDone={finish}
        />
      </section>
    );
  }

  if (view.mode === "results") {
    return (
      <section className="course-section">
        <QuizResults
          quiz={view.quiz}
          attempts={attempts.filter((row) => row.quiz_id === view.quiz.id)}
          students={students}
          onBack={() => setView({ mode: "list" })}
        />
      </section>
    );
  }

  if (view.mode === "take") {
    return (
      <section className="course-section">
        <QuizTaker quiz={view.quiz} onBack={finish} onDone={finish} />
      </section>
    );
  }

  if (view.mode === "review") {
    return (
      <section className="course-section">
        <QuizReview quiz={view.quiz} onBack={() => setView({ mode: "list" })} />
      </section>
    );
  }

  return (
    <section className="course-section">
      <header className="course-section-head">
        <h2>
          <ListChecks size={19} aria-hidden="true" />
          Quizzes
        </h2>
        {isTeacher && (
          <button type="button" className="course-button small primary" onClick={() => setView({ mode: "edit", quiz: null })}>
            <Plus size={14} aria-hidden="true" />
            New quiz
          </button>
        )}
      </header>

      {error && <p className="course-error" role="alert">{error}</p>}

      {sorted.length === 0 ? (
        <p className="course-empty">
          {isTeacher ? "No quizzes yet. Multiple-choice quizzes are marked automatically." : "No quizzes yet."}
        </p>
      ) : (
        <ul className="course-quiz-list">
          {sorted.map((quiz) => {
            const state = quizState(quiz);
            const quizAttempts = attempts.filter((row) => row.quiz_id === quiz.id);
            const mine = quizAttempts.find((row) => row.student_id === userId);
            const closed = quiz.closes_at && new Date(quiz.closes_at) < new Date();
            const notOpen = quiz.opens_at && new Date(quiz.opens_at) > new Date();

            return (
              <li key={quiz.id}>
                <span className="course-activity-icon quiz">
                  <ListChecks size={18} aria-hidden="true" />
                </span>
                <div className="course-quiz-info">
                  <strong>{quiz.title}</strong>
                  <small>
                    {quiz.time_limit_minutes ? `${quiz.time_limit_minutes} min · ` : ""}
                    {quiz.weight ? `${Number(quiz.weight)}% of final · ` : ""}
                    {isTeacher
                      ? `${quizAttempts.filter((row) => row.submitted_at).length}/${students.length} done`
                      : mine?.submitted_at
                        ? `Your score: ${roundOne(Number(mine.score))} / ${roundOne(Number(mine.max_score))}`
                        : closed ? "Closed" : ""}
                  </small>
                </div>
                <span className={`course-chip ${state.key}`}>{state.label}</span>

                <div className="course-quiz-buttons">
                  {isTeacher ? (
                    <>
                      <button type="button" className="course-button small" onClick={() => setView({ mode: "edit", quiz })}>
                        <Pencil size={14} aria-hidden="true" />
                        Edit
                      </button>
                      {quiz.is_published ? (
                        <button type="button" className="course-button small" onClick={() => setPublished(quiz, false)} disabled={busy}>
                          <EyeOff size={14} aria-hidden="true" />
                          Unpublish
                        </button>
                      ) : (
                        <button type="button" className="course-button small primary" onClick={() => setPublished(quiz, true)} disabled={busy}>
                          <Eye size={14} aria-hidden="true" />
                          Publish
                        </button>
                      )}
                      <button type="button" className="course-button small" onClick={() => setView({ mode: "results", quiz })}>
                        <BarChart3 size={14} aria-hidden="true" />
                        Results
                      </button>
                      <button type="button" className="course-icon-button" onClick={() => remove(quiz)} aria-label={`Delete ${quiz.title}`}>
                        <Trash2 size={15} />
                      </button>
                    </>
                  ) : mine?.submitted_at ? (
                    <button type="button" className="course-button small" onClick={() => setView({ mode: "review", quiz })}>
                      Review answers
                    </button>
                  ) : !closed && !notOpen ? (
                    <button
                      type="button"
                      className="course-button small primary"
                      onClick={() => {
                        const text = quiz.time_limit_minutes
                          ? `Start "${quiz.title}"? You have ${quiz.time_limit_minutes} minutes once you start, and you can only take it once.`
                          : `Start "${quiz.title}"? You can only hand it in once.`;
                        if (mine || window.confirm(text)) setView({ mode: "take", quiz });
                      }}
                    >
                      {mine ? "Continue" : "Start quiz"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default CourseQuizzes;
