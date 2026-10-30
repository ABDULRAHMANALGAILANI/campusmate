import {
  useEffect,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
} from "lucide-react";

import { supabase } from "../lib/supabase";

import "./ClassAssignments.css";


// =========================================================
// CLASS ASSIGNMENTS (student view)
// Work professors posted in the student's classes, with
// whether it's handed in. Each one opens its class page,
// where the student hands it in. Archived classes are left out.
// =========================================================

const DAY =
  24 * 60 * 60 * 1000;


function dueLabel(dueAt) {
  if (!dueAt) {
    return { text: "No due date", tone: "neutral" };
  }

  const due =
    new Date(dueAt);

  const now =
    new Date();

  const startOfToday =
    new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const startOfDue =
    new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const days =
    Math.round((startOfDue - startOfToday) / DAY);

  if (due < now) {
    return { text: "Past due", tone: "late" };
  }

  if (days === 0) {
    return { text: "Due today", tone: "soon" };
  }

  if (days === 1) {
    return { text: "Due tomorrow", tone: "soon" };
  }

  if (days <= 7) {
    return { text: `Due in ${days} days`, tone: "upcoming" };
  }

  return { text: `Due in ${days} days`, tone: "neutral" };
}


function formatDue(dueAt) {
  if (!dueAt) {
    return "";
  }

  return new Date(dueAt).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}


function ClassAssignments() {
  const [
    assignments,
    setAssignments,
  ] = useState([]);

  const [
    classNames,
    setClassNames,
  ] = useState({});

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  const [
    handedIn,
    setHandedIn,
  ] = useState(new Set());


  useEffect(() => {
    let active =
      true;

    async function load() {
      const {
        data: authData,
      } =
        await supabase.auth.getUser();

      const user =
        authData?.user;

      if (!user) {
        if (active) setLoading(false);
        return;
      }

      // 1. Classes this student is actively in
      const {
        data: memberships,
        error: memberError,
      } =
        await supabase
          .from("course_group_members")
          .select("group_id")
          .eq("student_id", user.id)
          .eq("status", "active");

      if (memberError) {
        if (active) {
          setErrorMessage(
            "Could not load your classes: " + memberError.message
          );
          setLoading(false);
        }
        return;
      }

      const groupIds =
        (memberships || []).map((row) => row.group_id);

      if (groupIds.length === 0) {
        if (active) {
          setAssignments([]);
          setLoading(false);
        }
        return;
      }

      // 2. Class names + 3. assignments, in parallel
      const [
        groupsResult,
        assignmentsResult,
        submissionsResult,
      ] =
        await Promise.all([
          supabase
            .from("course_groups")
            .select("*")
            .in("id", groupIds),

          supabase
            .from("class_assignments")
            .select("*")
            .in("group_id", groupIds)
            .order("due_at", { ascending: true }),

          supabase
            .from("assignment_submissions")
            .select("assignment_id")
            .eq("student_id", user.id),
        ]);

      if (!active) {
        return;
      }

      if (assignmentsResult.error) {
        setErrorMessage(
          "Could not load class assignments: " +
            assignmentsResult.error.message
        );
        setLoading(false);
        return;
      }

      const names = {};

      const archived =
        new Set((groupsResult.data || []).filter((group) => group.archived_at).map((group) => group.id));

      setHandedIn(new Set((submissionsResult.data || []).map((row) => row.assignment_id)));

      (groupsResult.data || []).forEach((group) => {
        names[group.id] =
          group.course_code
            ? `${group.course_code} · ${group.name}`
            : group.name;
      });

      // Upcoming first (soonest at top), past-due at the bottom
      const now =
        Date.now();

      const sorted =
        [...(assignmentsResult.data || [])]
          .filter((item) => !archived.has(item.group_id))
          .sort((a, b) => {
          const aPast = a.due_at && new Date(a.due_at) < now;
          const bPast = b.due_at && new Date(b.due_at) < now;

          if (aPast !== bPast) {
            return aPast ? 1 : -1;
          }

          return (
            new Date(a.due_at || 8.64e15) -
            new Date(b.due_at || 8.64e15)
          );
        });

      setClassNames(names);
      setAssignments(sorted);
      setLoading(false);
    }

    load();

    return () => {
      active =
        false;
    };
  }, []);


  return (
    <section className="class-assignments">

      <div className="class-assignments-header">
        <h2>
          <GraduationCap
            size={20}
            aria-hidden="true"
          />
          From your professors
        </h2>
        <p className="class-assignments-hint">Hand these in on each class page. Your own tasks are below.</p>

        {!loading && assignments.length > 0 && (
          <span className="class-assignments-count">
            {assignments.length}
          </span>
        )}
      </div>


      {loading && (
        <p className="class-assignments-message">
          Loading class assignments...
        </p>
      )}


      {!loading && errorMessage && (
        <p
          className="class-assignments-message error"
          role="alert"
        >
          {errorMessage}
        </p>
      )}


      {!loading && !errorMessage && assignments.length === 0 && (
        <p className="class-assignments-message">
          No class assignments yet. When a professor posts work
          for one of your classes, it will show up here.
        </p>
      )}


      {!loading && !errorMessage && assignments.length > 0 && (
        <ul className="class-assignments-list">
          {assignments.map((item) => {
            const done =
              handedIn.has(item.id);

            const markOnly =
              item.hand_in === false;

            const status =
              done
                ? { text: "Handed in", tone: "done" }
                : markOnly
                  ? { text: "Exam / test", tone: "neutral" }
                  : dueLabel(item.due_at);

            return (
              <li
                key={item.id}
                className={`class-assignment ${status.tone}`}
              >
                <div className="class-assignment-main">
                  <h3>{item.title}</h3>

                  <p className="class-assignment-class">
                    <BookOpen
                      size={14}
                      aria-hidden="true"
                    />
                    {classNames[item.group_id] || "Class"}
                  </p>

                  {item.description && (
                    <p className="class-assignment-description">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="class-assignment-side">
                  <span className={`class-assignment-badge ${status.tone}`}>
                    {status.text}
                  </span>

                  {item.due_at && (
                    <span className="class-assignment-date">
                      <CalendarClock
                        size={14}
                        aria-hidden="true"
                      />
                      {formatDue(item.due_at)}
                    </span>
                  )}

                  {item.points != null && (
                    <span className="class-assignment-points">
                      {item.points} points
                    </span>
                  )}

                  <Link to={`/classes/${item.group_id}`} className="class-assignment-open">
                    {done ? <CheckCircle2 size={14} aria-hidden="true" /> : null}
                    {done || markOnly ? "Open class" : "Open to hand in"}
                    <ChevronRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

    </section>
  );
}

export default ClassAssignments;
