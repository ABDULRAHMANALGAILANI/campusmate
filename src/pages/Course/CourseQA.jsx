import {
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  ChevronDown,
  MessageCircleQuestion,
  Plus,
  Send,
  Trash2,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import UserAvatar from "../../components/UserAvatar";

import { formatDateTime } from "../../lib/courseHelpers";


// =========================================================
// Q&A TAB
// Anyone in the class asks; anyone answers. Teachers' answers
// are labelled, so 50 students don't message the professor
// the same question privately.
// =========================================================

function AskForm({ groupId, userId, onDone, onCancel }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function ask(event) {
    event.preventDefault();
    setError("");

    if (title.trim().length < 3) {
      setError("Write your question in a few words.");
      return;
    }

    setSaving(true);

    const { error: insertError } =
      await supabase
        .from("course_questions")
        .insert({
          group_id: groupId,
          author_id: userId,
          title: title.trim(),
          body: body.trim() || null,
        });

    setSaving(false);

    if (insertError) {
      setError(
        /course_questions|schema cache/i.test(insertError.message)
          ? "Q&A isn't set up yet. Run supabase/14-real-classroom.sql in Supabase."
          : insertError.message
      );
      return;
    }

    onDone();
  }

  return (
    <form className="course-post-form" onSubmit={ask}>
      {error && <p className="course-error" role="alert">{error}</p>}
      <label className="course-field">
        <span>Question</span>
        <input
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Is Lab 3 individual or group work?"
          autoFocus
        />
      </label>
      <label className="course-field">
        <span>Details <em>(optional)</em></span>
        <textarea rows={3} maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} />
      </label>
      <div className="course-actions">
        <button type="submit" className="course-button primary" disabled={saving}>
          {saving ? "Posting..." : "Post question"}
        </button>
        <button type="button" className="course-button" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}


function Question({ question, answers, people, userId, isTeacher, onChanged }) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const author =
    people.get(question.author_id);

  const answeredByTeacher =
    answers.some((answer) => ["professor", "teacher"].includes(people.get(answer.author_id)?.role));

  const canManage =
    isTeacher || question.author_id === userId;

  async function send(event) {
    event.preventDefault();
    if (!reply.trim()) return;

    setBusy(true);
    setError("");

    const { error: insertError } =
      await supabase
        .from("course_answers")
        .insert({
          question_id: question.id,
          group_id: question.group_id,
          author_id: userId,
          body: reply.trim(),
        });

    setBusy(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setReply("");
    onChanged();
  }

  async function toggleResolved() {
    setBusy(true);
    const { error: updateError } =
      await supabase
        .from("course_questions")
        .update({ is_resolved: !question.is_resolved })
        .eq("id", question.id);
    setBusy(false);
    if (updateError) setError(updateError.message);
    else onChanged();
  }

  async function remove(table, id, text) {
    if (!window.confirm(text)) return;
    const { error: deleteError } = await supabase.from(table).delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else onChanged();
  }

  return (
    <li className={`course-question ${open ? "open" : ""}`}>
      <button type="button" className="course-question-row" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="course-activity-icon question">
          <MessageCircleQuestion size={18} aria-hidden="true" />
        </span>
        <span className="course-assignment-title">
          <strong>{question.title}</strong>
          <small>
            {author?.full_name || "Someone"} · {formatDateTime(question.created_at)}
          </small>
        </span>
        <span className="course-question-tags">
          {question.is_resolved && <span className="course-chip submitted">Solved</span>}
          {!question.is_resolved && answeredByTeacher && <span className="course-chip professor">Professor replied</span>}
          <span className="course-chip neutral">{answers.length} {answers.length === 1 ? "answer" : "answers"}</span>
        </span>
        <ChevronDown size={18} className="course-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="course-question-body">
          {question.body && <p className="course-question-text">{question.body}</p>}

          <ul className="course-answers">
            {answers.map((answer) => {
              const who = people.get(answer.author_id);
              const teacher = ["professor", "teacher"].includes(who?.role);

              return (
                <li key={answer.id} className={teacher ? "teacher" : ""}>
                  <UserAvatar profile={who} userId={answer.author_id} name={who?.full_name} size={30} />
                  <div>
                    <strong>
                      {who?.full_name || "Someone"}
                      {teacher && <span className="course-chip professor">{who.title || "Professor"}</span>}
                    </strong>
                    <p>{answer.body}</p>
                    <small className="course-muted">{formatDateTime(answer.created_at)}</small>
                  </div>
                  {(isTeacher || answer.author_id === userId) && (
                    <button
                      type="button"
                      className="course-icon-button"
                      onClick={() => remove("course_answers", answer.id, "Delete this answer?")}
                      aria-label="Delete answer"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <form className="course-reply" onSubmit={send}>
            <input
              value={reply}
              maxLength={5000}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Write an answer..."
              aria-label="Your answer"
            />
            <button type="submit" className="course-button primary small" disabled={busy || !reply.trim()}>
              <Send size={14} aria-hidden="true" />
              Answer
            </button>
          </form>

          {error && <p className="course-error" role="alert">{error}</p>}

          {canManage && (
            <div className="course-actions">
              <button type="button" className="course-button small" onClick={toggleResolved} disabled={busy}>
                <CheckCircle2 size={14} aria-hidden="true" />
                {question.is_resolved ? "Mark as not solved" : "Mark as solved"}
              </button>
              <button
                type="button"
                className="course-button small danger"
                onClick={() => remove("course_questions", question.id, "Delete this question and its answers?")}
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}


function CourseQA({ groupId, userId, isTeacher, participants, questions, answers, onChanged }) {
  const [asking, setAsking] = useState(false);
  const [filter, setFilter] = useState("all");

  const people = useMemo(
    () => new Map(participants.map((person) => [person.id, person])),
    [participants]
  );

  const answersByQuestion = useMemo(() => {
    const map = new Map();
    for (const answer of answers) {
      map.set(answer.question_id, [...(map.get(answer.question_id) || []), answer]);
    }
    return map;
  }, [answers]);

  const shown =
    questions.filter((question) => {
      if (filter === "open") return !question.is_resolved && !(answersByQuestion.get(question.id) || []).length;
      if (filter === "mine") return question.author_id === userId;
      return true;
    });

  return (
    <section className="course-section">
      <header className="course-section-head">
        <h2>
          <MessageCircleQuestion size={19} aria-hidden="true" />
          Questions &amp; answers
        </h2>
        {!asking && (
          <button type="button" className="course-button small primary" onClick={() => setAsking(true)}>
            <Plus size={14} aria-hidden="true" />
            Ask a question
          </button>
        )}
      </header>

      <p className="course-muted course-qa-intro">
        Ask here instead of messaging privately: everyone in the class sees the answer.
      </p>

      {asking && (
        <AskForm
          groupId={groupId}
          userId={userId}
          onCancel={() => setAsking(false)}
          onDone={() => { setAsking(false); onChanged(); }}
        />
      )}

      <div className="course-filter" role="group" aria-label="Show">
        {[
          ["all", "All"],
          ["open", "No answer yet"],
          ["mine", "Mine"],
        ].map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="course-empty">
          {questions.length === 0 ? "No questions yet. Be the first to ask." : "Nothing here."}
        </p>
      ) : (
        <ul className="course-question-list">
          {shown.map((question) => (
            <Question
              key={question.id}
              question={question}
              answers={answersByQuestion.get(question.id) || []}
              people={people}
              userId={userId}
              isTeacher={isTeacher}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default CourseQA;
