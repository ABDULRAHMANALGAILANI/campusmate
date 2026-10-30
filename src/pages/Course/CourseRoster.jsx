import { useState } from "react";

import {
  FileUp,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import UserAvatar from "../../components/UserAvatar";

import {
  LOW_ATTENDANCE,
  readIds,
} from "../../lib/courseHelpers";


// =========================================================
// PARTICIPANTS TAB
//   everyone in the class (professor, co-lecturers, tutors,
//   students) + teacher tools:
//     - add many students at once (paste or CSV)
//     - owner adds/removes co-lecturers and tutors
// =========================================================

const RESULT_TEXT = {
  added: "Added",
  already: "Already in this class",
  not_found: "No account found",
  not_student: "Not a student account",
  other_school: "Not in your school",
};


function BulkAdd({ groupId, onChanged }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);

  async function loadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setError("That file is too big. Use a CSV under 1 MB.");
      return;
    }

    const content = await file.text();
    setText((current) => [current.trim(), readIds(content).join("\n")].filter(Boolean).join("\n"));
  }

  async function add() {
    setError("");
    setResults(null);

    const ids = readIds(text);

    if (ids.length === 0) {
      setError("Paste at least one CampusMate ID, matric number or email.");
      return;
    }

    if (ids.length > 500) {
      setError("Add up to 500 students at a time.");
      return;
    }

    setBusy(true);

    const { data, error: addError } =
      await supabase.rpc("add_students_to_class", {
        input_group_id: groupId,
        input_ids: ids,
      });

    setBusy(false);

    if (addError) {
      setError(
        /add_students_to_class|schema cache/i.test(addError.message)
          ? "Run supabase/14-real-classroom.sql in Supabase first."
          : addError.message
      );
      return;
    }

    setResults(data || []);

    if ((data || []).some((row) => row.result === "added")) {
      setText(
        (data || [])
          .filter((row) => row.result !== "added" && row.result !== "already")
          .map((row) => row.input)
          .join("\n")
      );
      onChanged();
    }
  }

  const counts =
    (results || []).reduce((all, row) => ({ ...all, [row.result]: (all[row.result] || 0) + 1 }), {});

  const problems =
    (results || []).filter((row) => row.result !== "added" && row.result !== "already");

  return (
    <div className="course-tool">
      <h3>
        <UserPlus size={17} aria-hidden="true" />
        Add students
      </h3>
      <p className="course-muted">
        Paste CampusMate IDs (STU-…), matric numbers or emails. One per line, or separated by commas.
        You can also upload the class list as a CSV.
      </p>

      <label className="course-field">
        <span className="course-sr-only">Students to add</span>
        <textarea
          rows={5}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"STU-2026000123\nA21CS0456\naisha@student.usm.my"}
        />
      </label>

      {error && <p className="course-error" role="alert">{error}</p>}

      <div className="course-actions">
        <button type="button" className="course-button primary" onClick={add} disabled={busy}>
          <UserPlus size={16} aria-hidden="true" />
          {busy ? "Adding..." : `Add ${readIds(text).length || ""} ${readIds(text).length === 1 ? "student" : "students"}`}
        </button>
        <label className="course-button course-file-button">
          <FileUp size={16} aria-hidden="true" />
          Upload CSV
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={loadFile} />
        </label>
      </div>

      {results && (
        <div className="course-results" role="status">
          <p>
            <strong>{counts.added || 0} added</strong>
            {counts.already ? ` · ${counts.already} already in the class` : ""}
            {problems.length ? ` · ${problems.length} not added` : ""}
          </p>
          {problems.length > 0 && (
            <ul>
              {problems.map((row) => (
                <li key={row.input}>
                  <code>{row.input}</code> {row.student_name ? `(${row.student_name})` : ""}: {RESULT_TEXT[row.result] || row.result}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}


function AddTeacher({ groupId, onChanged }) {
  const [who, setWho] = useState("");
  const [title, setTitle] = useState("Co-lecturer");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function add(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!who.trim()) {
      setError("Enter their CampusMate ID (PRO-…) or email.");
      return;
    }

    setBusy(true);

    const { data, error: addError } =
      await supabase.rpc("add_class_teacher", {
        input_group_id: groupId,
        input_who: who.trim(),
        input_title: title,
      });

    setBusy(false);

    if (addError) {
      setError(
        /add_class_teacher|schema cache/i.test(addError.message)
          ? "Run supabase/14-real-classroom.sql in Supabase first."
          : addError.message
      );
      return;
    }

    setWho("");
    setMessage(`${data} was added as ${title.toLowerCase()}.`);
    onChanged();
  }

  return (
    <form className="course-tool" onSubmit={add}>
      <h3>
        <Users size={17} aria-hidden="true" />
        Co-lecturers and tutors
      </h3>
      <p className="course-muted">
        They can post, mark, take attendance and answer questions in this class.
        Only you can add or remove them.
      </p>

      <div className="course-field-row">
        <label className="course-field">
          <span>CampusMate ID or email</span>
          <input value={who} onChange={(event) => setWho(event.target.value)} placeholder="PRO-2026000012" />
        </label>
        <label className="course-field course-field-narrow">
          <span>Role</span>
          <select value={title} onChange={(event) => setTitle(event.target.value)}>
            <option>Co-lecturer</option>
            <option>Tutor</option>
          </select>
        </label>
      </div>

      {error && <p className="course-error" role="alert">{error}</p>}
      {message && <p className="course-success" role="status">{message}</p>}

      <div className="course-actions">
        <button type="submit" className="course-button primary" disabled={busy}>
          <UserPlus size={16} aria-hidden="true" />
          {busy ? "Adding..." : "Add teacher"}
        </button>
      </div>
    </form>
  );
}


function CourseRoster({
  groupId,
  userId,
  professor,
  teachers,
  students,
  isTeacher,
  isOwner,
  assignmentCount,
  handedInCount,
  attendanceByStudent,
  onChanged,
}) {
  const [error, setError] = useState("");

  async function removeTeacher(person) {
    const leaving =
      person.id === userId;

    if (!window.confirm(leaving ? "Leave this class as a teacher?" : `Remove ${person.full_name} from this class?`)) {
      return;
    }

    const { error: removeError } =
      await supabase.rpc("remove_class_teacher", {
        input_group_id: groupId,
        input_teacher_id: person.id,
      });

    if (removeError) {
      setError(removeError.message);
      return;
    }

    if (leaving) {
      window.location.assign("/professor/classes");
      return;
    }

    onChanged();
  }

  const everyone =
    [...(professor ? [professor] : []), ...teachers, ...students];

  return (
    <div className="course-sections">
      {isTeacher && (
        <div className="course-tools-grid">
          <BulkAdd groupId={groupId} onChanged={onChanged} />
          {isOwner && <AddTeacher groupId={groupId} onChanged={onChanged} />}
        </div>
      )}

      <section className="course-section">
        <header className="course-section-head">
          <h2>
            <Users size={19} aria-hidden="true" />
            {everyone.length} {everyone.length === 1 ? "participant" : "participants"}
          </h2>
        </header>

        {error && <p className="course-error" role="alert">{error}</p>}

        <ul className="course-people">
          {everyone.map((person) => {
            const attendance =
              attendanceByStudent.get(person.id);

            return (
              <li key={`${person.role}-${person.id}`}>
                <UserAvatar profile={person} userId={person.id} name={person.full_name} size={42} />
                <div>
                  <strong>{person.full_name}{person.id === userId ? " (you)" : ""}</strong>
                  <small>
                    {[person.campus_id, person.programme].filter(Boolean).join(" · ")}
                  </small>
                </div>

                {isTeacher && person.role === "student" ? (
                  <span className="course-person-progress">
                    <span>
                      {handedInCount(person.id)}/{assignmentCount} handed in
                    </span>
                    {attendance?.percent !== null && attendance?.percent !== undefined && (
                      <span className={`course-chip ${attendance.percent < LOW_ATTENDANCE ? "missing" : "submitted"}`}>
                        {attendance.percent}% attendance
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="course-person-progress">
                    <span className={`course-chip ${person.role === "student" ? "neutral" : "professor"}`}>
                      {person.role === "student" ? "Student" : person.title || "Professor"}
                    </span>
                    {person.role === "teacher" && (isOwner || person.id === userId) && (
                      <button
                        type="button"
                        className="course-icon-button"
                        onClick={() => removeTeacher(person)}
                        aria-label={person.id === userId ? "Leave this class" : `Remove ${person.full_name}`}
                        title={person.id === userId ? "Leave" : "Remove"}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default CourseRoster;
