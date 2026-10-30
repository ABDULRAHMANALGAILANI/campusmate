import {
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  Paperclip,
  Pencil,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import {
  SUBMISSION_LIMIT_MB,
  formatSize,
  openFile,
  removeFile,
  tooBig,
  uploadSubmission,
} from "../../lib/courseFiles";

import UserAvatar from "../../components/UserAvatar";

import {
  formatDateTime,
  formatMark,
  submissionStatus,
  timeLeft,
} from "../../lib/courseHelpers";


// =========================================================
// ASSIGNMENTS (inside a course page)
// Student: read the brief, download the question sheet,
//          hand in a file + comment, see the released mark.
// Teacher: edit, see who handed in, download, mark + feedback,
//          release marks when ready.
// =========================================================

function BriefFile({ assignment, onError }) {
  if (!assignment.file_path) return null;

  async function download() {
    try {
      await openFile("course-files", assignment.file_path, assignment.file_name);
    } catch (error) {
      onError(error.message);
    }
  }

  return (
    <button type="button" className="course-file-link course-brief-file" onClick={download}>
      <Download size={15} aria-hidden="true" />
      {assignment.file_name}
    </button>
  );
}

// ---------------------------------------------------------
// STUDENT PANEL
// ---------------------------------------------------------

function StudentPanel({
  assignment,
  submission,
  groupId,
  userId,
  onChanged,
}) {
  const [file, setFile] = useState(null);
  const handedIn =
    submission && !submission.synthetic ? submission : null;

  const [comment, setComment] = useState(handedIn?.comment || "");
  const [editing, setEditing] = useState(!handedIn);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const status =
    submissionStatus(assignment, submission);

  const graded =
    status.key === "graded";

  // Professor turned off late hand-ins and the deadline has passed
  const closed =
    assignment.allow_late === false &&
    assignment.due_at &&
    new Date(assignment.due_at) < new Date();


  async function save(event) {
    event.preventDefault();
    setError("");

    if (!file && !handedIn?.file_path) {
      setError("Choose the file you want to hand in.");
      return;
    }

    if (tooBig(file, SUBMISSION_LIMIT_MB)) {
      setError(`That file is too big. The limit is ${SUBMISSION_LIMIT_MB} MB.`);
      return;
    }

    setSaving(true);

    try {
      let filePath = handedIn?.file_path || null;
      let fileName = handedIn?.file_name || null;
      let fileSize = handedIn?.file_size || null;

      if (file) {
        filePath =
          await uploadSubmission(groupId, assignment.id, userId, file);
        fileName = file.name;
        fileSize = file.size;
      }

      const row = {
        assignment_id: assignment.id,
        group_id: groupId,
        student_id: userId,
        comment: comment.trim() || null,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
      };

      const { error: saveError } =
        handedIn
          ? await supabase
              .from("assignment_submissions")
              .update(row)
              .eq("id", handedIn.id)
          : await supabase
              .from("assignment_submissions")
              .insert(row);

      if (saveError) {
        if (file) await removeFile("submissions", filePath);
        throw saveError;
      }

      // Replaced file: remove the old one
      if (file && handedIn?.file_path && handedIn.file_path !== filePath) {
        await removeFile("submissions", handedIn.file_path);
      }

      setFile(null);
      setEditing(false);
      onChanged();
    } catch (saveError) {
      setError(saveError.message || "Couldn't hand in your work. Try again.");
    } finally {
      setSaving(false);
    }
  }


  async function removeSubmission() {
    if (!window.confirm("Remove your submission? You can hand in again before the deadline.")) {
      return;
    }

    setSaving(true);
    setError("");

    const { error: deleteError } =
      await supabase
        .from("assignment_submissions")
        .delete()
        .eq("id", handedIn.id);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    await removeFile("submissions", handedIn.file_path);
    setSaving(false);
    setEditing(true);
    setComment("");
    onChanged();
  }


  async function download() {
    try {
      await openFile("submissions", handedIn.file_path, handedIn.file_name);
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }


  const markOnly =
    assignment.hand_in === false;

  const notMarkedText =
    assignment.marks_released === false && (submission || markOnly)
      ? "Marks not released yet"
      : assignment.points
        ? `Not marked yet (out of ${assignment.points})`
        : "Not marked yet";

  if (markOnly) {
    return (
      <div className="course-assignment-body">
        {assignment.description && (
          <p className="course-assignment-brief">{assignment.description}</p>
        )}
        <BriefFile assignment={assignment} onError={setError} />

        <table className="course-status-table">
          <tbody>
            <tr>
              <th>Date</th>
              <td>{formatDateTime(assignment.due_at)}</td>
            </tr>
            <tr>
              <th>Hand-in</th>
              <td>Nothing to hand in here. Your professor enters the mark.</td>
            </tr>
            <tr>
              <th>Mark</th>
              <td>{graded ? <strong>{formatMark(submission.grade, assignment.points)}</strong> : notMarkedText}</td>
            </tr>
            {submission?.feedback && (
              <tr>
                <th>Feedback</th>
                <td className="course-feedback">{submission.feedback}</td>
              </tr>
            )}
          </tbody>
        </table>
        {error && <p className="course-error" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="course-assignment-body">

      {assignment.description && (
        <p className="course-assignment-brief">
          {assignment.description}
        </p>
      )}

      <BriefFile assignment={assignment} onError={setError} />

      <h4>Submission status</h4>

      <table className="course-status-table">
        <tbody>
          <tr>
            <th>Status</th>
            <td>
              <span className={`course-chip ${status.key}`}>{status.label}</span>
            </td>
          </tr>
          <tr>
            <th>Due</th>
            <td>
              {formatDateTime(assignment.due_at)}
              {assignment.allow_late === false && (
                <small className="course-muted">Late work is not accepted</small>
              )}
            </td>
          </tr>
          {!handedIn && assignment.due_at && (
            <tr>
              <th>Time left</th>
              <td className={new Date(assignment.due_at) < new Date() ? "course-overdue" : ""}>
                {timeLeft(assignment.due_at)}
              </td>
            </tr>
          )}
          {submission && !submission.synthetic && (
            <>
              <tr>
                <th>Handed in</th>
                <td>{formatDateTime(submission.submitted_at)}</td>
              </tr>
              <tr>
                <th>File</th>
                <td>
                  {submission.file_path ? (
                    <button type="button" className="course-file-link" onClick={download}>
                      <Paperclip size={15} aria-hidden="true" />
                      {submission.file_name}
                      <small>{formatSize(submission.file_size)}</small>
                    </button>
                  ) : "—"}
                </td>
              </tr>
              {submission.comment && (
                <tr>
                  <th>Your comment</th>
                  <td>{submission.comment}</td>
                </tr>
              )}
            </>
          )}
          <tr>
            <th>Mark</th>
            <td>
              {graded
                ? <strong>{formatMark(submission.grade, assignment.points)}</strong>
                : notMarkedText}
            </td>
          </tr>
          {submission?.feedback && (
            <tr>
              <th>Feedback</th>
              <td className="course-feedback">{submission.feedback}</td>
            </tr>
          )}
        </tbody>
      </table>

      {error && <p className="course-error" role="alert">{error}</p>}

      {graded ? (
        <p className="course-note">
          <CheckCircle2 size={16} aria-hidden="true" />
          Your professor has marked this, so it can't be changed.
        </p>
      ) : closed ? (
        <p className="course-note closed">
          <Clock size={16} aria-hidden="true" />
          {handedIn
            ? "The deadline has passed, so your submission can't be changed."
            : "The deadline has passed and your professor isn't accepting late work."}
        </p>
      ) : editing ? (
        <form className="course-submit-form" onSubmit={save}>
          <label className="course-dropzone">
            <Upload size={20} aria-hidden="true" />
            <span>
              {file
                ? <><strong>{file.name}</strong> ({formatSize(file.size)})</>
                : handedIn?.file_name
                  ? <>Choose a new file to replace <strong>{handedIn.file_name}</strong></>
                  : <>Choose your file <small>(PDF, Word, PowerPoint, zip… up to {SUBMISSION_LIMIT_MB} MB)</small></>}
            </span>
            <input
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>

          <label className="course-field">
            <span>Comment for your professor <em>(optional)</em></span>
            <textarea
              rows={2}
              value={comment}
              maxLength={2000}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>

          <div className="course-actions">
            <button type="submit" className="course-button primary" disabled={saving}>
              <Upload size={16} aria-hidden="true" />
              {saving ? "Uploading..." : handedIn ? "Save changes" : "Hand in"}
            </button>
            {handedIn && (
              <button type="button" className="course-button" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="course-actions">
          <button type="button" className="course-button primary" onClick={() => setEditing(true)}>
            Edit submission
          </button>
          <button type="button" className="course-button danger" onClick={removeSubmission} disabled={saving}>
            <Trash2 size={15} aria-hidden="true" />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------
// TEACHER PANEL
// ---------------------------------------------------------

function MarkRow({
  assignment,
  student,
  submission,
  onChanged,
}) {
  const [grade, setGrade] = useState(
    submission?.grade !== null && submission?.grade !== undefined ? String(Number(submission.grade)) : ""
  );
  const [feedback, setFeedback] = useState(submission?.feedback || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const status =
    submissionStatus(assignment, submission);

  const handedIn =
    submission && !submission.synthetic ? submission : null;


  async function save() {
    setMessage("");

    const value =
      grade.trim() === "" ? null : Number(grade);

    if (value !== null && (Number.isNaN(value) || value < 0 || (assignment.points && value > assignment.points))) {
      setMessage(`Enter a mark from 0 to ${assignment.points || "the maximum"}.`);
      return;
    }

    setSaving(true);

    const { error } =
      await supabase.rpc("set_mark", {
        input_assignment_id: assignment.id,
        input_student_id: student.id,
        input_grade: value,
        input_feedback: feedback.trim() || null,
      });

    setSaving(false);

    if (error) {
      setMessage(
        /set_mark|schema cache/i.test(error.message)
          ? "Run supabase/14-real-classroom.sql first."
          : error.message
      );
      return;
    }

    setMessage("Saved");
    onChanged();
  }


  async function download() {
    try {
      await openFile(
        "submissions",
        handedIn.file_path,
        `${student.full_name} - ${handedIn.file_name}`
      );
    } catch (error) {
      setMessage(error.message);
    }
  }


  return (
    <tr>
      <td data-label="Student">
        <div className="course-person">
          <UserAvatar profile={student} userId={student.id} name={student.full_name} size={32} />
          <div>
            <strong>{student.full_name}</strong>
            <small>{student.campus_id}</small>
          </div>
        </div>
      </td>
      <td data-label="Status">
        <span className={`course-chip ${status.key}`}>{status.label}</span>
        {handedIn && <small className="course-muted">{formatDateTime(handedIn.submitted_at)}</small>}
      </td>
      {assignment.hand_in !== false && (
        <td data-label="File">
          {handedIn?.file_path ? (
            <button type="button" className="course-file-link" onClick={download}>
              <Download size={15} aria-hidden="true" />
              {handedIn.file_name}
            </button>
          ) : "—"}
          {handedIn?.comment && <small className="course-muted">“{handedIn.comment}”</small>}
        </td>
      )}
      <td data-label="Mark">
        <div className="course-mark">
          <input
            type="number"
            min="0"
            max={assignment.points || undefined}
            step="0.5"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            aria-label={`Mark for ${student.full_name}`}
          />
          {assignment.points ? <span>/ {assignment.points}</span> : null}
        </div>
      </td>
      <td data-label="Feedback">
        <textarea
          rows={1}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Feedback (optional)"
          aria-label={`Feedback for ${student.full_name}`}
        />
      </td>
      <td className="course-mark-save">
        <button type="button" className="course-button small" onClick={save} disabled={saving}>
          <Save size={14} aria-hidden="true" />
          {saving ? "Saving" : "Save"}
        </button>
        {message && <small className={message === "Saved" ? "course-saved" : "course-error-text"}>{message}</small>}
      </td>
    </tr>
  );
}


function ProfessorPanel({
  assignment,
  students,
  submissions,
  onChanged,
  onEdit,
}) {
  const byStudent =
    new Map(submissions.map((row) => [row.student_id, row]));

  const handedIn = submissions.filter((row) => !row.synthetic).length;
  const late = submissions.filter((row) => submissionStatus(assignment, row).key === "late").length;
  const marked = submissions.filter((row) => row.grade !== null && row.grade !== undefined).length;

  const markOnly =
    assignment.hand_in === false;

  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState("");

  async function changeLateRule(allow) {
    setBusy(true);
    setPanelError("");

    const { error } =
      await supabase.rpc("set_assignment_allow_late", {
        input_assignment_id: assignment.id,
        input_allow_late: allow,
      });

    setBusy(false);

    if (error) {
      setPanelError(error.message);
      return;
    }

    onChanged();
  }


  async function changeRelease(released) {
    setBusy(true);
    setPanelError("");

    const { error } =
      await supabase.rpc("set_marks_released", {
        input_assignment_id: assignment.id,
        input_released: released,
      });

    setBusy(false);

    if (error) {
      setPanelError(error.message);
      return;
    }

    onChanged();
  }


  async function removeAssignment() {
    const warning =
      handedIn > 0
        ? `Delete "${assignment.title}"? ${handedIn} hand-in(s) and all marks for it will be deleted too. This can't be undone.`
        : `Delete "${assignment.title}"? This can't be undone.`;

    if (!window.confirm(warning)) return;

    setBusy(true);

    const { error } =
      await supabase
        .from("class_assignments")
        .delete()
        .eq("id", assignment.id);

    setBusy(false);

    if (error) {
      setPanelError(error.message);
      return;
    }

    if (assignment.file_path) await removeFile("course-files", assignment.file_path);
    onChanged();
  }


  return (
    <div className="course-assignment-body">

      <div className="course-actions course-assignment-tools">
        <button type="button" className="course-button small" onClick={() => onEdit(assignment)}>
          <Pencil size={14} aria-hidden="true" />
          Edit
        </button>
        {"marks_released" in assignment && (
          assignment.marks_released ? (
            <button type="button" className="course-button small" onClick={() => changeRelease(false)} disabled={busy}>
              <EyeOff size={14} aria-hidden="true" />
              Hide marks
            </button>
          ) : (
            <button type="button" className="course-button small primary" onClick={() => changeRelease(true)} disabled={busy}>
              <Eye size={14} aria-hidden="true" />
              Release marks
            </button>
          )
        )}
        <button type="button" className="course-button small danger" onClick={removeAssignment} disabled={busy}>
          <Trash2 size={14} aria-hidden="true" />
          Delete
        </button>
      </div>

      {"marks_released" in assignment && (
        <p className={`course-release-note ${assignment.marks_released ? "shown" : ""}`}>
          {assignment.marks_released ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
          {assignment.marks_released
            ? "Students can see their marks and feedback."
            : "Marks are hidden from students. Mark everyone, then click Release marks."}
        </p>
      )}

      {assignment.description && (
        <p className="course-assignment-brief">{assignment.description}</p>
      )}

      <BriefFile assignment={assignment} onError={setPanelError} />

      {!markOnly && "allow_late" in assignment && (
        <label className="course-toggle">
          <input
            type="checkbox"
            checked={assignment.allow_late !== false}
            disabled={busy}
            onChange={(event) => changeLateRule(event.target.checked)}
          />
          <span>
            Accept late hand-ins
            <small>
              {assignment.allow_late === false
                ? "Students can't hand in after the deadline."
                : "Late work is accepted and labelled \"late\"."}
            </small>
          </span>
        </label>
      )}

      {panelError && <p className="course-error" role="alert">{panelError}</p>}

      <div className="course-mini-stats">
        {!markOnly && <span><strong>{handedIn}</strong> of {students.length} handed in</span>}
        {!markOnly && <span><strong>{late}</strong> late</span>}
        <span><strong>{marked}</strong> of {students.length} marked</span>
        {assignment.weight ? <span><strong>{Number(assignment.weight)}%</strong> of final</span> : null}
        <span>{markOnly ? "Date" : "Due"} {formatDateTime(assignment.due_at)}</span>
      </div>

      {students.length === 0 ? (
        <p className="course-empty">No students have joined this class yet.</p>
      ) : (
        <div className="course-table-wrap">
          <table className="course-table course-marking">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                {!markOnly && <th>File</th>}
                <th>Mark</th>
                <th>Feedback</th>
                <th><span className="course-sr-only">Save</span></th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <MarkRow
                  key={`${student.id}-${byStudent.get(student.id)?.id || "none"}-${byStudent.get(student.id)?.graded_at || ""}`}
                  assignment={assignment}
                  student={student}
                  submission={byStudent.get(student.id)}
                  onChanged={onChanged}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------
// LIST
// ---------------------------------------------------------

function CourseAssignments({
  assignments,
  submissions,
  students,
  isProfessor,
  groupId,
  userId,
  onChanged,
  onEdit,
}) {
  const [openId, setOpenId] = useState("");

  const sorted = useMemo(
    () =>
      [...assignments].sort(
        (a, b) => new Date(a.due_at || 0) - new Date(b.due_at || 0)
      ),
    [assignments]
  );


  if (sorted.length === 0) {
    return (
      <p className="course-empty">
        {isProfessor
          ? "No assignments yet. Click New to post one."
          : "No assignments yet."}
      </p>
    );
  }


  return (
    <ul className="course-assignment-list">
      {sorted.map((assignment) => {
        const mine =
          submissions.filter((row) => row.assignment_id === assignment.id);

        const status =
          isProfessor ? null : submissionStatus(assignment, mine[0]);

        const open =
          openId === assignment.id;

        const handedInCount =
          mine.filter((row) => !row.synthetic).length;

        const markedCount =
          mine.filter((row) => row.grade !== null && row.grade !== undefined).length;

        return (
          <li key={assignment.id} className={open ? "open" : ""}>
            <button
              type="button"
              className="course-assignment-row"
              aria-expanded={open}
              onClick={() => setOpenId(open ? "" : assignment.id)}
            >
              <span className={`course-activity-icon ${assignment.hand_in === false ? "exam" : "assignment"}`}>
                <FileText size={18} aria-hidden="true" />
              </span>

              <span className="course-assignment-title">
                <strong>{assignment.title}</strong>
                <small>
                  <Clock size={13} aria-hidden="true" />
                  {assignment.hand_in === false ? "" : "Due "}
                  {formatDateTime(assignment.due_at)}
                  {assignment.points ? ` · ${assignment.points} marks` : ""}
                  {assignment.weight ? ` · ${Number(assignment.weight)}%` : ""}
                  {assignment.file_path ? " · " : ""}
                  {assignment.file_path && <Paperclip size={12} aria-label="Has a file" />}
                </small>
              </span>

              {isProfessor ? (
                <span className="course-chip neutral">
                  {assignment.hand_in === false
                    ? `${markedCount}/${students.length} marked`
                    : `${handedInCount}/${students.length} handed in`}
                  {assignment.marks_released === false && markedCount > 0 ? " · hidden" : ""}
                </span>
              ) : (
                <span className={`course-chip ${status.key}`}>
                  {status.key === "graded"
                    ? formatMark(mine[0].grade, assignment.points)
                    : status.label}
                </span>
              )}

              <ChevronDown size={18} className="course-chevron" aria-hidden="true" />
            </button>

            {open && (
              isProfessor ? (
                <ProfessorPanel
                  assignment={assignment}
                  students={students}
                  submissions={mine}
                  onChanged={onChanged}
                  onEdit={onEdit}
                />
              ) : (
                <StudentPanel
                  key={mine[0]?.id || "new"}
                  assignment={assignment}
                  submission={mine[0]}
                  groupId={groupId}
                  userId={userId}
                  onChanged={onChanged}
                />
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default CourseAssignments;
