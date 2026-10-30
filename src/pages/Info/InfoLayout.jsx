import { Link } from "react-router-dom";

import { GraduationCap } from "lucide-react";


import Sidebar from "../../components/Sidebar";
import ProfessorSidebar from "../../components/ProfessorSidebar";
import NotificationBell from "../../components/NotificationBell";
import UserAvatar from "../../components/UserAvatar";
import LanguageSwitcher from "../../components/LanguageSwitcher";


import "./Info.css";


// =========================================================
// Layout for Help and Privacy. Signed in: the normal menu.
// Signed out (opened from the sign-in page): a simple header.
// =========================================================

function InfoLayout({ account, children }) {
  const signedIn =
    Boolean(account.user) && account.role !== "school_admin";

  const Nav =
    account.role === "professor" ? ProfessorSidebar : Sidebar;

  return (
    <div className="info-page">
      {signedIn && <Nav />}

      <main className={`info-main ${signedIn ? (account.role === "professor" ? "professor" : "student") : "public"}`}>
        <header className="info-topbar">
          {signedIn ? <span /> : (
            <Link to="/" className="info-brand">
              <GraduationCap size={22} aria-hidden="true" />
              <span>CampusMate</span>
            </Link>
          )}
          <div className="info-topbar-right">
            {!signedIn && <LanguageSwitcher />}
            {signedIn ? <><NotificationBell /><UserAvatar size={40} /></> : account.user ? (
              <Link to="/school-admin" className="info-signin">School admin</Link>
            ) : (
              <Link to="/" className="info-signin">Sign in</Link>
            )}
          </div>
        </header>

        <div className="info-content">{children}</div>
      </main>
    </div>
  );
}

export default InfoLayout;
