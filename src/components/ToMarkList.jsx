import {
  useEffect,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { loadTeachingClasses } from "../lib/classes";

import "./TodoList.css";


// =========================================================
// TO MARK (professor dashboard)
// Hand-ins from all your classes that don't have a mark yet,
// grouped by assignment, oldest first.
// =========================================================

const SHOW_MAX = 6;


function ago(value) {
  if (!value) return "";

  const hours =
    Math.round((Date.now() - new Date(value).getTime()) / 3600000);

  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} h ago`;

  const days =
    Math.round(hours / 24);

  return `${days} day${days === 1 ? "" : "s"} ago`;
}


function ToMarkList({
  onCount,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);


  useEffect(() => {
    let active =
      true;

    async function load() {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) return;

      // Classes this professor teaches (own + co-taught)
      const groups =
        await loadTeachingClasses(user.id);

      const groupIds =
        (groups || []).map((group) => group.id);

      if (groupIds.length === 0) {
        if (active) {
          setRows([]);
          setLoading(false);
          onCount?.(0);
        }
        return;
      }

      const [{ data: handedIn }, marksResult] =
        await Promise.all([
          supabase
            .from("assignment_submissions")
            .select("id, assignment_id, student_id, group_id, submitted_at, grade")
            .in("group_id", groupIds)
            .order("submitted_at", { ascending: true }),
          supabase
            .from("assignment_marks")
            .select("assignment_id, student_id, grade")
            .in("group_id", groupIds)
            .not("grade", "is", null),
        ]);

      // Marked = has a mark (supabase/14); before that SQL, the old grade column
      const marked =
        marksResult.error
          ? null
          : new Set((marksResult.data || []).map((row) => `${row.assignment_id}:${row.student_id}`));

      const waiting =
        (handedIn || []).filter((row) =>
          marked
            ? !marked.has(`${row.assignment_id}:${row.student_id}`)
            : row.grade === null
        );

      const assignmentIds =
        [...new Set((waiting || []).map((row) => row.assignment_id))];

      const { data: assignments } =
        assignmentIds.length
          ? await supabase
              .from("class_assignments")
              .select("id, title, due_at")
              .in("id", assignmentIds)
          : { data: [] };

      if (!active) return;

      const groupById =
        new Map((groups || []).map((group) => [group.id, group]));

      const assignmentById =
        new Map((assignments || []).map((item) => [item.id, item]));

      // One row per assignment: "Lab 1 · 5 to mark"
      const byAssignment =
        new Map();

      for (const row of waiting || []) {
        const entry =
          byAssignment.get(row.assignment_id) || {
            assignmentId: row.assignment_id,
            groupId: row.group_id,
            count: 0,
            late: 0,
            oldest: row.submitted_at,
          };

        const due =
          assignmentById.get(row.assignment_id)?.due_at;

        entry.count += 1;

        if (due && new Date(row.submitted_at) > new Date(due)) {
          entry.late += 1;
        }

        byAssignment.set(row.assignment_id, entry);
      }

      const list =
        [...byAssignment.values()].map((entry) => {
          const group =
            groupById.get(entry.groupId);

          return {
            ...entry,
            title: assignmentById.get(entry.assignmentId)?.title || "Assignment",
            where: group?.course_code || group?.name || "Class",
          };
        });

      setRows(list);
      setLoading(false);
      onCount?.((waiting || []).length);
    }

    load();

    return () => {
      active =
        false;
    };
    // onCount is a setter from the parent and never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  if (loading) {
    return <p className="todo-empty">Loading...</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="todo-empty">
        <CheckCircle2 size={34} aria-hidden="true" />
        <strong>Nothing to mark</strong>
        <span>When students hand in work, it will appear here.</span>
      </div>
    );
  }

  const visible =
    showAll ? rows : rows.slice(0, SHOW_MAX);


  return (
    <div className="todo">
      <ul className="todo-list">
        {visible.map((row) => (
          <li key={row.assignmentId}>
            <Link
              to={`/professor/classes/${row.groupId}`}
              className="todo-row"
            >
              <span className="todo-icon mark">
                <ClipboardList size={16} aria-hidden="true" />
              </span>

              <span className="todo-text">
                <strong>{row.title}</strong>
                <small>
                  {row.where}
                  {" · "}
                  {row.count} to mark
                  {row.late ? ` (${row.late} late)` : ""}
                  {" · oldest "}
                  {ago(row.oldest)}
                </small>
              </span>

              <span className="todo-action primary">
                Mark
                <ChevronRight size={15} aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {rows.length > SHOW_MAX && (
        <button
          type="button"
          className="todo-more"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? "Show less" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

export default ToMarkList;
