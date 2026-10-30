import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useParams,
  useSearchParams,
} from "react-router-dom";

import {
  Archive,
  ArchiveRestore,
  BookOpen,
  CalendarCheck,
  ChevronLeft,
  Download,
  ExternalLink,
  FileText,
  FolderKanban,
  Link2,
  Megaphone,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import {
  MATERIAL_LIMIT_MB,
  formatSize,
  openFile,
  removeFile,
  tooBig,
  uploadMaterial,
} from "../../lib/courseFiles";

import Sidebar from "../../components/Sidebar";
import ProfessorSidebar from "../../components/ProfessorSidebar";
import NotificationBell from "../../components/NotificationBell";
import UserAvatar from "../../components/UserAvatar";

import AssignmentForm from "../../components/AssignmentForm";

import CourseActivity from "./CourseActivity";
import CourseAssignments from "./CourseAssignments";
import CourseAttention from "./CourseAttention";
import CourseAttendance from "./CourseAttendance";
import CourseGrades from "./CourseGrades";
import CourseQA from "./CourseQA";
import CourseQuizzes from "./CourseQuizzes";
import CourseRoster from "./CourseRoster";
import CourseTimetable from "./CourseTimetable";

import {
  attendanceStats,
  formatDateTime,
  mergeMarks,
} from "../../lib/courseHelpers";

import "./CoursePage.css";
import "./CourseExtras.css";


// =========================================================
// COURSE PAGE
// One page per class, like USM eLearning:
//   Course        about, class times, announcements,
//                 materials, assignments
//   Q&A           questions and answers for the class
//   Quizzes       multiple choice, marked automatically
//   Participants  professor, co-lecturers, tutors, students
//   Grades        marks, weights, final grade
//   Attendance    record, % and absence excuses (MC)
//   Activity      (teachers) who changed marks, dates, etc.
// Students open it from My Class, professors from Classes.
// Co-lecturers and tutors get the same tools as the professor.
// Archived classes (past semesters) are read-only.
// =========================================================

const TABS = [
  ["course", "Course"],
  ["qa", "Q&A"],
  ["quizzes", "Quizzes"],
  ["participants", "Participants"],
  ["grades", "Grades"],
  ["attendance", "Attendance"],
  ["activity", "Activity", "teacher"],
];


// Runs a query; a table that doesn't exist yet (SQL not run)
// just gives an empty list.
async function safeRows(query) {
  const { data, error } = await query;
  if (error) return { rows: [], missing: /does not exist|schema cache|not find/i.test(error.message) };
  return { rows: data || [], missing: false };
}


function Section({ id, icon: Icon, title, action, children }) {
  return (
    <section className="course-section" id={id}>
      <header className="course-section-head">
        <h2>
          <Icon size={19} aria-hidden="true" />
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}


function formatDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}


// ---------------------------------------------------------
// ANNOUNCEMENTS + MATERIALS
// ---------------------------------------------------------

function PostForm({ kind, groupId, userId, onDone, onCancel }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isMaterial =
    kind === "material";


  async function save(event) {
    event.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Give it a title.");
      return;
    }

    if (isMaterial && !file && !link.trim()) {
      setError("Attach a file or paste a link.");
      return;
    }

    if (link.trim() && !/^https?:\/\//i.test(link.trim())) {
      setError("Links must start with https://");
      return;
    }

    if (tooBig(file, MATERIAL_LIMIT_MB)) {
      setError(`That file is too big. The limit is ${MATERIAL_LIMIT_MB} MB.`);
      return;
    }

    setSaving(true);

    let filePath = null;

    try {
      if (file) {
        filePath = await uploadMaterial(groupId, file);
      }

      const { error: insertError } =
        await supabase
          .from("course_posts")
          .insert({
            group_id: groupId,
            author_id: userId,
            kind,
            title: title.trim(),
            body: body.trim() || null,
            link_url: link.trim() || null,
            file_path: filePath,
            file_name: file?.name || null,
          });

      if (insertError) throw insertError;

      onDone();
    } catch (saveError) {
      if (filePath) await removeFile("course-files", filePath);
      setError(saveError.message || "Couldn't post it. Try again.");
      setSaving(false);
    }
  }


  return (
    <form className="course-post-form" onSubmit={save}>
      {error && <p className="course-error" role="alert">{error}</p>}

      <label className="course-field">
        <span>Title</span>
        <input
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={isMaterial ? "e.g. Week 3 lecture slides" : "e.g. No class on Friday"}
          autoFocus
        />
      </label>

      <label className="course-field">
        <span>{isMaterial ? "Description" : "Message"} {isMaterial && <em>(optional)</em>}</span>
        <textarea
          rows={isMaterial ? 2 : 4}
          value={body}
          maxLength={5000}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>

      {isMaterial && (
        <div className="course-field-row">
          <label className="course-dropzone small">
            <Paperclip size={18} aria-hidden="true" />
            <span>
              {file ? <><strong>{file.name}</strong> ({formatSize(file.size)})</> : <>Attach a file <small>(up to {MATERIAL_LIMIT_MB} MB)</small></>}
            </span>
            <input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </label>

          <label className="course-field">
            <span>or a link <em>(optional)</em></span>
            <input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://"
              inputMode="url"
            />
          </label>
        </div>
      )}

      <div className="course-actions">
        <button type="submit" className="course-button primary" disabled={saving}>
          {saving ? "Posting..." : isMaterial ? "Add material" : "Post announcement"}
        </button>
        <button type="button" className="course-button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}


function PostList({ posts, isProfessor, onDelete, emptyText }) {
  const [error, setError] = useState("");

  if (posts.length === 0) {
    return <p className="course-empty">{emptyText}</p>;
  }

  async function download(post) {
    setError("");
    try {
      await openFile("course-files", post.file_path, post.file_name);
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  return (
    <>
      {error && <p className="course-error" role="alert">{error}</p>}
      <ul className="course-post-list">
        {posts.map((post) => (
          <li key={post.id}>
            <span className={`course-activity-icon ${post.kind}`}>
              {post.kind === "announcement"
                ? <Megaphone size={17} aria-hidden="true" />
                : post.file_path
                  ? <FileText size={17} aria-hidden="true" />
                  : <Link2 size={17} aria-hidden="true" />}
            </span>

            <div className="course-post-text">
              <strong>{post.title}</strong>
              {post.body && <p>{post.body}</p>}

              <div className="course-post-links">
                {post.file_path && (
                  <button type="button" className="course-file-link" onClick={() => download(post)}>
                    <Download size={14} aria-hidden="true" />
                    {post.file_name}
                  </button>
                )}
                {post.link_url && (
                  <a className="course-file-link" href={post.link_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} aria-hidden="true" />
                    Open link
                  </a>
                )}
              </div>

              <small className="course-muted">Posted {formatDateTime(post.created_at)}</small>
            </div>

            {isProfessor && (
              <button
                type="button"
                className="course-icon-button"
                onClick={() => onDelete(post)}
                aria-label={`Delete ${post.title}`}
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}


// ---------------------------------------------------------
// PAGE
// ---------------------------------------------------------

function CoursePage() {
  const {
    groupId,
  } = useParams();

  const [searchParams, setSearchParams] = useSearchParams();

  const [userId, setUserId] = useState("");
  const [me, setMe] = useState(null);
  const [course, setCourse] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [marks, setMarks] = useState([]);
  const [posts, setPosts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [excuses, setExcuses] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [marksMissing, setMarksMissing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState("");
  const [adding, setAdding] = useState("");
  const [assignmentForm, setAssignmentForm] = useState(null);
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutText, setAboutText] = useState("");
  const [savingAbout, setSavingAbout] = useState(false);
  const [notice, setNotice] = useState("");
  const [semesterText, setSemesterText] = useState("");
  const [editingSemester, setEditingSemester] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const tab =
    TABS.some(([id]) => id === searchParams.get("tab")) ? searchParams.get("tab") : "course";

  function setTab(id) {
    setSearchParams(id === "course" ? {} : { tab: id }, { replace: true });
  }


  const loadAll = useCallback(async () => {
    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) return;

    setUserId(user.id);

    const [profileResult, courseResult, peopleResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, role, programme, avatar_path")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("course_groups")
          .select("*")
          .eq("id", groupId)
          .maybeSingle(),
        supabase.rpc("class_participants", { gid: groupId }),
      ]);

    setMe(profileResult.data || null);

    if (!courseResult.data) {
      setProblem("This class doesn't exist, or you haven't joined it.");
      setLoading(false);
      return;
    }

    setCourse(courseResult.data);
    setAboutText(courseResult.data.description || "");
    setSemesterText(courseResult.data.semester || "");

    const people =
      peopleResult.data || [];

    const teaches =
      courseResult.data.professor_id === user.id ||
      people.some((person) => person.id === user.id && person.role === "teacher");

    const [
      assignmentResult,
      submissionResult,
      markResult,
      postResult,
      attendanceResult,
      excuseResult,
      meetingResult,
      questionResult,
      answerResult,
      quizResult,
      attemptResult,
    ] =
      await Promise.all([
        safeRows(
          supabase
            .from("class_assignments")
            .select("*")
            .eq("group_id", groupId)
            .order("due_at", { ascending: true })
        ),
        safeRows(supabase.from("assignment_submissions").select("*").eq("group_id", groupId)),
        safeRows(supabase.from("assignment_marks").select("*").eq("group_id", groupId)),
        safeRows(
          supabase
            .from("course_posts")
            .select("*")
            .eq("group_id", groupId)
            .order("created_at", { ascending: false })
        ),
        safeRows(
          teaches
            ? supabase
                .from("attendance_records")
                .select("id, status, created_at, student_id, session_id")
                .eq("group_id", groupId)
                .order("created_at", { ascending: false })
            : supabase
                .from("attendance_records")
                .select("id, status, created_at, student_id, session_id")
                .eq("group_id", groupId)
                .eq("student_id", user.id)
                .order("created_at", { ascending: false })
        ),
        safeRows(supabase.from("attendance_excuses").select("*").eq("group_id", groupId)),
        safeRows(supabase.from("class_meetings").select("*").eq("group_id", groupId)),
        safeRows(
          supabase
            .from("course_questions")
            .select("*")
            .eq("group_id", groupId)
            .order("created_at", { ascending: false })
        ),
        safeRows(
          supabase
            .from("course_answers")
            .select("*")
            .eq("group_id", groupId)
            .order("created_at", { ascending: true })
        ),
        safeRows(supabase.from("quizzes").select("*").eq("group_id", groupId)),
        safeRows(supabase.from("quiz_attempts").select("*").eq("group_id", groupId)),
      ]);

    const coursePagesMissing =
      peopleResult.error && /does not exist|not find|schema cache/i.test(peopleResult.error.message);

    if (coursePagesMissing || submissionResult.missing || postResult.missing) {
      setProblem("Course pages aren't set up in the database yet. Run supabase/9-course-pages.sql in the Supabase SQL Editor.");
    } else if (!teaches && !people.some((person) => person.id === user.id)) {
      setProblem("You haven't joined this class.");
    } else {
      setProblem("");
    }

    setNeedsUpdate(
      [markResult, excuseResult, meetingResult, questionResult, quizResult].some((result) => result.missing) ||
      Boolean(people.length && !("title" in people[0]))
    );

    setMarksMissing(markResult.missing);
    setParticipants(people);
    setAssignments(assignmentResult.rows);
    setSubmissions(submissionResult.rows);
    setMarks(markResult.rows);
    setPosts(postResult.rows);
    setAttendance(attendanceResult.rows);
    setExcuses(excuseResult.rows);
    setMeetings(meetingResult.rows);
    setQuestions(questionResult.rows);
    setAnswers(answerResult.rows);
    setQuizzes(quizResult.rows);
    setAttempts(attemptResult.rows);
    setLoading(false);
  }, [groupId]);


  // Phones: keep the chosen tab visible in the scrolling tab bar
  useEffect(() => {
    document
      .querySelector(".course-tabs button.active")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [tab, loading]);


  useEffect(() => {
    // Data loading on page open / class change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll]);


  const isOwner =
    Boolean(course && userId && course.professor_id === userId);

  const isTeacher =
    isOwner || participants.some((person) => person.id === userId && person.role === "teacher");

  // Past semester: everything stays readable, nothing can change
  const archived =
    Boolean(course?.archived_at);

  const canEdit =
    isTeacher && !archived;

  const visibleTabs =
    TABS.filter(([, , who]) => who !== "teacher" || isTeacher);

  const professor =
    participants.find((person) => person.role === "professor");

  const teachers =
    participants.filter((person) => person.role === "teacher");

  const students = useMemo(
    () =>
      participants
        .filter((person) => person.role === "student")
        .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")),
    [participants]
  );

  // Hand-ins with their (visible) marks
  // (Before supabase/14 is run, marks are still on the hand-in rows.)
  const rows = useMemo(
    () => (marksMissing ? submissions : mergeMarks(submissions, marks)),
    [submissions, marks, marksMissing]
  );

  const announcements =
    posts.filter((post) => post.kind === "announcement");

  const materials =
    posts.filter((post) => post.kind === "material");

  const nextDue = useMemo(
    () =>
      assignments
        .filter((assignment) => assignment.due_at && new Date(assignment.due_at) > new Date())
        .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))[0],
    [assignments]
  );

  const attendanceByStudent = useMemo(
    () => new Map(students.map((student) => [student.id, attendanceStats(attendance, excuses, student.id)])),
    [attendance, excuses, students]
  );

  const pendingExcuses =
    isTeacher ? excuses.filter((row) => row.status === "pending").length : 0;

  const openQuestions =
    questions.filter((question) => !question.is_resolved && !answers.some((answer) => answer.question_id === question.id)).length;


  async function saveAbout() {
    setSavingAbout(true);

    const { error } =
      await supabase
        .from("course_groups")
        .update({ description: aboutText.trim() || null })
        .eq("id", groupId);

    setSavingAbout(false);

    if (error) {
      setNotice("Couldn't save: " + error.message);
      return;
    }

    setEditingAbout(false);
    setCourse((current) => ({ ...current, description: aboutText.trim() || null }));
  }


  async function saveSemester(event) {
    event.preventDefault();

    const { error } =
      await supabase.rpc("set_class_semester", { input_group_id: groupId, input_semester: semesterText.trim() });

    if (error) {
      setNotice(
        /set_class_semester|schema cache/i.test(error.message)
          ? "Semesters need supabase/18-semesters-and-activity.sql. Run it once in Supabase."
          : "Couldn't save: " + error.message
      );
      return;
    }

    setEditingSemester(false);
    setCourse((current) => ({ ...current, semester: semesterText.trim() || null }));
  }


  async function toggleArchived() {
    const goingToArchive = !archived;

    if (
      goingToArchive &&
      !window.confirm(
        "Archive this class? It moves to past classes and becomes read-only for everyone. Marks, files and attendance are kept. You can un-archive it later."
      )
    ) {
      return;
    }

    setArchiving(true);

    const { error } =
      await supabase.rpc("set_class_archived", { input_group_id: groupId, input_archived: goingToArchive });

    setArchiving(false);

    if (error) {
      setNotice(
        /set_class_archived|schema cache/i.test(error.message)
          ? "Archiving needs supabase/18-semesters-and-activity.sql. Run it once in Supabase."
          : "Couldn't change it: " + error.message
      );
      return;
    }

    setNotice("");
    loadAll();
  }


  async function deletePost(post) {
    if (!window.confirm(`Delete "${post.title}"?`)) return;

    const { error } =
      await supabase
        .from("course_posts")
        .delete()
        .eq("id", post.id);

    if (error) {
      setNotice("Couldn't delete: " + error.message);
      return;
    }

    if (post.file_path) await removeFile("course-files", post.file_path);
    loadAll();
  }


  const Nav =
    me?.role === "professor" ? ProfessorSidebar : Sidebar;

  const backLink =
    me?.role === "professor" ? "/professor/classes" : "/classes";

  const tabBadge = {
    qa: isTeacher && openQuestions ? openQuestions : 0,
    attendance: pendingExcuses,
  };


  // ---------- Render ----------

  return (
    <div className="course-page">
      <Nav />

      <main className={`course-main ${me?.role === "professor" ? "professor" : "student"}`}>

        <header className="course-topbar">
          <Link to={backLink} className="course-back">
            <ChevronLeft size={18} aria-hidden="true" />
            {me?.role === "professor" ? "Classes" : "My Classes"}
          </Link>

          <div className="course-topbar-right">
            <NotificationBell />
            {me && <UserAvatar profile={me} name={me.full_name} size={40} />}
          </div>
        </header>

        <div className="course-content">

          {loading ? (
            <p className="course-empty">Loading class...</p>
          ) : !course ? (
            <div className="course-problem">
              <p>{problem}</p>
              <Link to={backLink} className="course-button primary">Back to my classes</Link>
            </div>
          ) : (
            <>
              <nav className="course-breadcrumb" aria-label="Breadcrumb">
                <Link to={backLink}>{me?.role === "professor" ? "Classes" : "My Classes"}</Link>
                <span>/</span>
                <span>{course.course_code || course.name}</span>
              </nav>

              <section className="course-banner">
                <span className={`course-banner-badge ${course.is_active && !archived ? "" : "closed"}`}>
                  {archived ? "Archived" : course.is_active ? "Active" : "Closed"}
                </span>
                <h1>
                  {course.course_code && <span>{course.course_code}</span>}
                  {course.name}
                </h1>
                <p>
                  {[professor, ...teachers].filter(Boolean).map((person) => person.full_name).join(", ") || "Professor"}
                  {" · "}
                  {students.length} {students.length === 1 ? "student" : "students"}
                  {course.semester && (
                    <>
                      {" · "}
                      <span data-no-translate>{course.semester}</span>
                    </>
                  )}
                </p>
              </section>

              {archived && (
                <div className="course-archived-note" role="status">
                  <Archive size={18} aria-hidden="true" />
                  <span>
                    This class is archived (past semester). You can still read everything, but nothing
                    can be changed.
                    {isOwner ? " Un-archive it to make changes." : ""}
                  </span>
                </div>
              )}

              {problem && (
                <p className="course-error" role="alert">{problem}</p>
              )}

              {needsUpdate && isTeacher && (
                <p className="course-warning">
                  Some new features (marks release, Q&amp;A, quizzes, class times, excuses, co-lecturers) need
                  supabase/14-real-classroom.sql. Run it once in the Supabase SQL Editor.
                </p>
              )}

              {notice && (
                <p className="course-error" role="alert">{notice}</p>
              )}

              <div className="course-tabs" role="tablist" aria-label="Course">
                {visibleTabs.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    className={tab === id ? "active" : ""}
                    onClick={() => setTab(id)}
                  >
                    {label}
                    {tabBadge[id] ? <span className="course-tab-badge">{tabBadge[id]}</span> : null}
                  </button>
                ))}
              </div>


              {/* ================= COURSE ================= */}
              {tab === "course" && (
                <div className="course-sections">

                  {canEdit && (
                    <CourseAttention
                      assignments={assignments}
                      rows={rows}
                      students={students}
                      attendanceByStudent={attendanceByStudent}
                      openQuestions={openQuestions}
                      pendingExcuses={pendingExcuses}
                      onOpenTab={setTab}
                    />
                  )}

                  <Section
                    icon={BookOpen}
                    title="General"
                    action={isOwner && !archived && !editingAbout && (
                      <button type="button" className="course-button small" onClick={() => setEditingAbout(true)}>
                        <Pencil size={14} aria-hidden="true" />
                        Edit
                      </button>
                    )}
                  >
                    {editingAbout ? (
                      <div className="course-post-form">
                        <label className="course-field">
                          <span>About this course (synopsis, rules)</span>
                          <textarea
                            rows={6}
                            value={aboutText}
                            onChange={(event) => setAboutText(event.target.value)}
                          />
                        </label>
                        <div className="course-actions">
                          <button type="button" className="course-button primary" onClick={saveAbout} disabled={savingAbout}>
                            {savingAbout ? "Saving..." : "Save"}
                          </button>
                          <button type="button" className="course-button" onClick={() => { setEditingAbout(false); setAboutText(course.description || ""); }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="course-about">
                        {course.description || (isOwner
                          ? "Add a synopsis and any rules for students."
                          : "No course description yet.")}
                      </p>
                    )}

                    <dl className="course-facts">
                      <div>
                        <dt>Professor</dt>
                        <dd>{professor?.full_name || "—"}</dd>
                      </div>
                      {teachers.length > 0 && (
                        <div>
                          <dt>{teachers.length === 1 ? teachers[0].title : "Co-lecturers & tutors"}</dt>
                          <dd>{teachers.map((person) => person.full_name).join(", ")}</dd>
                        </div>
                      )}
                      <div>
                        <dt>Students</dt>
                        <dd>{students.length}</dd>
                      </div>
                      <div>
                        <dt>Semester</dt>
                        <dd>
                          {editingSemester ? (
                            <form className="course-semester-form" onSubmit={saveSemester}>
                              <input
                                value={semesterText}
                                maxLength={60}
                                onChange={(event) => setSemesterText(event.target.value)}
                                placeholder="e.g. Semester 1, 2026/2027"
                                aria-label="Semester"
                                autoFocus
                              />
                              <button type="submit" className="course-button small primary">Save</button>
                              <button
                                type="button"
                                className="course-button small"
                                onClick={() => { setEditingSemester(false); setSemesterText(course.semester || ""); }}
                              >
                                Cancel
                              </button>
                            </form>
                          ) : (
                            <>
                              <span data-no-translate>{course.semester || ""}</span>
                              {!course.semester && "Not set"}
                              {isOwner && !archived && (
                                <button type="button" className="course-link-button" onClick={() => setEditingSemester(true)}>
                                  {course.semester ? "Change" : "Set semester"}
                                </button>
                              )}
                            </>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Next deadline</dt>
                        <dd>{nextDue ? `${nextDue.title} · ${formatDate(nextDue.due_at)}` : "None coming up"}</dd>
                      </div>
                    </dl>

                    <CourseTimetable
                      groupId={groupId}
                      meetings={meetings}
                      isTeacher={canEdit}
                      onChanged={loadAll}
                    />

                    {isOwner && (
                      <div className="course-archive-row">
                        <button
                          type="button"
                          className="course-button small"
                          onClick={toggleArchived}
                          disabled={archiving}
                        >
                          {archived
                            ? <ArchiveRestore size={14} aria-hidden="true" />
                            : <Archive size={14} aria-hidden="true" />}
                          {archiving ? "Saving..." : archived ? "Un-archive class" : "Archive class (end of semester)"}
                        </button>
                      </div>
                    )}
                  </Section>


                  <Section
                    icon={Megaphone}
                    title="Announcements"
                    action={canEdit && adding !== "announcement" && (
                      <button type="button" className="course-button small" onClick={() => setAdding("announcement")}>
                        <Plus size={14} aria-hidden="true" />
                        Post
                      </button>
                    )}
                  >
                    {adding === "announcement" && (
                      <PostForm
                        kind="announcement"
                        groupId={groupId}
                        userId={userId}
                        onCancel={() => setAdding("")}
                        onDone={() => { setAdding(""); loadAll(); }}
                      />
                    )}
                    <PostList
                      posts={announcements}
                      isProfessor={canEdit}
                      onDelete={deletePost}
                      emptyText="No announcements yet."
                    />
                  </Section>


                  <Section
                    icon={Paperclip}
                    title="Course materials"
                    action={canEdit && adding !== "material" && (
                      <button type="button" className="course-button small" onClick={() => setAdding("material")}>
                        <Plus size={14} aria-hidden="true" />
                        Add
                      </button>
                    )}
                  >
                    {adding === "material" && (
                      <PostForm
                        kind="material"
                        groupId={groupId}
                        userId={userId}
                        onCancel={() => setAdding("")}
                        onDone={() => { setAdding(""); loadAll(); }}
                      />
                    )}
                    <PostList
                      posts={materials}
                      isProfessor={canEdit}
                      onDelete={deletePost}
                      emptyText={isTeacher ? "Add lecture slides, notes, the course planner or useful links." : "No materials yet."}
                    />
                  </Section>


                  <Section
                    id="course-assignments"
                    icon={FileText}
                    title="Assignments, tests and exams"
                    action={canEdit && !assignmentForm && (
                      <button type="button" className="course-button small" onClick={() => setAssignmentForm({ assignment: null })}>
                        <Plus size={14} aria-hidden="true" />
                        New
                      </button>
                    )}
                  >
                    {assignmentForm && (
                      <div className="course-form-card">
                        <h3>{assignmentForm.assignment ? `Edit: ${assignmentForm.assignment.title}` : "New assignment"}</h3>
                        <AssignmentForm
                          key={assignmentForm.assignment?.id || "new"}
                          assignment={assignmentForm.assignment}
                          fixedGroupId={groupId}
                          userId={userId}
                          onCancel={() => setAssignmentForm(null)}
                          onSaved={() => { setAssignmentForm(null); loadAll(); }}
                        />
                      </div>
                    )}
                    <CourseAssignments
                      assignments={assignments}
                      submissions={rows}
                      students={students}
                      isProfessor={isTeacher}
                      groupId={groupId}
                      userId={userId}
                      onChanged={loadAll}
                      onEdit={(assignment) => {
                        if (archived) return;
                        setAssignmentForm({ assignment });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    />
                  </Section>


                  <div className="course-quick-grid">
                    <Link to={isTeacher ? "/professor/projects" : "/projects"} className="course-quick">
                      <span className="course-activity-icon project"><FolderKanban size={18} aria-hidden="true" /></span>
                      <span>
                        <strong>Group projects</strong>
                        <small>{isTeacher ? "Teams, updates and feedback" : "Your team, updates and files"}</small>
                      </span>
                    </Link>

                    <button type="button" className="course-quick" onClick={() => setTab("attendance")}>
                      <span className="course-activity-icon attendance"><CalendarCheck size={18} aria-hidden="true" /></span>
                      <span>
                        <strong>Attendance</strong>
                        <small>{isTeacher ? "Take attendance, report, excuses" : "Your record and excuses"}</small>
                      </span>
                    </button>
                  </div>
                </div>
              )}


              {/* ================= Q&A ================= */}
              {tab === "qa" && (
                <CourseQA
                  groupId={groupId}
                  userId={userId}
                  isTeacher={isTeacher}
                  participants={participants}
                  questions={questions}
                  answers={answers}
                  onChanged={loadAll}
                />
              )}


              {/* ================= QUIZZES ================= */}
              {tab === "quizzes" && (
                <CourseQuizzes
                  groupId={groupId}
                  userId={userId}
                  isTeacher={isTeacher}
                  quizzes={quizzes}
                  attempts={attempts}
                  students={students}
                  onChanged={loadAll}
                />
              )}


              {/* ================= PARTICIPANTS ================= */}
              {tab === "participants" && (
                <CourseRoster
                  groupId={groupId}
                  userId={userId}
                  professor={professor}
                  teachers={teachers}
                  students={students}
                  isTeacher={isTeacher}
                  isOwner={isOwner}
                  assignmentCount={assignments.filter((a) => a.hand_in !== false).length}
                  handedInCount={(studentId) => submissions.filter((row) => row.student_id === studentId).length}
                  attendanceByStudent={attendanceByStudent}
                  onChanged={loadAll}
                />
              )}


              {/* ================= GRADES ================= */}
              {tab === "grades" && (
                <CourseGrades
                  course={course}
                  assignments={assignments}
                  quizzes={quizzes.filter((quiz) => isTeacher || quiz.is_published)}
                  attempts={attempts}
                  rows={rows}
                  students={students}
                  isTeacher={isTeacher}
                  userId={userId}
                  onChanged={loadAll}
                />
              )}


              {/* ================= ACTIVITY ================= */}
              {tab === "activity" && isTeacher && (
                <CourseActivity groupId={groupId} />
              )}


              {/* ================= ATTENDANCE ================= */}
              {tab === "attendance" && (
                <CourseAttendance
                  course={course}
                  groupId={groupId}
                  userId={userId}
                  isTeacher={isTeacher}
                  students={students}
                  records={attendance}
                  excuses={excuses}
                  onChanged={loadAll}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default CoursePage;
