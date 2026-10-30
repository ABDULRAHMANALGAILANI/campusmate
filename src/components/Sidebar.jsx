import {
  useEffect,
  useState,
} from "react";

import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  Settings,
  User,
  Users,
  LogOut,
} from "lucide-react";

import {
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  supabase,
} from "../lib/supabase";

import MobileNav
  from "./MobileNav";

import AccountMenu
  from "./AccountMenu";

import "./Sidebar.css";


function Sidebar() {
  const navigate =
    useNavigate();

  const location =
    useLocation();


  // =========================================================
  // COLLAPSED STATE
  // =========================================================

  const [
    collapsed,
    setCollapsed,
  ] = useState(() => {
    return (
      localStorage.getItem(
        "campusmate-student-sidebar-collapsed"
      ) === "true"
    );
  });


  // =========================================================
  // KEEP PAGE WIDTH IN SYNC
  // =========================================================

  useEffect(() => {
    const sidebarWidth =
      collapsed
        ? "104px"
        : "310px";


    document.documentElement
      .style
      .setProperty(
        "--student-sidebar-width",
        sidebarWidth
      );


    localStorage.setItem(
      "campusmate-student-sidebar-collapsed",
      String(collapsed)
    );
  }, [
    collapsed,
  ]);


  // =========================================================
  // NAVIGATION
  // =========================================================

  const navigationItems = [
    {
      label:
        "Dashboard",
      short:
        "Home",

      icon:
        LayoutDashboard,

      to:
        "/dashboard",
    },

    {
      label:
        "My Class",

      icon:
        BookOpen,

      to:
        "/classes",
    },

    {
      label:
        "Assignments",

      icon:
        FileText,

      to:
        "/assignments",
    },

    {
      label:
        "Group Projects",

      icon:
        Users,

      to:
        "/projects",
    },

    {
      label:
        "Schedule",

      icon:
        CalendarDays,

      to:
        "/calendar",
    },

    {
      label:
        "Friends & Chat",
      short:
        "Chat",

      icon:
        MessageCircle,

      to:
        "/friends",
    },

    ];


  // =========================================================
  // LOG OUT
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
      className={`student-sidebar ${
        collapsed
          ? "collapsed"
          : ""
      }`}
    >

      {/* =====================================================
          BRAND
      ====================================================== */}

      <div className="student-sidebar-brand">

        <div className="student-sidebar-logo">

          <GraduationCap
            size={33}
          />

        </div>


        {!collapsed && (

          <div className="student-sidebar-brand-text">

            <strong>
              CampusMate
            </strong>

            <span>
              Learn. Connect. Belong.
            </span>

          </div>

        )}


        <button
          type="button"
          className="student-sidebar-toggle"
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

      <nav className="student-sidebar-nav">

        {navigationItems.map(
          ({
            label,
            icon:
              Icon,
            to,
            also = [],
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
                `student-sidebar-link ${
                  isActive ||
                  also.includes(location.pathname)
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

      <div className="student-sidebar-bottom">

        <button
          type="button"
          className="student-sidebar-logout"
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
          navigationItems
        }
        accountLinks={[
          { label: "Profile", to: "/profile", icon: User },
          { label: "Settings", to: "/settings", icon: Settings },
        ]}
        primaryPaths={[
          "/dashboard",
          "/classes",
          "/assignments",
          "/friends",
        ]}
        onLogout={
          handleLogout
        }
      />

      {/* Profile / Settings / Log out from the avatar in the top bar */}
      <AccountMenu
        profilePath="/profile"
        settingsPath="/settings"
        onLogout={
          handleLogout
        }
      />
    </>
  );
}


export default Sidebar;