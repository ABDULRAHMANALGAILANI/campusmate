import {
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  CalendarCheck,
  Check,
  Download,
  FileHeart,
  Paperclip,
  QrCode,
  Send,
  X,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import { downloadCsv } from "../../lib/csv";

import {
  EXCUSE_LIMIT_MB,
  formatSize,
  openFile,
  removeFile,
  tooBig,
  uploadExcuse,
} from "../../lib/courseFiles";

import {
  LOW_ATTENDANCE,
  attendanceStats,
  formatDateTime,
} from "../../lib/courseHelpers";


// =========================================================
// ATTENDANCE TAB
// Student: their record, % (below 80% warning), and an
//          "Excuse" button for absences (reason + MC file).
// Teacher: report per student, absence excuses to accept or
//          reject, CSV download. Accepted excuses don't count
//          against the student's %.
// =========================================================

function ExcuseForm({ groupId, userId, record, onDone, onCancel }) {
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function send(event) {
    event.preventDefault();
    setError("");

    if (reason.trim().length < 3) {
      setError("Say why you were absent (e.g. \"Fever, MC attached\").");
      return;
    }

    if (tooBig(file, EXCUSE_LIMIT_MB)) {
      setError(`That file is too big. The limit is ${EXCUSE_LIMIT_MB} MB.`);
      return;
    }

    setSaving(true);

    let path = null;

    try {
      if (file) path = await uploadExcuse(groupId, userId, file);

      const { error: insertError } =
        await supabase
          .from("attendance_excuses")
          .insert({
            session_id: record.session_id,
            group_id: groupId,
            student_id: userId,
            reason: reason.trim(),
            file_path: path,
            file_name: file?.name || null,
          });

      if (insertError) throw insertError;

      onDone();
    } catch (sendError) {
      if (path) await removeFile("excuses", path);
      setError(
        /attendance_excuses|schema cache/i.test(sendError.message || "")
          ? "Excuses aren't set up yet. Ask your professor or admin to run supabase/14-real-classroom.sql."
          : sendError.message || "Couldn't send it. Try again."
      );
      setSaving(false);
    }
  }

  return (
    <form className="course-excuse-form" onSubmit={send}>
      <label className="course-field">
        <span>Reason</span>
        <textarea
          rows={2}
          maxLength={1000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Fever, MC from Klinik Kesihatan attached"
          autoFocus
        />
      </label>

      <label className="course-dropzone small">
        <Paperclip size={17} aria-hidden="true" />
        <span>
          {file
            ? <><strong>{file.name}</strong> ({formatSize(file.size)})</>
            : <>Attach MC or letter <small>(photo or PDF, up to {EXCUSE_LIMIT_MB} MB)</small></>}
        </span>
        <input type="file" accept="image/*,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      </label>

      {error && <p className="course-error" role="alert">{error}</p>}

      <div className="course-actions">
        <button type="submit" className="course-button primary small" disabled={saving}>
          <Send size={14} aria-hidden="true" />
          {saving ? "Sending..." : "Send to professor"}
        </button>
        <button type="button" className="course-button small" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}


function ExcuseChip({ excuse }) {
  if (!excuse) return null;

  const text =
    excuse.status === "accepted" ? "Excuse accepted"
      : excuse.status === "rejected" ? "Excuse rejected"
        : "Excuse sent";

  const tone =
    excuse.status === "accepted" ? "submitted"
      : excuse.status === "rejected" ? "missing"
        : "late";

  return <span className={`course-chip ${tone}`}>{text}</span>;
}


function ReviewRow({ excuse, student, record, onChanged }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function decide(status) {
    setBusy(true);
    setError("");

    const { error: updateError } =
      await supabase
        .from("attendance_excuses")
        .update({ status, reviewer_note: note.trim() || null })
        .eq("id", excuse.id);

    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onChanged();
  }

  async function viewFile() {
    try {
      await openFile("excuses", excuse.file_path, excuse.file_name);
    } catch (fileError) {
      setError(fileError.message);
    }
  }

  return (
    <li className="course-excuse-review">
      <div>
        <strong>{student?.full_name || "Student"}</strong>
        <small className="course-muted">
          Absent {formatDateTime(record?.created_at)} · sent {formatDateTime(excuse.created_at)}
        </small>
        <p>{excuse.reason}</p>
        {excuse.file_path && (
          <button type="button" className="course-file-link" onClick={viewFile}>
            <Paperclip size={14} aria-hidden="true" />
            {excuse.file_name}
          </button>
        )}
      </div>

      <div className="course-excuse-actions">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note to student (optional)"
          maxLength={1000}
          aria-label={`Note to ${student?.full_name || "student"}`}
        />
        <button type="button" className="course-button small primary" onClick={() => decide("accepted")} disabled={busy}>
          <Check size={14} aria-hidden="true" />
          Accept
        </button>
        <button type="button" className="course-button small danger" onClick={() => decide("rejected")} disabled={busy}>
          <X size={14} aria-hidden="true" />
          Reject
        </button>
      </div>
      {error && <p className="course-error" role="alert">{error}</p>}
    </li>
  );
}


function CourseAttendance({
  course,
  groupId,
  userId,
  isTeacher,
  students,
  records,
  excuses,
  onChanged,
}) {
  const [excusing, setExcusing] = useState("");

  const excuseFor = useMemo(() => {
    const map = new Map(excuses.map((row) => [`${row.session_id}:${row.student_id}`, row]));
    return (sessionId, studentId) => map.get(`${sessionId}:${studentId}`);
  }, [excuses]);


  // ---------- Student ----------

  if (!isTeacher) {
    const mine =
      records.filter((record) => record.student_id === userId);

    const stats =
      attendanceStats(mine, excuses, userId);

    return (
      <section className="course-section">
        <header className="course-section-head">
          <h2>
            <CalendarCheck size={19} aria-hidden="true" />
            Attendance
          </h2>
        </header>

        <p className="course-checkin-note">
          <QrCode size={20} aria-hidden="true" />
          <span>
            To check in, open your phone camera and scan the QR code on
            your professor&apos;s screen. Each code works for 30 seconds.
          </span>
        </p>

        {mine.length === 0 ? (
          <p className="course-empty">No attendance taken for this class yet.</p>
        ) : (
          <>
            <div className="course-attendance-summary">
              <strong>{stats.percent ?? 100}%</strong>
              <span>
                Present {stats.present + stats.late} of {stats.counted} classes
                {stats.excused ? ` · ${stats.excused} excused` : ""}
              </span>
            </div>

            {stats.percent !== null && stats.percent < LOW_ATTENDANCE && (
              <p className="course-error" role="alert">
                Your attendance is below {LOW_ATTENDANCE}%. Students below {LOW_ATTENDANCE}% may
                be barred from the final exam. If you were sick, send your MC with Excuse below.
              </p>
            )}

            <ul className="course-attendance-list">
              {mine.map((record) => {
                const excuse = excuseFor(record.session_id, userId);
                const absent = record.status === "absent";

                return (
                  <li key={record.id} className={excusing === record.id ? "open" : ""}>
                    <div className="course-attendance-line">
                      <span>{formatDateTime(record.created_at)}</span>
                      <span className="course-attendance-tags">
                        <span className={`course-chip ${absent ? (excuse?.status === "accepted" ? "neutral" : "missing") : record.status === "late" ? "late" : "submitted"}`}>
                          {absent ? (excuse?.status === "accepted" ? "Excused" : "Absent") : record.status === "late" ? "Late" : "Present"}
                        </span>
                        {absent && <ExcuseChip excuse={excuse} />}
                        {absent && !excuse && excusing !== record.id && (
                          <button type="button" className="course-button small" onClick={() => setExcusing(record.id)}>
                            <FileHeart size={14} aria-hidden="true" />
                            Excuse
                          </button>
                        )}
                      </span>
                    </div>

                    {excuse?.reviewer_note && (
                      <small className="course-muted">Professor: {excuse.reviewer_note}</small>
                    )}

                    {excusing === record.id && (
                      <ExcuseForm
                        groupId={groupId}
                        userId={userId}
                        record={record}
                        onCancel={() => setExcusing("")}
                        onDone={() => { setExcusing(""); onChanged(); }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    );
  }


  // ---------- Teacher ----------

  const byStudent =
    new Map(students.map((student) => [student.id, attendanceStats(records, excuses, student.id)]));

  const sessionCount =
    new Set(records.map((record) => record.session_id)).size;

  const low =
    students.filter((student) => {
      const percent = byStudent.get(student.id)?.percent;
      return percent !== null && percent !== undefined && percent < LOW_ATTENDANCE;
    });

  const pending =
    excuses
      .filter((row) => row.status === "pending")
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const recordFor = (sessionId, studentId) =>
    records.find((record) => record.session_id === sessionId && record.student_id === studentId);

  function downloadAttendance() {
    downloadCsv(
      `${course.course_code || course.name}-attendance.csv`,
      [
        ["Student", "CampusMate ID", "Present", "Late", "Absent", "Excused", "Attendance %", `Below ${LOW_ATTENDANCE}%`],
        ...students.map((student) => {
          const row = byStudent.get(student.id);
          return [
            student.full_name,
            student.campus_id,
            row.present,
            row.late,
            row.absent,
            row.excused,
            row.percent ?? "",
            row.percent !== null && row.percent < LOW_ATTENDANCE ? "YES" : "",
          ];
        }),
      ]
    );
  }

  return (
    <div className="course-sections">
      {pending.length > 0 && (
        <section className="course-section">
          <header className="course-section-head">
            <h2>
              <FileHeart size={19} aria-hidden="true" />
              Absence excuses to check ({pending.length})
            </h2>
          </header>
          <ul className="course-excuse-list">
            {pending.map((excuse) => (
              <ReviewRow
                key={excuse.id}
                excuse={excuse}
                student={students.find((student) => student.id === excuse.student_id)}
                record={recordFor(excuse.session_id, excuse.student_id)}
                onChanged={onChanged}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="course-section">
        <header className="course-section-head">
          <h2>
            <CalendarCheck size={19} aria-hidden="true" />
            Attendance report
            {sessionCount > 0 && <small className="course-muted"> · {sessionCount} classes</small>}
          </h2>

          <div className="course-actions right">
            <Link to={`/professor/attendance?class=${groupId}`} className="course-button small primary">
              <QrCode size={14} aria-hidden="true" />
              Take attendance
            </Link>
            {students.length > 0 && records.length > 0 && (
              <button type="button" className="course-button small" onClick={downloadAttendance}>
                <Download size={14} aria-hidden="true" />
                Download CSV
              </button>
            )}
          </div>
        </header>

        {low.length > 0 && (
          <p className="course-error" role="alert">
            {low.length === 1 ? "1 student is" : `${low.length} students are`} below {LOW_ATTENDANCE}% attendance:{" "}
            {low.map((student) => student.full_name).join(", ")}.
          </p>
        )}

        {students.length === 0 ? (
          <p className="course-empty">No students have joined this class yet.</p>
        ) : records.length === 0 ? (
          <p className="course-empty">No attendance taken yet. Use Take attendance to start a session.</p>
        ) : (
          <div className="course-table-wrap">
            <table className="course-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Absent</th>
                  <th>Excused</th>
                  <th>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const row = byStudent.get(student.id);
                  const isLow = row.percent !== null && row.percent < LOW_ATTENDANCE;

                  return (
                    <tr key={student.id} className={isLow ? "course-row-warning" : ""}>
                      <td data-label="Student">
                        <strong>{student.full_name}</strong>
                        <small className="course-muted">{student.campus_id}</small>
                      </td>
                      <td data-label="Present">{row.present}</td>
                      <td data-label="Late">{row.late}</td>
                      <td data-label="Absent">{row.absent}</td>
                      <td data-label="Excused">{row.excused}</td>
                      <td data-label="Attendance">
                        {row.percent === null ? "—" : (
                          <span className={`course-chip ${isLow ? "missing" : "submitted"}`}>
                            {row.percent}%{isLow ? ` · below ${LOW_ATTENDANCE}%` : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default CourseAttendance;
