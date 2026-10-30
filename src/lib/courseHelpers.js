import { localeTag } from "./i18n";

// =========================================================
// COURSE HELPERS (dates, submission status, marks)
// Shared by the course page and its assignments list.
// =========================================================

export function formatDateTime(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString(localeTag() || [], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}


export function timeLeft(dueAt) {
  if (!dueAt) return "";

  const ms =
    new Date(dueAt).getTime() - Date.now();

  const abs =
    Math.abs(ms);

  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);

  const text =
    days > 0
      ? `${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"}`
      : hours > 0
        ? `${hours} hour${hours === 1 ? "" : "s"} ${minutes} min`
        : `${minutes} min`;

  return ms >= 0 ? `${text} left` : `Overdue by ${text}`;
}


// not-submitted | submitted | late | graded | missing
// (a "synthetic" row is a mark with no hand-in, e.g. an exam)
export function submissionStatus(assignment, submission) {
  if (submission?.grade !== null && submission?.grade !== undefined) {
    return { key: "graded", label: "Marked" };
  }

  if (assignment?.hand_in === false) {
    return { key: "neutral", label: "No hand-in" };
  }

  if (submission && !submission.synthetic) {
    const late =
      assignment.due_at &&
      new Date(submission.submitted_at) > new Date(assignment.due_at);

    return late
      ? { key: "late", label: "Submitted late" }
      : { key: "submitted", label: "Submitted" };
  }

  const overdue =
    assignment.due_at && new Date(assignment.due_at) < new Date();

  return overdue
    ? { key: "missing", label: "Not submitted · overdue" }
    : { key: "open", label: "Not submitted" };
}


export function formatMark(grade, points) {
  if (grade === null || grade === undefined) return "—";

  const value =
    Number(grade);

  const shown =
    Number.isInteger(value) ? value : value.toFixed(1);

  return points ? `${shown} / ${points}` : String(shown);
}


// ---------------------------------------------------------
// MARKS
// Marks live in assignment_marks (students only see them once
// released). This puts each mark onto its hand-in row, and adds
// a row for marks with no hand-in (exams, presentations).
// ---------------------------------------------------------

export function mergeMarks(submissions, marks) {
  const byKey =
    new Map((marks || []).map((mark) => [`${mark.assignment_id}:${mark.student_id}`, mark]));

  const used =
    new Set();

  const rows =
    (submissions || []).map((row) => {
      const key = `${row.assignment_id}:${row.student_id}`;
      const mark = byKey.get(key);
      used.add(key);

      return {
        ...row,
        grade: mark ? mark.grade : null,
        feedback: mark ? mark.feedback : null,
        graded_at: mark ? mark.graded_at : null,
      };
    });

  for (const [key, mark] of byKey) {
    if (used.has(key)) continue;

    rows.push({
      id: `mark-${key}`,
      synthetic: true,
      assignment_id: mark.assignment_id,
      student_id: mark.student_id,
      group_id: mark.group_id,
      grade: mark.grade,
      feedback: mark.feedback,
      graded_at: mark.graded_at,
      submitted_at: null,
    });
  }

  return rows;
}


// Grade scale used by most Malaysian universities
export const GRADE_SCALE = [
  [80, "A", 4.0],
  [75, "A-", 3.67],
  [70, "B+", 3.33],
  [65, "B", 3.0],
  [60, "B-", 2.67],
  [55, "C+", 2.33],
  [50, "C", 2.0],
  [45, "C-", 1.67],
  [40, "D+", 1.33],
  [35, "D", 1.0],
  [0, "F", 0],
];

export function letterGrade(percent) {
  if (percent === null || percent === undefined || Number.isNaN(percent)) return "—";
  const row = GRADE_SCALE.find(([min]) => percent >= min - 1e-9);
  return row ? row[1] : "F";
}


export function roundOne(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}


// items: [{ key, weight, outOf }]
// scoreOf(item) -> number | null  (null = no score yet)
// Returns:
//   total        sum of weight x (score / outOf), missing counted as 0
//   totalWeight  sum of all weights
//   soFar        weighted % of only the items that have a score
export function weightedTotal(items, scoreOf) {
  let total = 0;
  let totalWeight = 0;
  let earned = 0;
  let weightDone = 0;

  for (const item of items) {
    const weight = Number(item.weight || 0);
    if (!weight) continue;

    totalWeight += weight;

    const score = scoreOf(item);
    if (score === null || score === undefined || !item.outOf) continue;

    const part = weight * (Number(score) / Number(item.outOf));
    total += part;
    earned += part;
    weightDone += weight;
  }

  return {
    total: roundOne(total),
    totalWeight: roundOne(totalWeight),
    percent: totalWeight ? roundOne((total / totalWeight) * 100) : null,
    soFar: weightDone ? roundOne((earned / weightDone) * 100) : null,
    weightDone: roundOne(weightDone),
  };
}


export const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function formatClock(value) {
  if (!value) return "";
  const [h, m] = String(value).split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}


// Pulls IDs / emails out of pasted text or a CSV file.
// Words with spaces (names, headings) are skipped.
export function readIds(text) {
  return String(text || "")
    .split(/[\n\r,;\t]+/)
    .map((part) => part.trim().replace(/^"|"$/g, "").trim())
    .filter((part) => part && !/\s/.test(part))
    .filter((part) => !/^(campusmate_?id|campus_?id|id|email|matric|student_?id|name)$/i.test(part));
}


// ---------------------------------------------------------
// ATTENDANCE
// Students below this % get a warning (USM can bar students
// below 80% from the final exam). Accepted excuses (MC) are
// not counted against the student.
// ---------------------------------------------------------

export const LOW_ATTENDANCE = 80;


// records: attendance_records rows; excuses: attendance_excuses rows
export function attendanceStats(records, excuses, studentId) {
  const accepted =
    new Set(
      excuses
        .filter((row) => row.student_id === studentId && row.status === "accepted")
        .map((row) => row.session_id)
    );

  const row = { present: 0, late: 0, absent: 0, excused: 0 };

  for (const record of records) {
    if (record.student_id !== studentId) continue;

    if (record.status === "present") row.present += 1;
    else if (record.status === "late") row.late += 1;
    else if (accepted.has(record.session_id)) row.excused += 1;
    else row.absent += 1;
  }

  const counted =
    row.present + row.late + row.absent;

  return {
    ...row,
    counted,
    percent: counted ? Math.round(((row.present + row.late) / counted) * 100) : null,
  };
}
