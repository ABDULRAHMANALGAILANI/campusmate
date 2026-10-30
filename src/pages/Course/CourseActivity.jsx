import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Archive,
  CalendarCheck,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileText,
  History,
  UserMinus,
  UserPlus,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { formatDateTime } from "../../lib/courseHelpers";


// =========================================================
// ACTIVITY (teachers only)
// Who changed what in this class: marks, releases, due dates,
// attendance corrections, excuses, people joining/leaving,
// archiving. Written by the database (supabase/18), so it
// can't be edited or faked from the app.
// =========================================================

const ACTIONS = {
  mark_given: { label: "Mark given", icon: ClipboardCheck, group: "marks" },
  mark_changed: { label: "Mark changed", icon: ClipboardCheck, group: "marks" },
  feedback_changed: { label: "Feedback changed", icon: ClipboardCheck, group: "marks" },
  mark_removed: { label: "Mark removed", icon: ClipboardCheck, group: "marks" },
  marks_released: { label: "Marks released to students", icon: Eye, group: "marks" },
  marks_hidden: { label: "Marks hidden from students", icon: EyeOff, group: "marks" },
  due_date_changed: { label: "Due date changed", icon: FileText, group: "assignments" },
  weight_changed: { label: "Weight changed", icon: FileText, group: "assignments" },
  assignment_deleted: { label: "Assignment deleted", icon: FileText, group: "assignments" },
  attendance_changed: { label: "Attendance changed", icon: CalendarCheck, group: "attendance" },
  excuse_accepted: { label: "Excuse accepted", icon: CalendarCheck, group: "attendance" },
  excuse_rejected: { label: "Excuse rejected", icon: CalendarCheck, group: "attendance" },
  student_joined: { label: "Student joined", icon: UserPlus, group: "people" },
  student_added: { label: "Student added", icon: UserPlus, group: "people" },
  student_removed: { label: "Student removed", icon: UserMinus, group: "people" },
  class_archived: { label: "Class archived", icon: Archive, group: "class" },
  class_unarchived: { label: "Class un-archived", icon: Archive, group: "class" },
  semester_changed: { label: "Semester changed", icon: Archive, group: "class" },
};

const FILTERS = [
  ["all", "Everything"],
  ["marks", "Marks"],
  ["assignments", "Assignments"],
  ["attendance", "Attendance"],
  ["people", "People"],
  ["class", "Class"],
];

const STATUS = {
  present: "Present",
  late: "Late",
  absent: "Absent",
};


function show(value, kind) {
  if (value === null || value === undefined || value === "") return "—";
  if (kind === "date") return formatDateTime(value);
  if (kind === "weight") return `${value}%`;
  if (kind === "status") return STATUS[value] || value;
  return String(value);
}


function Change({ from, to, kind }) {
  if (from === undefined && to === undefined) return null;

  return (
    <span className="activity-change">
      {from !== undefined && (
        <>
          <span>{show(from, kind)}</span>
          <span aria-hidden="true">→</span>
        </>
      )}
      <span>{show(to, kind)}</span>
    </span>
  );
}


function CourseActivity({ groupId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    const { data, error: loadError } =
      await supabase.rpc("class_activity", { gid: groupId, max_rows: 500 });

    if (loadError) {
      setError(
        /class_activity|schema cache/i.test(loadError.message)
          ? "The activity log isn't set up yet. Run supabase/18-semesters-and-activity.sql in Supabase."
          : loadError.message
      );
    } else {
      setError("");
      setRows(data || []);
    }

    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    // Data loading when the tab opens
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const shown = useMemo(
    () => rows.filter((row) => filter === "all" || ACTIONS[row.action]?.group === filter),
    [rows, filter]
  );


  return (
    <section className="course-section">
      <header className="course-section-head">
        <h2>
          <History size={19} aria-hidden="true" />
          Activity
        </h2>
      </header>

      <p className="course-muted">
        Every change to marks, due dates, attendance and the class list is recorded here
        automatically. Only teachers of this class can see it.
      </p>

      <div className="activity-filters" role="group" aria-label="Show">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="course-error" role="alert">{error}</p>}

      {loading ? (
        <p className="course-empty">Loading...</p>
      ) : shown.length === 0 ? (
        <p className="course-empty">Nothing recorded yet.</p>
      ) : (
        <ul className="activity-list">
          {shown.map((row) => {
            const action = ACTIONS[row.action] || { label: row.action, icon: History };
            const Icon = action.icon;
            const details = row.details || {};

            return (
              <li key={row.id}>
                <span className="activity-icon"><Icon size={15} aria-hidden="true" /></span>

                <div className="activity-text">
                  <strong>{action.label}</strong>

                  <div className="activity-line">
                    {row.student_name && (
                      <span className="activity-who" data-no-translate>
                        {row.student_name}
                        {row.student_campus_id ? ` (${row.student_campus_id})` : ""}
                      </span>
                    )}

                    {details.assignment && (
                      <span className="activity-what" data-no-translate>{details.assignment}</span>
                    )}

                    {row.action === "due_date_changed" && <Change from={details.from} to={details.to} kind="date" />}
                    {row.action === "weight_changed" && <Change from={details.from} to={details.to} kind="weight" />}
                    {row.action === "attendance_changed" && <Change from={details.from} to={details.to} kind="status" />}
                    {row.action === "semester_changed" && <Change from={details.from} to={details.to} />}
                    {["mark_given", "mark_changed", "mark_removed"].includes(row.action) && (
                      <Change from={details.from} to={row.action === "mark_removed" ? null : details.to} />
                    )}
                    {details.reason && <span className="activity-what" data-no-translate>“{details.reason}”</span>}
                  </div>

                  <small className="course-muted">
                    {formatDateTime(row.created_at)}
                    {row.actor_name && (
                      <>
                        {" · "}
                        <span>by</span>{" "}
                        <span data-no-translate>{row.actor_name}</span>
                      </>
                    )}
                  </small>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default CourseActivity;
