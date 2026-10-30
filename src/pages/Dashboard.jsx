import {

  useEffect,


  useState,

} from "react";

import {

  Link,

  useNavigate,

} from "react-router-dom";

import {

  supabase,

} from "../lib/supabase";

import Sidebar

  from "../components/Sidebar";

import NotificationBell

  from "../components/NotificationBell";

import UserAvatar

  from "../components/UserAvatar";

import {
  AlertTriangle,
  FileText,
  Users,
  ListTodo,
} from "lucide-react";

import TodoList from "../components/TodoList";

import "./Dashboard.css";

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


function Dashboard() {

  // Number of items in the "To do" list (set by TodoList)
  const [
    todoCount,
    setTodoCount,
  ] = useState(null);

  const navigate =

    useNavigate();

  // =========================================================

  // DATA

  // =========================================================

  const [

    profile,

    setProfile,

  ] = useState(null);

  const [

    assignments,

    setAssignments,

  ] = useState([]);

  const [

    projects,

    setProjects,

  ] = useState([]);

  // =========================================================

  // PAGE STATE

  // =========================================================

  const [

    loading,

    setLoading,

  ] = useState(true);

  const [

    accessChecked,

    setAccessChecked,

  ] = useState(false);

  const [

    errorMessage,

    setErrorMessage,

  ] = useState("");

  // =========================================================

  // LOAD

  // =========================================================

  useEffect(() => {

    loadDashboard();

  }, []);

  async function loadDashboard() {

    setLoading(true);

    setAccessChecked(false);

    setErrorMessage("");

    // =======================================================

    // USER

    // =======================================================

    const {

      data: {

        user,

      },

      error: userError,

    } =

      await supabase.auth.getUser();

    if (

      userError ||

      !user

    ) {

      navigate(

        "/",

        {

          replace: true,

        }

      );

      return;

    }

    // =======================================================

    // PROFILE + ROLE CHECK

    // =======================================================

    const {

      data: profileData,

      error: profileError,

    } =

      await supabase

        .from("profiles")

        .select("*")

        .eq(

          "id",

          user.id

        )

        .maybeSingle();

    if (profileError) {

      console.error(

        "Profile error:",

        profileError

      );

      setErrorMessage(

        "Could not load your account."

      );

      setLoading(false);

      setAccessChecked(true);

      return;

    }

    // =======================================================

    // PROFESSOR MUST NOT USE STUDENT DASHBOARD

    // =======================================================

    // School admins have their own page.

    if (profileData?.role === "school_admin") {

      navigate("/school-admin", { replace: true });

      return;

    }


    if (

      profileData?.role ===

      "professor"

    ) {

      navigate(

        "/professor/dashboard",

        {

          replace: true,

        }

      );

      return;

    }

    // Only student continues below.

    setProfile(

      profileData ||

        null

    );

    setAccessChecked(true);

    // =======================================================

    // ASSIGNMENTS

    // =======================================================

    const {

      data: assignmentData,

      error: assignmentError,

    } =

      await supabase

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

    if (assignmentError) {

      console.error(

        "Assignment error:",

        assignmentError

      );

    }

    setAssignments(

      assignmentData ||

        []

    );

    // =======================================================

    // GROUP PROJECTS

    // =======================================================

    const {

      data: projectData,

      error: projectError,

    } =

      await supabase

        .from("group_projects")

        .select("*")

        .eq(

          "user_id",

          user.id

        )

        .order(

          "created_at",

          {

            ascending: false,

          }

        );

    if (projectError) {

      console.error(

        "Project error:",

        projectError

      );

    }

    setProjects(

      projectData ||

        []

    );

    setLoading(false);

  }

  // =========================================================

  // ASSIGNMENT RISK

  // =========================================================

  function calculateRisk(

    assignment

  ) {

    if (

      assignment.status ===

      "completed"

    ) {

      return "Low";

    }

    if (

      !assignment.due_date

    ) {

      return "Low";

    }

    const now =

      new Date();

    const deadline =

      new Date(

        `${assignment.due_date}T23:59:59`

      );

    const difference =

      deadline.getTime() -

      now.getTime();

    const daysLeft =

      difference /

      (

        1000 *

        60 *

        60 *

        24

      );

    if (

      daysLeft < 0

    ) {

      return "Overdue";

    }

    let score =

      0;

    // Deadline pressure

    if (

      daysLeft <= 1

    ) {

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

    // Difficulty

    const difficulty =

      String(

        assignment.difficulty ||

          ""

      ).toLowerCase();

    if (

      difficulty ===

      "hard"

    ) {

      score += 20;

    } else if (

      difficulty ===

      "medium"

    ) {

      score += 10;

    } else {

      score += 5;

    }

    // Progress

    const progress =

      Number(

        assignment.progress

      ) || 0;

    if (

      progress < 25

    ) {

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

    // Remaining work

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

    if (

      score >= 70

    ) {

      return "High";

    }

    if (

      score >= 40

    ) {

      return "Medium";

    }

    return "Low";

  }

  // =========================================================

  // ASSIGNMENT DATA

  // =========================================================

  const activeAssignments =

    assignments.filter(

      (assignment) =>

        assignment.status !==

        "completed"

    );

  const highRiskAssignments =

    activeAssignments.filter(

      (assignment) => {

        const risk =

          calculateRisk(

            assignment

          );

        return (

          risk ===

            "High"

          ||

          risk ===

            "Overdue"

        );

      }

    );

  const dashboardAssignments =

    activeAssignments.slice(

      0,

      5

    );


  // =========================================================

  // PROFILE

  // =========================================================

  const displayName =

    profile?.full_name ||

    "Student";

  const firstName =

    displayName

      .trim()

      .split(" ")[0] ||

    "Student";

  const programme =

    profile?.programme ||

    "Student";

  // =========================================================

  // ROUTES

  //

  // Extra protection.

  // Normally professors are redirected before this renders.

  // =========================================================

  const assignmentRoute =

    profile?.role ===

    "professor"

      ? "/professor/assignments"

      : "/assignments";


  // =========================================================

  // HELPERS

  // =========================================================

  function formatDate(

    dateValue

  ) {

    if (

      !dateValue

    ) {

      return "-";

    }

    return new Date(

      `${dateValue}T12:00:00`

    ).toLocaleDateString(

      "en-GB",

      {

        day:

          "2-digit",

        month:

          "short",

      }

    );

  }

  function riskClass(

    risk

  ) {

    if (

      risk ===

      "Overdue"

    ) {

      return "high";

    }

    return risk

      .toLowerCase();

  }

  function projectStatusText(

    status

  ) {

    if (

      status ===

      "completed"

    ) {

      return "Completed";

    }

    if (

      status ===

      "at_risk"

    ) {

      return "At Risk";

    }

    return "On Track";

  }

  // =========================================================

  // ACCESS CHECK LOADING

  //

  // Prevents professor from briefly seeing student dashboard.

  // =========================================================

  if (

    !accessChecked

  ) {

    return (

      <div

        style={{

          minHeight:

            "100vh",

          display:

            "flex",

          alignItems:

            "center",

          justifyContent:

            "center",

          background:

            "#f5f8fc",

          color:

            "#2563eb",

          fontWeight:

            700,

        }}

      >

        Checking account...

      </div>

    );

  }

  // =========================================================

  // ERROR

  // =========================================================

  if (

    errorMessage &&

    !profile

  ) {

    return (

      <div

        style={{

          minHeight:

            "100vh",

          display:

            "flex",

          alignItems:

            "center",

          justifyContent:

            "center",

          background:

            "#f5f8fc",

          color:

            "#dc2626",

          padding:

            "30px",

        }}

      >

        {errorMessage}

      </div>

    );

  }

  // =========================================================

  // PAGE

  // =========================================================

  return (

    <div className="dashboard-page">

      <Sidebar />

      <main className="dashboard-main">

        {/* ===================================================

            TOP BAR

        ==================================================== */}

        <header className="topbar">

          <div aria-hidden="true" />

          <div className="topbar-right">

            <NotificationBell />

            <UserAvatar
              profile={profile}
              name={displayName}
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

        {/* ===================================================

            CONTENT

        ==================================================== */}

        <div className="dashboard-content">

          {/* =================================================

              WELCOME

          ================================================== */}

          <section className="welcome-section">

            <div>

              <h1>

                Welcome back,{" "}

                {firstName}

              </h1>

              <p>

                Here's your academic overview today.

              </p>

            </div>

          </section>

          {/* =================================================

              STAT CARDS

          ================================================== */}

          <section className="stats-grid">

            {/* ASSIGNMENTS */}

            <div className="stat-card stat-blue">

              <div className="stat-icon">

                <FileText />

              </div>

              <div>

                <h2>

                  {activeAssignments.length}

                </h2>

                <p>

                  Active Assignments

                </p>

                <small>

                  Current tasks

                </small>

              </div>

            </div>

            {/* HIGH RISK */}

            <div className="stat-card stat-red">

              <div className="stat-icon">

                <AlertTriangle />

              </div>

              <div>

                <h2>

                  {highRiskAssignments.length}

                </h2>

                <p>

                  Need attention

                </p>

                <small>

                  Based on your deadlines

                </small>

              </div>

            </div>

            

            {/* TO DO */}

            <a
              className="stat-card stat-purple"
              href="#todo"
              style={{
                color: "inherit",
                textDecoration: "none",
              }}
            >

              <div className="stat-icon">

                <ListTodo />

              </div>

              <div>

                <h2>
                  {todoCount ?? "–"}
                </h2>

                <p>
                  To do
                </p>

                <small>
                  Work still to hand in
                </small>

              </div>

            </a>

          </section>

          {/* =================================================

              MAIN GRID

          ================================================== */}

          <div className="main-grid">

            {/* ===============================================

                ASSIGNMENT RISK

            ================================================ */}

            <section className="dashboard-card assignments-panel">

              <div className="card-title">

                <h3>

                  <FileText

                    size={19}

                  />

                  Deadlines & progress

                </h3>

                <Link

                  to={

                    assignmentRoute

                  }

                >

                  View All

                </Link>

              </div>

              {loading ? (

                <div className="empty-dashboard">

                  Loading...

                </div>

              ) : dashboardAssignments.length ===

                0 ? (

                <div className="empty-dashboard">

                  <FileText

                    size={34}

                  />

                  <h3>

                    No assignments yet

                  </h3>

                  <p>

                    Add your first assignment.

                  </p>

                  <Link

                    to={

                      assignmentRoute

                    }

                    className="small-link-button"

                  >

                    Add Assignment

                  </Link>

                </div>

              ) : (

                <div className="table-scroll">

                  <table className="dashboard-table">

                    <thead>

                      <tr>

                        <th>

                          Assignment

                        </th>

                        <th>

                          Due Date

                        </th>

                        <th>

                          Difficulty

                        </th>

                        <th>

                          Progress

                        </th>

                        <th>

                          Status

                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {dashboardAssignments.map(

                        (

                          assignment

                        ) => {

                          const risk =

                            calculateRisk(

                              assignment

                            );

                          return (

                            <tr

                              key={

                                assignment.id

                              }

                            >

                              <td>

                                {assignment.title}

                              </td>

                              <td>

                                {formatDate(

                                  assignment.due_date

                                )}

                              </td>

                              <td>

                                <span

                                  className={`difficulty ${

                                    String(

                                      assignment.difficulty ||

                                        "medium"

                                    ).toLowerCase()

                                  }`}

                                >

                                  {assignment.difficulty}

                                </span>

                              </td>

                              <td>

                                <strong className="progress-number">

                                  {assignment.progress ||

                                    0}%

                                </strong>

                                <div className="progress-background">

                                  <div

                                    className="progress-fill"

                                    style={{

                                      width:

                                        `${assignment.progress || 0}%`,

                                    }}

                                  />

                                </div>

                              </td>

                              <td>

                                <span

                                  className={`risk ${riskClass(

                                    risk

                                  )}`}

                                >

                                  {riskLabel(risk)}

                                </span>

                              </td>

                            </tr>

                          );

                        }

                      )}

                    </tbody>

                  </table>

                </div>

              )}

            </section>

            {/* ===============================================

                PROJECTS

            ================================================ */}

            <section className="dashboard-card projects-panel">

              <div className="card-title">

                <h3>

                  <Users

                    size={19}

                  />

                  Group Project Contribution

                </h3>

                <Link

                  to="/projects"

                >

                  View All

                </Link>

              </div>

              {projects.length ===

              0 ? (

                <div className="empty-dashboard">

                  <Users

                    size={35}

                  />

                  <h2>

                    0

                  </h2>

                  <p>

                    No group projects yet.

                  </p>

                </div>

              ) : (

                <div className="dashboard-project-list">

                  {projects

                    .slice(

                      0,

                      4

                    )

                    .map(

                      (

                        project

                      ) => (

                        <div

                          className="dashboard-project-row"

                          key={

                            project.id

                          }

                        >

                          <div className="dashboard-project-info">

                            <strong>

                              {project.name}

                            </strong>

                            <small>

                              {project.members_count ||

                                0}{" "}

                              members

                            </small>

                          </div>

                          <div className="dashboard-project-progress">

                            <div className="progress-background">

                              <div

                                className="project-progress-fill"

                                style={{

                                  width:

                                    `${project.progress || 0}%`,

                                }}

                              />

                            </div>

                            <small>

                              {project.progress ||

                                0}%

                            </small>

                          </div>

                          <span

                            className={`dashboard-project-status ${

                              project.status ===

                              "at_risk"

                                ? "project-risk"

                                : project.status ===

                                  "completed"

                                  ? "project-completed"

                                  : "project-track"

                            }`}

                          >

                            {projectStatusText(

                              project.status

                            )}

                          </span>

                        </div>

                      )

                    )}

                </div>

              )}

            </section>

            {/* ===============================================

                UPCOMING DEADLINES

            ================================================ */}

            <aside
              className="dashboard-card deadlines-panel"
              id="todo"
            >

              <div className="card-title">

                <h3>

                  <ListTodo
                    size={19}
                  />

                  To do

                </h3>

              </div>

              <TodoList onCount={setTodoCount} />

            </aside>

          </div>

        </div>

      </main>

    </div>

  );

}

export default Dashboard;