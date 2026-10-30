import { useMemo } from "react";

import {
  AlertTriangle,
  CalendarX,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  MessageCircleQuestion,
  Stethoscope,
} from "lucide-react";

import { LOW_ATTENDANCE } from "../../lib/courseHelpers";


// =========================================================
// NEEDS ATTENTION (teachers, top of the Course tab)
// One glance at what to follow up in this class:
//   hand-ins to mark, missing hand-ins after the deadline,
//   students under 80% attendance, unanswered questions,
//   absence excuses waiting for a decision.
// =========================================================

function CourseAttention({
  assignments,
  rows,
  students,
  attendanceByStudent,
  openQuestions,
  pendingExcuses,
  onOpenTab,
}) {
  const items = useMemo(() => {
    const list = [];
    const now = new Date();
    const studentIds = new Set(students.map((student) => student.id));

    // Hand-ins with no mark yet
    const toMark =
      rows.filter((row) => row.submitted_at && (row.grade === null || row.grade === undefined)).length;

    if (toMark) {
      list.push({
        key: "mark",
        icon: ClipboardCheck,
        count: toMark,
        text: toMark === 1 ? "hand-in to mark" : "hand-ins to mark",
        target: "assignments",
      });
    }

    // Past the deadline and someone still hasn't handed in
    const late =
      assignments
        .filter((assignment) => assignment.hand_in !== false && assignment.due_at && new Date(assignment.due_at) < now)
        .map((assignment) => {
          const handedIn =
            new Set(
              rows
                .filter((row) => row.assignment_id === assignment.id && row.submitted_at && studentIds.has(row.student_id))
                .map((row) => row.student_id)
            );
          return { assignment, missing: students.length - handedIn.size };
        })
        .filter((item) => item.missing > 0)
        .sort((a, b) => new Date(b.assignment.due_at) - new Date(a.assignment.due_at));

    for (const item of late.slice(0, 3)) {
      list.push({
        key: `late-${item.assignment.id}`,
        icon: FileWarning,
        count: item.missing,
        text: item.missing === 1 ? "student hasn't handed in" : "students haven't handed in",
        name: item.assignment.title,
        target: "assignments",
      });
    }

    // Low attendance
    const low =
      students.filter((student) => {
        const stats = attendanceByStudent.get(student.id);
        return stats && stats.percent !== null && stats.percent < LOW_ATTENDANCE;
      });

    if (low.length) {
      list.push({
        key: "low",
        icon: CalendarX,
        count: low.length,
        text: low.length === 1 ? `student below ${LOW_ATTENDANCE}% attendance` : `students below ${LOW_ATTENDANCE}% attendance`,
        name: low.slice(0, 3).map((student) => student.full_name).join(", ") + (low.length > 3 ? "…" : ""),
        target: "attendance",
      });
    }

    if (openQuestions) {
      list.push({
        key: "qa",
        icon: MessageCircleQuestion,
        count: openQuestions,
        text: openQuestions === 1 ? "question not answered" : "questions not answered",
        target: "qa",
      });
    }

    if (pendingExcuses) {
      list.push({
        key: "excuses",
        icon: Stethoscope,
        count: pendingExcuses,
        text: pendingExcuses === 1 ? "absence excuse to review" : "absence excuses to review",
        target: "attendance",
      });
    }

    return list;
  }, [assignments, rows, students, attendanceByStudent, openQuestions, pendingExcuses]);


  function open(target) {
    if (target === "assignments") {
      document.getElementById("course-assignments")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    onOpenTab(target);
  }


  return (
    <section className={`course-attention ${items.length ? "" : "clear"}`}>
      <h2>
        {items.length
          ? <AlertTriangle size={18} aria-hidden="true" />
          : <CheckCircle2 size={18} aria-hidden="true" />}
        {items.length ? "Needs attention" : "All caught up"}
      </h2>

      {items.length === 0 ? (
        <p className="course-muted">Nothing to follow up in this class right now.</p>
      ) : (
        <ul>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <button type="button" onClick={() => open(item.target)}>
                  <Icon size={16} aria-hidden="true" />
                  <strong>{item.count}</strong>
                  <span>{item.text}</span>
                  {item.name && <em data-no-translate>{item.name}</em>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default CourseAttention;
