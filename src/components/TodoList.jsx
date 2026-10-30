import {
  useEffect,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  CheckCircle2,
  ChevronRight,
  FileText,
  ListTodo,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { currentClassIds } from "../lib/classes";

import "./TodoList.css";


// =========================================================
// TO DO (student dashboard)
// Everything still to do, soonest first:
//   * professors' assignments not handed in yet
//   * your own assignments not completed yet
// =========================================================

const SHOW_MAX = 6;


function dueText(value) {
  if (!value) {
    return { text: "No due date", tone: "" };
  }

  const due =
    new Date(value);

  const start =
    new Date();

  start.setHours(0, 0, 0, 0);

  const days =
    Math.floor((new Date(due).setHours(0, 0, 0, 0) - start) / 86400000);

  const time =
    due.getHours() || due.getMinutes()
      ? ` ${due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : "";

  if (due < new Date()) return { text: "Overdue", tone: "overdue" };
  if (days === 0) return { text: `Due today${time}`, tone: "soon" };
  if (days === 1) return { text: `Due tomorrow${time}`, tone: "soon" };
  if (days < 7) {
    return {
      text: `Due ${due.toLocaleDateString([], { weekday: "long" })}`,
      tone: "",
    };
  }

  return {
    text: `Due ${due.toLocaleDateString([], { day: "numeric", month: "short" })}`,
    tone: "",
  };
}


function TodoList({
  onCount,
}) {
  const [items, setItems] = useState([]);
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

      // Your classes
      const { data: memberships } =
        await supabase
          .from("course_group_members")
          .select("group_id")
          .eq("student_id", user.id)
          .eq("status", "active");

      // Past-semester (archived) classes are left out
      const groupIds =
        await currentClassIds((memberships || []).map((row) => row.group_id));

      const [classWork, groups, handedIn, personal, quizzes, attempts] =
        await Promise.all([
          groupIds.length
            ? supabase
                .from("class_assignments")
                .select("*")
                .in("group_id", groupIds)
            : { data: [] },
          groupIds.length
            ? supabase
                .from("course_groups")
                .select("id, name, course_code")
                .in("id", groupIds)
            : { data: [] },
          supabase
            .from("assignment_submissions")
            .select("assignment_id")
            .eq("student_id", user.id),
          supabase
            .from("assignments")
            .select("id, title, subject, due_date, status, progress")
            .eq("user_id", user.id),
          // Quizzes (supabase/14-real-classroom.sql); empty if not set up
          groupIds.length
            ? supabase
                .from("quizzes")
                .select("id, group_id, title, opens_at, closes_at, is_published")
                .in("group_id", groupIds)
                .eq("is_published", true)
            : { data: [] },
          supabase
            .from("quiz_attempts")
            .select("quiz_id, submitted_at")
            .eq("student_id", user.id),
        ]);

      if (!active) return;

      const groupById =
        new Map((groups.data || []).map((group) => [group.id, group]));

      const submitted =
        new Set((handedIn.data || []).map((row) => row.assignment_id));

      const fromProfessors =
        (classWork.data || [])
          // Exams/tests entered by the professor have nothing to hand in
          .filter((work) => work.hand_in !== false)
          .filter((work) => !submitted.has(work.id))
          // Hide work that closed more than 2 weeks ago
          .filter((work) => !work.due_at || new Date(work.due_at) > new Date(Date.now() - 14 * 86400000))
          .map((work) => {
            const group =
              groupById.get(work.group_id);

            return {
              key: `class-${work.id}`,
              title: work.title,
              where: group?.course_code || group?.name || "Class",
              due: work.due_at,
              link: `/classes/${work.group_id}`,
              action: "Hand in",
              fromProfessor: true,
            };
          });

      const own =
        (personal.data || [])
          .filter((work) => work.status !== "completed" && Number(work.progress || 0) < 100)
          .map((work) => ({
            key: `own-${work.id}`,
            title: work.title,
            where: work.subject || "My assignment",
            due: work.due_date,
            link: "/assignments",
            action: "Open",
            fromProfessor: false,
          }));

      const doneQuizzes =
        new Set((attempts.data || []).filter((row) => row.submitted_at).map((row) => row.quiz_id));

      const now =
        new Date();

      const openQuizzes =
        (quizzes.data || [])
          .filter((quiz) => !doneQuizzes.has(quiz.id))
          .filter((quiz) => !quiz.opens_at || new Date(quiz.opens_at) <= now)
          .filter((quiz) => !quiz.closes_at || new Date(quiz.closes_at) > now)
          .map((quiz) => {
            const group =
              groupById.get(quiz.group_id);

            return {
              key: `quiz-${quiz.id}`,
              title: `Quiz: ${quiz.title}`,
              where: group?.course_code || group?.name || "Class",
              due: quiz.closes_at,
              link: `/classes/${quiz.group_id}?tab=quizzes`,
              action: "Take quiz",
              fromProfessor: true,
            };
          });

      const all =
        [...fromProfessors, ...openQuizzes, ...own].sort((a, b) => {
          if (!a.due) return 1;
          if (!b.due) return -1;
          return new Date(a.due) - new Date(b.due);
        });

      setItems(all);
      setLoading(false);
      onCount?.(all.length);
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

  if (items.length === 0) {
    return (
      <div className="todo-empty">
        <CheckCircle2 size={34} aria-hidden="true" />
        <strong>Nothing to do right now</strong>
        <span>New work from your professors will appear here.</span>
      </div>
    );
  }

  const visible =
    showAll ? items : items.slice(0, SHOW_MAX);


  return (
    <div className="todo">
      <ul className="todo-list">
        {visible.map((item) => {
          const due =
            dueText(item.due);

          return (
            <li key={item.key}>
              <Link to={item.link} className="todo-row">
                <span className={`todo-icon ${item.fromProfessor ? "class" : "own"}`}>
                  {item.fromProfessor
                    ? <FileText size={16} aria-hidden="true" />
                    : <ListTodo size={16} aria-hidden="true" />}
                </span>

                <span className="todo-text">
                  <strong>{item.title}</strong>
                  <small>
                    {item.where}
                    {" · "}
                    <span className={`todo-due ${due.tone}`}>{due.text}</span>
                  </small>
                </span>

                <span className={`todo-action ${item.fromProfessor ? "primary" : ""}`}>
                  {item.action}
                  <ChevronRight size={15} aria-hidden="true" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {items.length > SHOW_MAX && (
        <button
          type="button"
          className="todo-more"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? "Show less" : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

export default TodoList;
