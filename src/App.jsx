import {
  lazy,
  Suspense,
} from "react";

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute
  from "./components/ProtectedRoute";


import ProjectsGate
  from "./components/ProjectsGate";

// ============================================================
// LOAD ALL PAGE FILES
//
// This prevents Vite from crashing when a page has a slightly
// different filename, for example:
//
// MyClass.jsx
// MyClasses.jsx
// Classes.jsx
// ============================================================

const pageModules =
  import.meta.glob(
    "./pages/**/*.jsx"
  );

// Pages are loaded only when someone visits them (code-splitting),
// so students never download professor pages and vice versa.


// ============================================================
// FIND PAGE
// ============================================================

function findPage(
  possiblePaths
) {
  for (
    const path
    of possiblePaths
  ) {
    const loader =
      pageModules[path];

    if (loader) {
      return lazy(loader);
    }
  }


  return null;
}


// ============================================================
// MISSING PAGE COMPONENT
// ============================================================

function MissingPage({
  title,
  files,
}) {
  return (
    <div
      style={{
        minHeight:
          "100vh",

        padding:
          "50px",

        background:
          "#f5f8fc",

        color:
          "#173558",

        fontFamily:
          "Arial, sans-serif",
      }}
    >

      <h1>
        {title}
      </h1>


      <p>
        CampusMate could not find this page file.
      </p>


      <p>
        Check whether one of these files exists:
      </p>


      <pre
        style={{
          padding:
            "18px",

          borderRadius:
            "10px",

          background:
            "#ffffff",

          border:
            "1px solid #dce6ef",
        }}
      >

        {files.join(
          "\n"
        )}

      </pre>

    </div>
  );
}


// ============================================================
// PAGE RESOLVER
// ============================================================

function resolvePage(
  title,
  possiblePaths
) {
  const Page =
    findPage(
      possiblePaths
    );


  if (Page) {
    return Page;
  }


  return function MissingResolvedPage() {
    return (
      <MissingPage
        title={title}
        files={
          possiblePaths
        }
      />
    );
  };
}


// ============================================================
// PUBLIC PAGES
// ============================================================

const Login =
  resolvePage(
    "Login",
    [
      "./pages/Login.jsx",
    ]
  );


const Register =
  resolvePage(
    "Register",
    [
      "./pages/Register.jsx",
    ]
  );


const ResetPassword =
  resolvePage(
    "Reset Password",
    [
      "./pages/ResetPassword.jsx",
    ]
  );


// First sign-in with a temporary password from the school
const ChangePassword =
  resolvePage(
    "Choose your password",
    [
      "./pages/ChangePassword.jsx",
    ]
  );


// Help (guides + report a problem) and Privacy Notice: open to everyone
const HelpPage =
  resolvePage(
    "Help",
    [
      "./pages/Info/Help.jsx",
    ]
  );

const PrivacyPage =
  resolvePage(
    "Privacy",
    [
      "./pages/Info/Privacy.jsx",
    ]
  );


// Search across all your classes
const SearchPage =
  resolvePage(
    "Search",
    [
      "./pages/Search.jsx",
    ]
  );


// One page per class (students and professors)
const CoursePage =
  resolvePage(
    "Course",
    [
      "./pages/Course/CoursePage.jsx",
    ]
  );


// ============================================================
// SCHOOL ADMIN
// ============================================================

const SchoolAdmin =
  resolvePage(
    "School Admin",
    [
      "./pages/SchoolAdmin/SchoolAdmin.jsx",
    ]
  );


// ============================================================
// STUDENT PAGES
// ============================================================

const Dashboard =
  resolvePage(
    "Student Dashboard",
    [
      "./pages/Dashboard.jsx",
      "./pages/StudentDashboard.jsx",
    ]
  );


// IMPORTANT:
// Your error was here.
//
// CampusMate will now automatically use whichever one exists.
//
const StudentClasses =
  resolvePage(
    "My Class",
    [
      "./pages/MyClass.jsx",
      "./pages/MyClasses.jsx",
      "./pages/StudentClasses.jsx",
      "./pages/Classes.jsx",
      "./pages/Class.jsx",
    ]
  );


const Assignments =
  resolvePage(
    "Assignments",
    [
      "./pages/Assignments.jsx",
      "./pages/StudentAssignments.jsx",
    ]
  );


const Attendance =
  resolvePage(
    "Attendance",
    [
      "./pages/Attendance.jsx",
      "./pages/StudentAttendance.jsx",
    ]
  );




const Calendar =
  resolvePage(
    "Calendar",
    [
      "./pages/Calendar.jsx",
      "./pages/StudentCalendar.jsx",
    ]
  );


const Friends =
  resolvePage(
    "Friends & Chat",
    [
      "./pages/Friends.jsx",
      "./pages/FriendsChat.jsx",
      "./pages/Chat.jsx",
    ]
  );




const Profile =
  resolvePage(
    "Profile",
    [
      "./pages/Profile.jsx",
      "./pages/StudentProfile.jsx",
    ]
  );


const Settings =
  resolvePage(
    "Settings",
    [
      "./pages/Settings.jsx",
      "./pages/StudentSettings.jsx",
    ]
  );


// ============================================================
// PROFESSOR PAGES
// ============================================================

const ProfessorDashboard =
  resolvePage(
    "Professor Dashboard",
    [
      "./pages/Professor/ProfessorDashboard.jsx",
      "./pages/ProfessorDashboard.jsx",
    ]
  );


const ProfessorClasses =
  resolvePage(
    "Professor Classes",
    [
      "./pages/Professor/ProfessorClasses.jsx",
      "./pages/ProfessorClasses.jsx",
    ]
  );




const ProfessorChat =
  resolvePage(
    "Professor Chat & Meetings",
    [
      "./pages/Professor/ProfessorChat.jsx",
      "./pages/Professor/ProfessorChatMeetings.jsx",
      "./pages/ProfessorChat.jsx",
    ]
  );


const ProfessorAssignments =
  resolvePage(
    "Professor Assignments",
    [
      "./pages/Professor/ProfessorAssignments.jsx",
      "./pages/ProfessorAssignments.jsx",
    ]
  );


const ProfessorAttendance =
  resolvePage(
    "Professor Attendance",
    [
      "./pages/Professor/ProfessorAttendance.jsx",
      "./pages/ProfessorAttendance.jsx",
    ]
  );




const ProfessorProfile =
  resolvePage(
    "Professor Profile",
    [
      "./pages/Professor/ProfessorProfile.jsx",
      "./pages/ProfessorProfile.jsx",
    ]
  );


const ProfessorSettings =
  resolvePage(
    "Professor Settings",
    [
      "./pages/Professor/ProfessorSettings.jsx",
      "./pages/ProfessorSettings.jsx",
    ]
  );


// ============================================================
// PROTECTED PAGE HELPER
// ============================================================

function ProtectedPage({
  children,
}) {
  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  );
}


// Professor-only pages: logged in AND profiles.role === "professor"
function ProfessorPage({
  children,
}) {
  return (
    <ProtectedRoute allowedRole="professor">
      {children}
    </ProtectedRoute>
  );
}


// School-admin-only pages
function SchoolAdminPage({
  children,
}) {
  return (
    <ProtectedRoute allowedRole="school_admin">
      {children}
    </ProtectedRoute>
  );
}


// Shown briefly while a page's code downloads.
function PageLoading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f8fc",
        color: "#64748b",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "14px",
      }}
    >
      Loading CampusMate...
    </div>
  );
}


// ============================================================
// APP
// ============================================================

function App() {
  return (
    <BrowserRouter>

      <Suspense fallback={<PageLoading />}>

      <Routes>

        {/* ===================================================
            PUBLIC
        ==================================================== */}

        <Route
          path="/"
          element={
            <Login />
          }
        />


        <Route
          path="/login"
          element={
            <Login />
          }
        />


        <Route
          path="/register"
          element={
            <Register />
          }
        />


        {/* Opened from the password reset email */}
        <Route
          path="/reset-password"
          element={
            <ResetPassword />
          }
        />


        {/* First sign-in with a school's temporary password */}
        <Route
          path="/change-password"
          element={
            <ProtectedPage>

              <ChangePassword />

            </ProtectedPage>
          }
        />


        {/* ===================================================
            SCHOOL ADMIN
        ==================================================== */}

        <Route
          path="/school-admin"
          element={
            <SchoolAdminPage>

              <SchoolAdmin />

            </SchoolAdminPage>
          }
        />


        {/* ===================================================
            STUDENT DASHBOARD
        ==================================================== */}

        <Route
          path="/dashboard"
          element={
            <ProtectedPage>

              <Dashboard />

            </ProtectedPage>
          }
        />


        {/* ===================================================
            MY CLASS

            Supports your existing filename automatically.
        ==================================================== */}

        <Route
          path="/classes"
          element={
            <ProtectedPage>

              <StudentClasses />

            </ProtectedPage>
          }
        />


        {/* Opened by scanning an attendance QR code */}
        <Route
          path="/attendance/check-in/:token"
          element={
            <ProtectedPage>

              <Attendance />

            </ProtectedPage>
          }
        />


        {/* Opened by scanning a class QR code */}
        <Route
          path="/join/:code"
          element={
            <ProtectedPage>

              <StudentClasses />

            </ProtectedPage>
          }
        />


        {/* One class: course, participants, grades */}
        <Route
          path="/classes/:groupId"
          element={
            <ProtectedPage>

              <CoursePage />

            </ProtectedPage>
          }
        />


        <Route
          path="/help"
          element={
            <HelpPage />
          }
        />


        <Route
          path="/privacy"
          element={
            <PrivacyPage />
          }
        />


        <Route
          path="/search"
          element={
            <ProtectedPage>

              <SearchPage />

            </ProtectedPage>
          }
        />


        <Route
          path="/professor/classes/:groupId"
          element={
            <ProfessorPage>

              <CoursePage />

            </ProfessorPage>
          }
        />


        <Route
          path="/class"
          element={
            <Navigate
              to="/classes"
              replace
            />
          }
        />


        <Route
          path="/my-class"
          element={
            <Navigate
              to="/classes"
              replace
            />
          }
        />


        {/* ===================================================
            STUDENT ASSIGNMENTS
        ==================================================== */}

        <Route
          path="/assignments"
          element={
            <ProtectedPage>

              <Assignments />

            </ProtectedPage>
          }
        />


        {/* ===================================================
            GROUP PROJECTS

            ProjectsGate checks profiles.role.

            Student
              -> Projects.jsx

            Professor
              -> ProfessorProjects.jsx
        ==================================================== */}

        <Route
          path="/projects"
          element={
            <ProtectedPage>

              <ProjectsGate />

            </ProtectedPage>
          }
        />


        {/* ===================================================
            STUDENT ATTENDANCE
        ==================================================== */}

        <Route
          path="/attendance"
          element={
            <ProtectedPage>

              <Attendance />

            </ProtectedPage>
          }
        />

        {/* student study planner */}
        <Route
  path="/study-planner"
  element={
    <Navigate to="/calendar" replace />
  }
/>



        {/* ===================================================
            CALENDAR
        ==================================================== */}

        <Route
          path="/calendar"
          element={
            <ProtectedPage>

              <Calendar />

            </ProtectedPage>
          }
        />


        {/* ===================================================
            FRIENDS & CHAT
        ==================================================== */}

        <Route
          path="/friends"
          element={
            <ProtectedPage>

              <Friends />

            </ProtectedPage>
          }
        />


        <Route
          path="/chat"
          element={
            <Navigate
              to="/friends"
              replace
            />
          }
        />


        {/* ===================================================
            STUDENT NOTIFICATIONS
        ==================================================== */}

        <Route
          path="/notifications"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />


        {/* ===================================================
            STUDENT PROFILE
        ==================================================== */}

        <Route
          path="/profile"
          element={
            <ProtectedPage>

              <Profile />

            </ProtectedPage>
          }
        />


        {/* ===================================================
            STUDENT SETTINGS
        ==================================================== */}

        <Route
          path="/settings"
          element={
            <ProtectedPage>

              <Settings />

            </ProtectedPage>
          }
        />


        {/* ===================================================
            PROFESSOR DASHBOARD
        ==================================================== */}

        <Route
          path="/professor/dashboard"
          element={
            <ProfessorPage>

              <ProfessorDashboard />

            </ProfessorPage>
          }
        />


        {/* ===================================================
            PROFESSOR CLASSES
        ==================================================== */}

        <Route
          path="/professor/classes"
          element={
            <ProfessorPage>

              <ProfessorClasses />

            </ProfessorPage>
          }
        />


        {/* ===================================================
            PROFESSOR STUDENTS
        ==================================================== */}

        <Route
          path="/students"
          element={
            <Navigate
              to="/professor/classes"
              replace
            />
          }
        />


        <Route
          path="/professor/students"
          element={
            <Navigate
              to="/professor/classes"
              replace
            />
          }
        />


        {/* ===================================================
            PROFESSOR CHAT & MEETINGS
        ==================================================== */}

        <Route
          path="/professor/chat"
          element={
            <ProfessorPage>

              <ProfessorChat />

            </ProfessorPage>
          }
        />


        <Route
          path="/professor/chat-meetings"
          element={
            <Navigate
              to="/professor/chat"
              replace
            />
          }
        />


        {/* ===================================================
            PROFESSOR ASSIGNMENTS
        ==================================================== */}

        <Route
          path="/professor/assignments"
          element={
            <ProfessorPage>

              <ProfessorAssignments />

            </ProfessorPage>
          }
        />


        {/* ===================================================
            PROFESSOR GROUP PROJECTS

            Redirects to /projects so ProjectsGate decides role.
        ==================================================== */}

        <Route
          path="/professor/projects"
          element={
            <ProtectedPage>
              <ProjectsGate />
            </ProtectedPage>
          }
        />


        {/* ===================================================
            PROFESSOR ATTENDANCE
        ==================================================== */}

        <Route
          path="/professor/attendance"
          element={
            <ProfessorPage>

              <ProfessorAttendance />

            </ProfessorPage>
          }
        />


        {/* ===================================================
            PROFESSOR NOTIFICATIONS
        ==================================================== */}

        <Route
          path="/professor/notifications"
          element={
            <Navigate
              to="/professor/dashboard"
              replace
            />
          }
        />


        {/* ===================================================
            PROFESSOR PROFILE
        ==================================================== */}

        <Route
          path="/professor/profile"
          element={
            <ProfessorPage>

              <ProfessorProfile />

            </ProfessorPage>
          }
        />


        {/* ===================================================
            PROFESSOR SETTINGS
        ==================================================== */}

        <Route
          path="/professor/settings"
          element={
            <ProfessorPage>

              <ProfessorSettings />

            </ProfessorPage>
          }
        />


        {/* ===================================================
            UNKNOWN ROUTE
        ==================================================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>

      </Suspense>

    </BrowserRouter>
  );
}


export default App;