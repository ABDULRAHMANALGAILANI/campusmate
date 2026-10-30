import {
  useEffect,
  useState,
} from "react";

import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  Settings,
  User,
  LogOut,
} from "lucide-react";

import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import {
  supabase,
} from "../lib/supabase";

import MobileNav
  from "./MobileNav";

import AccountMenu
  from "./AccountMenu";

import "./ProfessorSidebar.css";


function ProfessorSidebar() {
  const navigate =
    useNavigate();


  const [
    collapsed,
    setCollapsed,
  ] = useState(() => {
    return (
      localStorage.getItem(
        "campusmate-professor-sidebar-collapsed"
      ) === "true"
    );
  });


  // =========================================================
  // KEEP PAGE WIDTH IN SYNC
  // =========================================================

  useEffect(() => {
    const width =
      collapsed
        ? "92px"
        : "280px";


    document.documentElement
      .style
      .setProperty(
        "--professor-sidebar-width",
        width
      );


    localStorage.setItem(
      "campusmate-professor-sidebar-collapsed",
      String(collapsed)
    );


    return () => {
      // Do not remove the variable here.
      // Other professor pages use it during navigation.
    };
  }, [
    collapsed,
  ]);


  // =========================================================
  // NAV ITEMS
  // =========================================================

  const items = [
    {
      label:
        "Dashboard",
      short:
        "Home",

      icon:
        LayoutDashboard,

      to:
        "/professor/dashboard",
    },

    {
      label:
        "My Classes",
      short:
        "Classes",

      icon:
        BookOpen,

      to:
        "/professor/classes",
    },


    {
      label:
        "Chat & Meetings",
      short:
        "Chat",

      icon:
        MessageCircle,

      to:
        "/professor/chat",
    },

    {
      label:
        "Assignments",

      icon:
        FileText,

      to:
        "/professor/assignments",
    },

    {
      label:
        "Group Projects",

      icon:
        FolderKanban,

      to:
        "/professor/projects",
    },

    {
      label:
        "Attendance",

      icon:
        ClipboardCheck,

      to:
        "/professor/attendance",
    },


    ];


  // =========================================================
  // LOGOUT
  // =========================================================

  async function handleLogout() {
    await supabase.auth.signOut();

    navigate(
      "/",
      {
        replace: true,
      }
    );
  }


  // =========================================================
  // PAGE
  // =========================================================

  return (
    <>
    <aside
      className={`professor-sidebar ${
        collapsed
          ? "collapsed"
          : ""
      }`}
    >

      {/* =====================================================
          BRAND
      ====================================================== */}

      <div className="professor-sidebar-brand">

        <div className="professor-sidebar-logo">

          <GraduationCap
            size={31}
          />

        </div>


        {!collapsed && (

          <div className="professor-sidebar-brand-text">

            <strong>
              CampusMate
            </strong>

            <span>
              Professor Portal
            </span>

          </div>

        )}


        <button
          type="button"
          className="professor-sidebar-toggle"
          onClick={() =>
            setCollapsed(
              (current) =>
                !current
            )
          }
          title={
            collapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
        >

          {collapsed ? (

            <ChevronRight
              size={17}
            />

          ) : (

            <ChevronLeft
              size={17}
            />

          )}

        </button>

      </div>


      {/* =====================================================
          NAVIGATION
      ====================================================== */}

      <nav className="professor-sidebar-nav">

        {items.map(
          ({
            label,
            icon:
              Icon,
            to,
          }) => (

            <NavLink
              key={
                to
              }
              to={
                to
              }
              title={
                collapsed
                  ? label
                  : undefined
              }
              className={({
                isActive,
              }) =>
                `professor-sidebar-link ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
            >

              <Icon
                size={21}
              />


              {!collapsed && (

                <span>
                  {label}
                </span>

              )}

            </NavLink>

          )
        )}

      </nav>

      {/* =====================================================
          LOG OUT (also in the avatar menu)
      ====================================================== */}

      <div className="professor-sidebar-footer">

        <button
          type="button"
          className="professor-sidebar-logout"
          onClick={
            handleLogout
          }
          title={
            collapsed
              ? "Log Out"
              : undefined
          }
        >

          <LogOut
            size={21}
          />

          {!collapsed && (
            <span>
              Log Out
            </span>
          )}

        </button>

      </div>


    </aside>

      {/* Phones: bottom tab bar instead of the sidebar */}
      <MobileNav
        items={
          items
        }
        accountLinks={[
          { label: "Profile", to: "/professor/profile", icon: User },
          { label: "Settings", to: "/professor/settings", icon: Settings },
        ]}
        primaryPaths={[
          "/professor/dashboard",
          "/professor/classes",
          "/professor/attendance",
          "/professor/chat",
        ]}
        onLogout={
          handleLogout
        }
      />

      {/* Profile / Settings / Log out from the avatar in the top bar */}
      <AccountMenu
        profilePath="/professor/profile"
        settingsPath="/professor/settings"
        onLogout={
          handleLogout
        }
      />
    </>
  );
}


export default ProfessorSidebar;