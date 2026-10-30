import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { removeFile } from "../../lib/courseFiles";
import { loadTeachingClasses } from "../../lib/classes";

import ProfessorSidebar from "../../components/ProfessorSidebar";
import NotificationBell from "../../components/NotificationBell";
import UserAvatar from "../../components/UserAvatar";
import AssignmentForm from "../../components/AssignmentForm";

import "./ProfessorDashboard.css";
import "./ProfessorAssignments.css";


// =========================================================
// PROFESSOR ASSIGNMENTS
// Every assignment, test and exam in the classes you teach
// (your own classes and the ones you co-teach).
// Create, edit (date, brief, file, weight) and delete.
// Marking happens on each class page.
// =========================================================

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function classLabel(group) {
  if (!group) return "Class";
  return group.course_code ? `${group.course_code} — ${group.name}` : group.name;
}


function ProfessorAssignments() {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // null = closed, { assignment: null } = create, { assignment } = edit
  const [form, setForm] = useState(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");


  const loadPage = useCallback(async () => {
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMessage("You must be logged in.");
      setLoading(false);
      return;
    }

    setCurrentUser(user);

    const { data: profileData } =
      await supabase
        .from("profiles")
        .select("id, full_name, campus_id, programme, role, avatar_path")
        .eq("id", user.id)
        .maybeSingle();

    if (profileData?.role !== "professor") {
      setErrorMessage("This page is only available to professor accounts.");
      setLoading(false);
      return;
    }

    setProfile(profileData);

    const loadedClasses =
      await loadTeachingClasses(user.id);

    setClasses(loadedClasses);

    if (loadedClasses.length) {
      const { data, error } =
        await supabase
          .from("class_assignments")
          .select("*")
          .in("group_id", loadedClasses.map((group) => group.id))
          .order("due_at", { ascending: true });

      if (error) setErrorMessage("Could not load assignments: " + error.message);
      setAssignments(data || []);
    } else {
      setAssignments([]);
    }

    setLoading(false);
  }, []);


  useEffect(() => {
    // Data loading on page open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPage();
  }, [loadPage]);


  async function deleteAssignment() {
    if (!assignmentToDelete) return;

    setDeleting(true);
    setMessage("");
    setErrorMessage("");

    const { error } =
      await supabase
        .from("class_assignments")
        .delete()
        .eq("id", assignmentToDelete.id);

    setDeleting(false);

    if (error) {
      setErrorMessage("Could not delete assignment: " + error.message);
      return;
    }

    if (assignmentToDelete.file_path) {
      await removeFile("course-files", assignmentToDelete.file_path);
    }

    setAssignments((current) => current.filter((row) => row.id !== assignmentToDelete.id));
    setMessage(`${assignmentToDelete.title} was deleted.`);
    setAssignmentToDelete(null);
  }


  function saved(row) {
    const editing = Boolean(form?.assignment);

    setAssignments((current) =>
      editing
        ? current.map((item) => (item.id === row.id ? row : item))
        : [...current, row].sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
    );

    setForm(null);
    setMessage(editing ? `${row.title} was updated. Students were told about the change.` : `${row.title} was posted. Students have been notified.`);
  }


  const getClass = (groupId) =>
    classes.find((group) => group.id === groupId);

  const isOverdue = (assignment) =>
    new Date(assignment.due_at) < new Date();

  const isDueSoon = (assignment) => {
    const days = (new Date(assignment.due_at) - new Date()) / 86400000;
    return days >= 0 && days <= 3;
  };


  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assignments.filter((assignment) => {
      const group = classes.find((item) => item.id === assignment.group_id);

      const matchesSearch =
        !query ||
        assignment.title?.toLowerCase().includes(query) ||
        assignment.description?.toLowerCase().includes(query) ||
        group?.name?.toLowerCase().includes(query) ||
        group?.course_code?.toLowerCase().includes(query);

      const matchesClass =
        classFilter === "all" || assignment.group_id === classFilter;

      return matchesSearch && matchesClass;
    });
  }, [assignments, classes, search, classFilter]);


  const overdueCount = assignments.filter(isOverdue).length;
  const upcomingCount = assignments.length - overdueCount;
  const classesWithAssignments = new Set(assignments.map((assignment) => assignment.group_id)).size;


  if (loading) {
    return (
      <div className="prof-assignment-loading">
        <FileText size={46} />
        <p>Loading assignments...</p>
      </div>
    );
  }


  return (
    <div className="professor-dashboard-page">
      <ProfessorSidebar />

      <main className="professor-main">
        <header className="professor-topbar">
          <div className="prof-assignment-top-search">
            <Search size={18} />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search assignments or classes..."
            />
          </div>

          <div className="professor-topbar-right">
            <NotificationBell />
            <UserAvatar profile={profile} size={46} />
            <div className="professor-profile-info">
              <strong>{profile?.full_name || "Professor"}</strong>
              <small>Professor</small>
            </div>
          </div>
        </header>

        <div className="prof-assignment-content">
          <div className="prof-assignment-header">
            <div>
              <h1>Assignments</h1>
              <p>Assignments, tests and exams in the classes you teach. Mark them on each class page.</p>
            </div>

            <button
              type="button"
              className="prof-assignment-create-button"
              onClick={() => setForm({ assignment: null })}
              disabled={classes.length === 0}
            >
              <Plus size={18} />
              Create Assignment
            </button>
          </div>

          {message && (
            <div className="prof-assignment-success">
              <CheckCircle2 size={17} />
              {message}
            </div>
          )}

          {errorMessage && (
            <div className="prof-assignment-error">
              <AlertTriangle size={17} />
              {errorMessage}
            </div>
          )}

          {classes.length === 0 && !errorMessage && (
            <div className="prof-assignment-warning">
              <BookOpen size={18} />
              Create a class first before posting assignments.
            </div>
          )}

          <section className="prof-assignment-stats">
            <div>
              <span className="blue"><FileText size={22} /></span>
              <div><strong>{assignments.length}</strong><small>Total</small></div>
            </div>
            <div>
              <span className="green"><CalendarDays size={22} /></span>
              <div><strong>{upcomingCount}</strong><small>Active</small></div>
            </div>
            <div>
              <span className="red"><Clock3 size={22} /></span>
              <div><strong>{overdueCount}</strong><small>Past Due</small></div>
            </div>
            <div>
              <span className="purple"><BookOpen size={22} /></span>
              <div><strong>{classesWithAssignments}</strong><small>Classes</small></div>
            </div>
          </section>

          <section className="prof-assignment-toolbar">
            <div>
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search assignments..."
              />
            </div>

            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
              <option value="all">All Classes</option>
              {classes.map((group) => (
                <option key={group.id} value={group.id}>{classLabel(group)}</option>
              ))}
            </select>
          </section>

          <section className="prof-assignment-list-card">
            <div className="prof-assignment-list-header">
              <div>
                <h2>Class Assignments</h2>
                <p>Soonest due first.</p>
              </div>
              <span>{filteredAssignments.length}</span>
            </div>

            {filteredAssignments.length === 0 ? (
              <div className="prof-assignment-empty">
                <FileText size={48} />
                <h3>No assignments yet</h3>
                <p>Create an assignment and choose which class should receive it.</p>
                {classes.length > 0 && (
                  <button type="button" onClick={() => setForm({ assignment: null })}>
                    <Plus size={16} />
                    Create Assignment
                  </button>
                )}
              </div>
            ) : (
              <div className="prof-assignment-grid">
                {filteredAssignments.map((assignment) => {
                  const group = getClass(assignment.group_id);
                  const overdue = isOverdue(assignment);
                  const dueSoon = isDueSoon(assignment);

                  return (
                    <article className="prof-assignment-card" key={assignment.id}>
                      <div className="prof-assignment-card-top">
                        <div className="prof-assignment-icon">
                          <FileText size={22} />
                        </div>

                        <span className={`prof-assignment-status ${overdue ? "overdue" : dueSoon ? "soon" : "active"}`}>
                          {assignment.hand_in === false ? "Mark only" : overdue ? "Past Due" : dueSoon ? "Due Soon" : "Active"}
                        </span>
                      </div>

                      <h3>{assignment.title}</h3>

                      <div className="prof-assignment-class">
                        <BookOpen size={15} />
                        <span>{classLabel(group)}</span>
                      </div>

                      {assignment.description && (
                        <p className="prof-assignment-description">{assignment.description}</p>
                      )}

                      <div className="prof-assignment-details">
                        <div>
                          <CalendarDays size={15} />
                          <span>
                            {assignment.hand_in === false ? "On " : "Due "}
                            <strong>{formatDate(assignment.due_at)}</strong>
                            {" · "}
                            {formatTime(assignment.due_at)}
                          </span>
                        </div>
                        <div>
                          <CheckCircle2 size={15} />
                          <span>
                            <strong>{assignment.points}</strong> marks
                            {assignment.weight ? <> · <strong>{Number(assignment.weight)}%</strong> of final</> : null}
                          </span>
                        </div>
                        {assignment.file_name && (
                          <div>
                            <Paperclip size={15} />
                            <span>{assignment.file_name}</span>
                          </div>
                        )}
                      </div>

                      <div className="prof-assignment-actions">
                        <Link to={`/professor/classes/${assignment.group_id}`}>
                          <ExternalLink size={14} />
                          Mark
                        </Link>
                        <button type="button" onClick={() => setForm({ assignment })}>
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button type="button" className="danger" onClick={() => setAssignmentToDelete(assignment)}>
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>


      {form && (
        <div className="prof-assignment-modal-overlay">
          <div className="prof-assignment-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-form-title">
            <div className="prof-assignment-modal-header">
              <div>
                <h2 id="assignment-form-title">{form.assignment ? "Edit Assignment" : "Create Assignment"}</h2>
                <p>
                  {form.assignment
                    ? classLabel(getClass(form.assignment.group_id))
                    : "Post a new assignment, test or exam to one of your classes."}
                </p>
              </div>

              <button type="button" onClick={() => setForm(null)} aria-label="Close">
                <X size={19} />
              </button>
            </div>

            <div className="prof-assignment-modal-body">
              <AssignmentForm
                key={form.assignment?.id || "new"}
                assignment={form.assignment}
                groups={classes}
                userId={currentUser?.id}
                onCancel={() => setForm(null)}
                onSaved={saved}
              />
            </div>
          </div>
        </div>
      )}


      {assignmentToDelete && (
        <div className="prof-assignment-modal-overlay">
          <div className="prof-assignment-delete-modal" role="dialog" aria-modal="true">
            <div className="prof-assignment-delete-icon">
              <Trash2 size={27} />
            </div>

            <h2>Delete Assignment?</h2>

            <p>
              You are about to delete <strong>{assignmentToDelete.title}</strong>.
            </p>

            <div className="prof-assignment-delete-warning">
              <AlertTriangle size={17} />
              Students' hand-ins and marks for it are deleted too.
            </div>

            <div className="prof-assignment-delete-actions">
              <button type="button" className="cancel" disabled={deleting} onClick={() => setAssignmentToDelete(null)}>
                Cancel
              </button>
              <button type="button" className="delete" disabled={deleting} onClick={deleteAssignment}>
                <Trash2 size={15} />
                {deleting ? "Deleting..." : "Delete Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfessorAssignments;
