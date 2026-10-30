import {
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  FileText,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import { downloadCsv } from "../../lib/csv";

import {
  GRADE_SCALE,
  formatMark,
  letterGrade,
  roundOne,
  submissionStatus,
  weightedTotal,
} from "../../lib/courseHelpers";


// =========================================================
// GRADES TAB
// Teacher: gradebook with weights, total, letter grade,
//          release marks (one or all), CSV download.
// Student: their released marks + total so far.
// =========================================================

function shortDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString([], { day: "numeric", month: "short" });
}


function useGradeItems(assignments, quizzes) {
  return useMemo(
    () => [
      ...assignments.map((assignment) => ({
        key: `a-${assignment.id}`,
        kind: "assignment",
        id: assignment.id,
        title: assignment.title,
        weight: assignment.weight,
        outOf: Number(assignment.points || 0),
        released: assignment.marks_released !== false,
        date: assignment.due_at,
        source: assignment,
      })),
      ...quizzes.map((quiz) => ({
        key: `q-${quiz.id}`,
        kind: "quiz",
        id: quiz.id,
        title: quiz.title,
        weight: quiz.weight,
        outOf: null,
        released: true,
        date: quiz.closes_at || quiz.created_at,
        source: quiz,
      })),
    ].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)),
    [assignments, quizzes]
  );
}


function CourseGrades({
  course,
  assignments,
  quizzes,
  attempts,
  rows,
  students,
  isTeacher,
  userId,
  onChanged,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const items =
    useGradeItems(assignments, quizzes);

  const rowFor = useMemo(() => {
    const map = new Map(rows.map((row) => [`${row.assignment_id}:${row.student_id}`, row]));
    return (assignmentId, studentId) => map.get(`${assignmentId}:${studentId}`);
  }, [rows]);

  const attemptFor = useMemo(() => {
    const map = new Map(attempts.map((row) => [`${row.quiz_id}:${row.student_id}`, row]));
    return (quizId, studentId) => map.get(`${quizId}:${studentId}`);
  }, [attempts]);


  // Score + "out of" of one item for one student (null = no score)
  function scoreOf(item, studentId) {
    if (item.kind === "assignment") {
      const row = rowFor(item.id, studentId);
      if (row?.grade === null || row?.grade === undefined) return null;
      return { score: Number(row.grade), outOf: item.outOf };
    }

    const attempt = attemptFor(item.id, studentId);
    if (!attempt?.submitted_at || !attempt.max_score) return null;
    return { score: Number(attempt.score || 0), outOf: Number(attempt.max_score) };
  }


  function totalsFor(studentId) {
    return weightedTotal(
      items.map((item) => {
        const result = scoreOf(item, studentId);
        return { ...item, outOf: result?.outOf || item.outOf || 1, result };
      }),
      (item) => (item.result ? item.result.score : null)
    );
  }


  const weightSum =
    roundOne(items.reduce((sum, item) => sum + Number(item.weight || 0), 0));

  const unreleased =
    assignments.filter((assignment) =>
      assignment.marks_released === false &&
      rows.some((row) => row.assignment_id === assignment.id && row.grade !== null && row.grade !== undefined)
    );


  async function releaseAll() {
    if (!window.confirm(`Release marks for ${unreleased.length} ${unreleased.length === 1 ? "assignment" : "assignments"}? Each student will be notified.`)) {
      return;
    }

    setBusy(true);
    setError("");

    for (const assignment of unreleased) {
      const { error: releaseError } =
        await supabase.rpc("set_marks_released", {
          input_assignment_id: assignment.id,
          input_released: true,
        });

      if (releaseError) {
        setError(releaseError.message);
        break;
      }
    }

    setBusy(false);
    onChanged();
  }


  async function toggleRelease(item) {
    setBusy(true);
    setError("");

    const { error: releaseError } =
      await supabase.rpc("set_marks_released", {
        input_assignment_id: item.id,
        input_released: !item.released,
      });

    setBusy(false);

    if (releaseError) {
      setError(releaseError.message);
      return;
    }

    onChanged();
  }


  function downloadGrades() {
    downloadCsv(
      `${course.course_code || course.name}-grades.csv`,
      [
        [
          "Student",
          "CampusMate ID",
          ...items.map((item) =>
            `${item.title}${item.outOf ? ` (/${item.outOf})` : ""}${item.weight ? ` [${Number(item.weight)}%]` : ""}`
          ),
          `Total (/${weightSum || 0})`,
          "Grade",
        ],
        ...students.map((student) => {
          const totals = totalsFor(student.id);
          return [
            student.full_name,
            student.campus_id,
            ...items.map((item) => {
              const result = scoreOf(item, student.id);
              if (result) return item.kind === "quiz" ? `${result.score}/${result.outOf}` : result.score;
              if (item.kind === "assignment" && rowFor(item.id, student.id) && !rowFor(item.id, student.id).synthetic) {
                return "handed in";
              }
              return "";
            }),
            totals.total ?? "",
            weightSum ? letterGrade(totals.percent) : "",
          ];
        }),
      ]
    );
  }


  // ---------- Student ----------

  if (!isTeacher) {
    const totals =
      totalsFor(userId);

    return (
      <section className="course-section">
        <header className="course-section-head">
          <h2>
            <FileText size={19} aria-hidden="true" />
            Your grades
          </h2>
        </header>

        <div className="course-table-wrap">
          <table className="course-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Weight</th>
                <th>Status</th>
                <th>Mark</th>
                <th>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={5} className="course-empty">Nothing marked yet.</td></tr>
              )}
              {items.map((item) => {
                if (item.kind === "quiz") {
                  const attempt = attemptFor(item.id, userId);
                  return (
                    <tr key={item.key}>
                      <td data-label="Item"><strong>{item.title}</strong> <small className="course-muted">Quiz</small></td>
                      <td data-label="Weight">{item.weight ? `${Number(item.weight)}%` : "—"}</td>
                      <td data-label="Status">
                        <span className={`course-chip ${attempt?.submitted_at ? "graded" : "open"}`}>
                          {attempt?.submitted_at ? "Done" : "Not taken"}
                        </span>
                      </td>
                      <td data-label="Mark">
                        <strong>{attempt?.submitted_at ? formatMark(attempt.score, Number(attempt.max_score)) : "—"}</strong>
                      </td>
                      <td data-label="Feedback">—</td>
                    </tr>
                  );
                }

                const row = rowFor(item.id, userId);
                const status = submissionStatus(item.source, row);
                const hidden =
                  !item.released && (Boolean(row && !row.synthetic) || item.source.hand_in === false);

                return (
                  <tr key={item.key}>
                    <td data-label="Item">
                      <strong>{item.title}</strong>{" "}
                      <small className="course-muted">{item.source.hand_in === false ? "Mark only" : shortDate(item.date)}</small>
                    </td>
                    <td data-label="Weight">{item.weight ? `${Number(item.weight)}%` : "—"}</td>
                    <td data-label="Status"><span className={`course-chip ${status.key}`}>{status.label}</span></td>
                    <td data-label="Mark">
                      <strong>{row?.grade !== null && row?.grade !== undefined ? formatMark(row.grade, item.outOf) : hidden ? "Not released yet" : "—"}</strong>
                    </td>
                    <td data-label="Feedback" className="course-feedback">{row?.feedback || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            {totals.weightDone > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    Your total so far
                    <small className="course-muted"> (from {totals.weightDone}% of the course marked)</small>
                  </td>
                  <td colSpan={2}>
                    <strong>{totals.soFar}%</strong>
                    <span className="course-grade-letter">{letterGrade(totals.soFar)}</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {items.some((item) => item.weight) ? (
          <p className="course-muted course-grade-note">
            The final grade uses the weights your professor set. Marks show here once your professor releases them.
          </p>
        ) : null}
      </section>
    );
  }


  // ---------- Teacher ----------

  return (
    <section className="course-section">
      <header className="course-section-head">
        <h2>
          <FileText size={19} aria-hidden="true" />
          Gradebook
        </h2>

        <div className="course-actions right">
          {unreleased.length > 0 && (
            <button type="button" className="course-button small primary" onClick={releaseAll} disabled={busy}>
              <Eye size={14} aria-hidden="true" />
              Release all marks ({unreleased.length})
            </button>
          )}
          {students.length > 0 && items.length > 0 && (
            <button type="button" className="course-button small" onClick={downloadGrades}>
              <Download size={14} aria-hidden="true" />
              Download CSV
            </button>
          )}
        </div>
      </header>

      {error && <p className="course-error" role="alert">{error}</p>}

      {items.length > 0 && (
        weightSum === 100 ? (
          <p className="course-muted course-grade-note">
            Weights add up to 100%. Total = each mark × its weight. Missing marks count as 0.
          </p>
        ) : (
          <p className="course-warning">
            <AlertTriangle size={16} aria-hidden="true" />
            {weightSum
              ? `Weights add up to ${weightSum}%, not 100%. Edit assignments or quizzes to set each one's weight.`
              : "No weights set yet. Edit each assignment (and quiz) and set its weight, e.g. Lab 1 = 10%, Final exam = 50%."}
          </p>
        )
      )}

      {students.length === 0 || items.length === 0 ? (
        <p className="course-empty">
          Marks appear here once the class has students and assignments.
        </p>
      ) : (
        <div className="course-table-wrap">
          <table className="course-table course-gradebook">
            <thead>
              <tr>
                <th>Student</th>
                {items.map((item) => (
                  <th key={item.key}>
                    <span className="course-grade-head">
                      {item.title}
                      <small>
                        {item.kind === "quiz" ? "Quiz" : `/${item.outOf}`}
                        {item.weight ? ` · ${Number(item.weight)}%` : ""}
                      </small>
                      {item.kind === "assignment" && (
                        <button
                          type="button"
                          className={`course-release-chip ${item.released ? "shown" : ""}`}
                          onClick={() => toggleRelease(item)}
                          disabled={busy}
                          title={item.released ? "Students can see these marks. Click to hide." : "Hidden from students. Click to release."}
                        >
                          {item.released ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
                          {item.released ? "Shown" : "Hidden"}
                        </button>
                      )}
                    </span>
                  </th>
                ))}
                <th>Total{weightSum ? <small> /{weightSum}</small> : null}</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const totals = totalsFor(student.id);

                return (
                  <tr key={student.id}>
                    <td>
                      <strong>{student.full_name}</strong>
                      <small className="course-muted">{student.campus_id}</small>
                    </td>
                    {items.map((item) => {
                      const result = scoreOf(item, student.id);

                      if (item.kind === "quiz") {
                        return (
                          <td key={item.key} className={`course-grade-cell ${result ? "graded" : "open"}`}>
                            {result ? `${roundOne(result.score)}/${roundOne(result.outOf)}` : "—"}
                          </td>
                        );
                      }

                      const row = rowFor(item.id, student.id);
                      const status = submissionStatus(item.source, row);

                      return (
                        <td key={item.key} className={`course-grade-cell ${status.key}`}>
                          {result
                            ? roundOne(result.score)
                            : row && !row.synthetic
                              ? "To mark"
                              : status.key === "missing" ? "Missing" : "—"}
                        </td>
                      );
                    })}
                    <td className="course-grade-total">{weightSum ? totals.total : "—"}</td>
                    <td className="course-grade-total">{weightSum ? letterGrade(totals.percent) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <details className="course-grade-scale">
        <summary>Grade scale</summary>
        <p>
          {GRADE_SCALE.map(([min, letter]) => (min ? `${letter} ${min}+` : `${letter} below 35`)).join(" · ")}
        </p>
      </details>
    </section>
  );
}

export default CourseGrades;
