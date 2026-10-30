import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import { supabase } from "../lib/supabase";

import Sidebar from "../components/Sidebar";
import NotificationBell from "../components/NotificationBell";
import UserAvatar
  from "../components/UserAvatar";
import ClassAssignments
  from "../components/ClassAssignments";
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Info,
} from "lucide-react";

import "./Dashboard.css";
import "./Assignments.css";


// What each risk level is called on screen
const RISK_LABELS = {
  High: "Needs attention",
  Medium: "Due soon",
  Low: "On track",
  Overdue: "Overdue",
};

function riskLabel(risk) {
  return RISK_LABELS[risk] || risk;
}


function Assignments() {
  const navigate = useNavigate();


  // ==========================================
  // DATA
  // ==========================================

  // Shows the "Need attention" explanation under the stats
  const [
    showRiskInfo,
    setShowRiskInfo,
  ] = useState(false);

  const [
    profile,
    setProfile,
  ] = useState(null);

  const [
    assignments,
    setAssignments,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    message,
    setMessage,
  ] = useState("");


  // ==========================================
  // FORM
  // ==========================================

  const [
    title,
    setTitle,
  ] = useState("");

  const [
    subject,
    setSubject,
  ] = useState("");

  const [
    difficulty,
    setDifficulty,
  ] = useState("medium");

  const [
    estimatedHours,
    setEstimatedHours,
  ] = useState("");

  const [
    dueDate,
    setDueDate,
  ] = useState("");


  // ==========================================
  // EDIT
  // ==========================================

  // The "add your own assignment" form is hidden until needed.
  const [
    showForm,
    setShowForm,
  ] = useState(false);


  const [
    editingId,
    setEditingId,
  ] = useState(null);


  useEffect(() => {
    loadAssignments();
  }, []);


  // ==========================================
  // LOAD PAGE
  // ==========================================

  async function loadAssignments() {
    setLoading(true);


    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();


    if (
      userError ||
      !user
    ) {
      navigate("/");
      return;
    }


    // PROFILE

    const {
      data: profileData,
    } = await supabase
      .from("profiles")
      .select("*")
      .eq(
        "id",
        user.id
      )
      .maybeSingle();


    setProfile(
      profileData || null
    );


    // ASSIGNMENTS

    const {
      data,
      error,
    } = await supabase
      .from("assignments")
      .select("*")
      .eq(
        "user_id",
        user.id
      )
      .order(
        "due_date",
        {
          ascending: true,
        }
      );


    if (error) {
      console.error(
        "Assignment load error:",
        error
      );

      setMessage(
        "Could not load assignments: " +
          error.message
      );

      setLoading(false);

      return;
    }


    setAssignments(
      data || []
    );

    setLoading(false);
  }


  // ==========================================
  // DATE HELPERS
  // ==========================================

  function dateKey(value) {
    if (!value) {
      return "";
    }

    return String(value)
      .slice(0, 10);
  }


  function parseDate(
    value,
    endOfDay = false
  ) {
    const key =
      dateKey(value);


    if (!key) {
      return null;
    }


    const [
      year,
      month,
      day,
    ] = key
      .split("-")
      .map(Number);


    if (
      !year ||
      !month ||
      !day
    ) {
      return null;
    }


    if (endOfDay) {
      return new Date(
        year,
        month - 1,
        day,
        23,
        59,
        59
      );
    }


    return new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0
    );
  }


  function formatDate(value) {
    const date =
      parseDate(value);


    if (!date) {
      return "-";
    }


    return date.toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }


  // ==========================================
  // RISK CALCULATION
  // ==========================================

  function calculateRisk(
    assignment
  ) {
    if (
      assignment.status ===
      "completed"
    ) {
      return "Low";
    }


    const deadline =
      parseDate(
        assignment.due_date,
        true
      );


    if (!deadline) {
      return "Low";
    }


    const now =
      new Date();


    const daysLeft =
      (
        deadline.getTime() -
        now.getTime()
      ) /
      (
        1000 *
        60 *
        60 *
        24
      );


    if (daysLeft < 0) {
      return "Overdue";
    }


    let score = 0;


    // DEADLINE

    if (daysLeft <= 1) {
      score += 45;
    } else if (
      daysLeft <= 3
    ) {
      score += 30;
    } else if (
      daysLeft <= 7
    ) {
      score += 15;
    } else {
      score += 5;
    }


    // DIFFICULTY

    if (
      assignment.difficulty ===
      "hard"
    ) {
      score += 20;
    } else if (
      assignment.difficulty ===
      "medium"
    ) {
      score += 10;
    } else {
      score += 5;
    }


    // PROGRESS

    const progress =
      Number(
        assignment.progress
      ) || 0;


    if (progress < 25) {
      score += 20;
    } else if (
      progress < 50
    ) {
      score += 12;
    } else if (
      progress < 75
    ) {
      score += 5;
    }


    // ESTIMATED WORK

    const hours =
      Number(
        assignment.estimated_hours
      ) || 0;


    const remainingHours =
      hours *
      (
        1 -
        progress / 100
      );


    if (
      daysLeft <= 3 &&
      remainingHours >= 8
    ) {
      score += 15;
    } else if (
      daysLeft <= 7 &&
      remainingHours >= 12
    ) {
      score += 10;
    }


    if (score >= 70) {
      return "High";
    }


    if (score >= 40) {
      return "Medium";
    }


    return "Low";
  }


  // ==========================================
  // CLEAR FORM
  // ==========================================

  function clearForm() {
    setTitle("");
    setSubject("");
    setDifficulty(
      "medium"
    );
    setEstimatedHours("");
    setDueDate("");
    setEditingId(null);
    setShowForm(false);
  }


  // ==========================================
  // ADD / UPDATE
  // ==========================================

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    setMessage("");


    if (
      !title.trim() ||
      !dueDate
    ) {
      setMessage(
        "Please enter an assignment title and due date."
      );

      return;
    }


    const {
      data: { user },
    } =
      await supabase.auth.getUser();


    if (!user) {
      navigate("/");
      return;
    }


    const assignmentData = {
      user_id:
        user.id,

      title:
        title.trim(),

      subject:
        subject.trim(),

      difficulty,

      estimated_hours:
        Number(
          estimatedHours
        ) || 0,

      due_date:
        dueDate,
    };


    // EDIT

    if (editingId) {

      const {
        error,
      } = await supabase
        .from("assignments")
        .update(
          assignmentData
        )
        .eq(
          "id",
          editingId
        )
        .eq(
          "user_id",
          user.id
        );


      if (error) {
        setMessage(
          "Could not update assignment: " +
            error.message
        );

        return;
      }


      setMessage(
        "Assignment updated successfully."
      );

    } else {

      // ADD

      const {
        error,
      } = await supabase
        .from("assignments")
        .insert({
          ...assignmentData,

          progress: 0,

          status:
            "pending",
        });


      if (error) {
        setMessage(
          "Could not add assignment: " +
            error.message
        );

        return;
      }


      setMessage(
        "Assignment added successfully."
      );
    }


    clearForm();

    await loadAssignments();
  }


  // ==========================================
  // START EDITING
  // ==========================================

  function startEditing(
    assignment
  ) {
    setShowForm(true);

    setEditingId(
      assignment.id
    );

    setTitle(
      assignment.title ||
        ""
    );

    setSubject(
      assignment.subject ||
        ""
    );

    setDifficulty(
      assignment.difficulty ||
        "medium"
    );

    setEstimatedHours(
      assignment.estimated_hours ??
        ""
    );

    setDueDate(
      dateKey(
        assignment.due_date
      )
    );


    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }


  // ==========================================
  // DELETE
  // ==========================================

  async function deleteAssignment(
    id
  ) {
    const confirmed =
      window.confirm(
        "Delete this assignment?"
      );


    if (!confirmed) {
      return;
    }


    const {
      error,
    } = await supabase
      .from("assignments")
      .delete()
      .eq(
        "id",
        id
      );


    if (error) {
      setMessage(
        "Could not delete assignment: " +
          error.message
      );

      return;
    }


    setMessage(
      "Assignment deleted."
    );


    await loadAssignments();
  }


  // ==========================================
  // PROGRESS
  // ==========================================

  async function updateProgress(
    assignment,
    progress
  ) {
    const value =
      Number(progress);


    const status =
      value >= 100
        ? "completed"
        : value > 0
        ? "in_progress"
        : "pending";


    const {
      error,
    } = await supabase
      .from("assignments")
      .update({
        progress:
          value,

        status,
      })
      .eq(
        "id",
        assignment.id
      );


    if (error) {
      setMessage(
        "Could not update progress: " +
          error.message
      );

      return;
    }


    setAssignments(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            assignment.id
              ? {
                  ...item,
                  progress:
                    value,
                  status,
                }
              : item
        )
    );
  }


  // ==========================================
  // COMPLETE
  // ==========================================

  async function completeAssignment(
    assignment
  ) {
    await updateProgress(
      assignment,
      100
    );

    setMessage(
      "Assignment completed."
    );
  }


  // ==========================================
  // COUNTS
  // ==========================================

  const totalAssignments =
    assignments.length;


  const completedAssignments =
    assignments.filter(
      (assignment) =>
        assignment.status ===
        "completed"
    ).length;


  const pendingAssignments =
    assignments.filter(
      (assignment) =>
        assignment.status !==
        "completed"
    ).length;


  const highRiskAssignments =
    assignments.filter(
      (assignment) => {

        if (
          assignment.status ===
          "completed"
        ) {
          return false;
        }


        const risk =
          calculateRisk(
            assignment
          );


        return (
          risk === "High" ||
          risk === "Overdue"
        );
      }
    ).length;


  // ==========================================
  // PROFILE
  // ==========================================

  const displayName =
    profile?.full_name ||
    "Student";


  const programme =
    profile?.programme ||
    "Student";


  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="dashboard-page">

      {/* SHARED SIDEBAR */}

      <Sidebar />


      <main className="dashboard-main">

        {/* ===================================
            TOP BAR
        ==================================== */}

        <header className="topbar">

          <div aria-hidden="true" />


          <div className="topbar-right">

            {/* =================================
                SHARED CLICKABLE BELL
            ================================== */}

            <NotificationBell />


          <UserAvatar
           size={46}
          />


            <div className="profile-text">

              <strong>
                {displayName}
              </strong>

              <small>
                {programme}
              </small>

            </div>

          </div>

        </header>


        {/* ===================================
            PAGE CONTENT
        ==================================== */}

        <div className="assignments-content">

          {/* PAGE HEADER */}

          <div className="assignments-page-header">

            <div>

              <h1>
                Assignments
              </h1>

              <p>
                Class work from your professors, plus your own tasks, deadlines, progress
                and what needs attention.
              </p>

            </div>

          </div>


          {/* =================================
              STATS
          ================================== */}

          <section className="assignments-stats">

            {/* TOTAL */}

            <div className="assignment-stat blue">

              <div className="assignment-stat-icon">

                <FileText />

              </div>


              <div>

                <h2>
                  {totalAssignments}
                </h2>

                <p>
                  Total Assignments
                </p>

              </div>

            </div>


            {/* HIGH RISK */}

            <div className="assignment-stat red">

              <div className="assignment-stat-icon">

                <AlertTriangle />

              </div>


              <div>

                <h2>
                  {
                    highRiskAssignments
                  }
                </h2>

                <p className="assignment-stat-label">
                  Need attention
                  <button
                    type="button"
                    className="assignment-info-btn"
                    onClick={() =>
                      setShowRiskInfo(
                        (current) => !current
                      )
                    }
                    aria-expanded={showRiskInfo}
                    aria-controls="risk-explanation"
                    aria-label="What does Need attention mean?"
                  >
                    <Info size={14} />
                  </button>
                </p>

              </div>

            </div>


            {/* COMPLETED */}

            <div className="assignment-stat green">

              <div className="assignment-stat-icon">

                <CheckCircle2 />

              </div>


              <div>

                <h2>
                  {
                    completedAssignments
                  }
                </h2>

                <p>
                  Completed
                </p>

              </div>

            </div>


            {/* PENDING */}

            <div className="assignment-stat purple">

              <div className="assignment-stat-icon">

                <Hourglass />

              </div>


              <div>

                <h2>
                  {
                    pendingAssignments
                  }
                </h2>

                <p>
                  Pending
                </p>

              </div>

            </div>

          </section>


          {showRiskInfo && (
            <div
              id="risk-explanation"
              className="assignment-risk-info"
            >
              <strong>
                How "Need attention" works
              </strong>
              <p>
                An assignment needs attention when the due date is
                close but your progress is still low. Harder
                assignments and more estimated hours count for more.
                Update your progress or finish it and it drops off
                this list.
              </p>
            </div>
          )}


          {/* =================================
              FROM YOUR PROFESSORS
          ================================== */}

          <ClassAssignments />


          {/* =================================
              FORM
          ================================== */}

          {(showForm || editingId) && (
          <section className="assignment-form-card">

            <div className="assignment-card-header">

              <h2>

                {editingId ? (
                  <Pencil
                    size={20}
                  />
                ) : (
                  <Plus
                    size={20}
                  />
                )}

                {editingId
                  ? "Edit Assignment"
                  : "Add an assignment"}

              </h2>

            </div>


            <form
              className="assignment-form"
              onSubmit={
                handleSubmit
              }
            >

              {/* TITLE */}

              <div className="assignment-field">

                <label>
                  Assignment Title
                </label>

                <input
                  type="text"
                  value={
                    title
                  }
                  onChange={(event) =>
                    setTitle(
                      event.target.value
                    )
                  }
                  placeholder="Example: Database Project"
                  required
                />

              </div>


              {/* SUBJECT */}

              <div className="assignment-field">

                <label>
                  Subject
                </label>

                <input
                  type="text"
                  value={
                    subject
                  }
                  onChange={(event) =>
                    setSubject(
                      event.target.value
                    )
                  }
                  placeholder="Example: Database Systems"
                />

              </div>


              {/* DIFFICULTY */}

              <div className="assignment-field">

                <label>
                  Difficulty
                </label>

                <select
                  value={
                    difficulty
                  }
                  onChange={(event) =>
                    setDifficulty(
                      event.target.value
                    )
                  }
                >

                  <option value="easy">
                    Easy
                  </option>

                  <option value="medium">
                    Medium
                  </option>

                  <option value="hard">
                    Hard
                  </option>

                </select>

              </div>


              {/* HOURS */}

              <div className="assignment-field">

                <label>
                  Estimated Hours
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={
                    estimatedHours
                  }
                  onChange={(event) =>
                    setEstimatedHours(
                      event.target.value
                    )
                  }
                  placeholder="Example: 8"
                />

              </div>


              {/* DUE DATE */}

              <div className="assignment-field assignment-full">

                <label>
                  Due Date
                </label>

                <input
                  type="date"
                  value={
                    dueDate
                  }
                  onChange={(event) =>
                    setDueDate(
                      event.target.value
                    )
                  }
                  required
                />

              </div>


              {/* BUTTONS */}

              <div className="assignment-form-actions assignment-full">

                <button
                  type="submit"
                  className="assignment-primary-btn"
                >

                  {editingId ? (
                    <>
                      <Save
                        size={18}
                      />

                      Save Changes
                    </>
                  ) : (
                    <>
                      <Plus
                        size={18}
                      />

                      Add Assignment
                    </>
                  )}

                </button>


                {(
                  <button
                    type="button"
                    className="assignment-cancel-btn"
                    onClick={
                      clearForm
                    }
                  >

                    <X
                      size={18}
                    />

                    Cancel

                  </button>

                )}

              </div>

            </form>


          </section>
          )}


          {message && (
            <div className="assignment-message">
              {message}
            </div>
          )}


          {/* =================================
              ASSIGNMENTS LIST
          ================================== */}

          <section className="assignments-list-card">

            <div className="assignment-card-header">

              <h2>

                <FileText
                  size={20}
                />

                My own tasks

              </h2>


              {!showForm && !editingId && (
                <button
                  type="button"
                  className="assignment-add-toggle"
                  onClick={() => setShowForm(true)}
                >
                  <Plus size={16} />
                  Add assignment
                </button>
              )}

              <span className="assignment-count">

                {assignments.length}{" "}

                {assignments.length === 1
                  ? "assignment"
                  : "assignments"}

              </span>

            </div>


            {loading ? (

              <div className="assignments-empty">

                Loading assignments...

              </div>

            ) : assignments.length ===
              0 ? (

              <div className="assignments-empty">

                <FileText
                  size={43}
                />

                <h3>
                  No assignments yet
                </h3>

                <p>
                  Add your first assignment
                  using the form above.
                </p>

              </div>

            ) : (

              <div className="assignment-list">

                {assignments.map(
                  (
                    assignment
                  ) => {

                    const risk =
                      calculateRisk(
                        assignment
                      );


                    const progress =
                      Number(
                        assignment.progress
                      ) || 0;


                    return (

                      <article
                        className="assignment-item"
                        key={
                          assignment.id
                        }
                      >

                        {/* MAIN */}

                        <div className="assignment-item-main">

                          <div className="assignment-item-top">

                            <div>

                              <h3>
                                {
                                  assignment.title
                                }
                              </h3>

                              <p>
                                {
                                  assignment.subject ||
                                  "No subject"
                                }
                              </p>

                            </div>


                            <span
                              className={`assignment-risk ${risk.toLowerCase()}`}
                            >
                              {riskLabel(risk)}
                            </span>

                          </div>


                          {/* INFORMATION */}

                          <div className="assignment-info-grid">

                            <div>

                              <small>
                                Due Date
                              </small>

                              <strong>

                                {formatDate(
                                  assignment.due_date
                                )}

                              </strong>

                            </div>


                            <div>

                              <small>
                                Difficulty
                              </small>

                              <strong className={`difficulty ${assignment.difficulty || "easy"}`}>

                                {
                                  assignment.difficulty ||
                                  "easy"
                                }

                              </strong>

                            </div>


                            <div>

                              <small>
                                Estimated Hours
                              </small>

                              <strong>

                                {
                                  Number(
                                    assignment.estimated_hours
                                  ) || 0
                                }{" "}
                                hrs

                              </strong>

                            </div>

                          </div>


                          {/* PROGRESS */}

                          <div className="assignment-progress-section">

                            <div className="assignment-progress-header">

                              <span>
                                Progress
                              </span>

                              <strong>
                                {progress}%
                              </strong>

                            </div>


                            <div className="assignment-progress">

                              <div
                                style={{
                                  width:
                                    `${progress}%`,
                                }}
                              />

                            </div>

                          </div>


                          {/* BOTTOM */}

                          <div className="assignment-bottom">

                            <select
                              value={
                                progress
                              }
                              onChange={(event) =>
                                updateProgress(
                                  assignment,
                                  event.target.value
                                )
                              }
                            >

                              <option value="0">
                                0%
                              </option>

                              <option value="10">
                                10%
                              </option>

                              <option value="25">
                                25%
                              </option>

                              <option value="50">
                                50%
                              </option>

                              <option value="75">
                                75%
                              </option>

                              <option value="90">
                                90%
                              </option>

                              <option value="100">
                                100%
                              </option>

                            </select>


                            <div className="assignment-actions">

                              {assignment.status !==
                                "completed" && (

                                <button
                                  type="button"
                                  className="assignment-complete-btn"
                                  title="Mark complete"
                                  onClick={() =>
                                    completeAssignment(
                                      assignment
                                    )
                                  }
                                >

                                  <CheckCircle2
                                    size={16}
                                  />

                                </button>

                              )}


                              <button
                                type="button"
                                className="assignment-edit-btn"
                                title="Edit assignment"
                                onClick={() =>
                                  startEditing(
                                    assignment
                                  )
                                }
                              >

                                <Pencil
                                  size={16}
                                />

                              </button>


                              <button
                                type="button"
                                className="assignment-delete-btn"
                                title="Delete assignment"
                                onClick={() =>
                                  deleteAssignment(
                                    assignment.id
                                  )
                                }
                              >

                                <Trash2
                                  size={16}
                                />

                              </button>

                            </div>

                          </div>

                        </div>

                      </article>

                    );
                  }
                )}

              </div>

            )}

          </section>

        </div>

      </main>

    </div>
  );
}


export default Assignments;