import {
  useEffect,
  useState,
} from "react";

import {
  LifeBuoy,
  LogOut,
  Menu,
  X,
} from "lucide-react";

import {
  NavLink,
  useLocation,
} from "react-router-dom";

import InstallBanner from "./InstallBanner";
import LanguageSwitcher from "./LanguageSwitcher";

import "./MobileNav.css";


// =========================================================
// MOBILE NAVIGATION
// On phones the sidebar is hidden and this bottom tab bar
// is shown instead. "More" opens a sheet with every page.
//
// items        -> the same list the sidebar uses
// primaryPaths -> the 4 pages shown as tabs
// onLogout     -> the sidebar's log out function
// =========================================================

function MobileNav({
  items,
  primaryPaths,
  onLogout,
  accountLinks = [],
}) {
  const location =
    useLocation();

  const [
    moreOpen,
    setMoreOpen,
  ] = useState(false);

  const primaryItems =
    primaryPaths
      .map((path) => items.find((item) => item.to === path))
      .filter(Boolean);

  const onMorePage =
    !primaryItems.some((item) =>
      location.pathname.startsWith(item.to)
    );

  // Some tabs cover more than one page (item.also)
  const isActivePath = (item, isActive) =>
    isActive || (item.also || []).includes(location.pathname);


  // Leave room at the bottom of every page for the tab bar.
  useEffect(() => {
    document.body.classList.add("has-mobile-nav");

    return () => {
      document.body.classList.remove("has-mobile-nav");
    };
  }, []);


  // Close the sheet with Escape and stop the page scrolling behind it.
  useEffect(() => {
    if (!moreOpen) {
      return undefined;
    }

    function handleKey(event) {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    }

    document.addEventListener("keydown", handleKey);
    document.body.classList.add("mobile-nav-locked");

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.classList.remove("mobile-nav-locked");
    };
  }, [moreOpen]);


  return (
    <>
      {/* ================= MORE SHEET ================= */}
      {moreOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="mobile-nav-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="All pages"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-nav-sheet-header">
              <strong>Menu</strong>

              <button
                type="button"
                className="mobile-nav-close"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="mobile-nav-grid">
              {items.map((item) => {
                const { label, icon: Icon, to } = item;

                return (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `mobile-nav-grid-item ${
                      isActivePath(item, isActive) ? "active" : ""
                    }`
                  }
                >
                  <Icon
                    size={22}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </NavLink>
                );
              })}
            </nav>

            {/* Profile / Settings as a simple list */}
            {accountLinks.length > 0 && (
              <div className="mobile-nav-account">
                {accountLinks.map(({ label, to, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMoreOpen(false)}
                    className="mobile-nav-account-link"
                  >
                    <Icon size={20} aria-hidden="true" />
                    {label}
                  </NavLink>
                ))}
              </div>
            )}

            <div className="mobile-nav-account">
              <NavLink
                to="/help"
                onClick={() => setMoreOpen(false)}
                className="mobile-nav-account-link"
              >
                <LifeBuoy size={20} aria-hidden="true" />
                Help
              </NavLink>
              <LanguageSwitcher variant="menu" />
            </div>

            <button
              type="button"
              className="mobile-nav-logout"
              onClick={onLogout}
            >
              <LogOut
                size={18}
                aria-hidden="true"
              />
              Log out
            </button>
          </div>
        </div>
      )}


      <InstallBanner />

      {/* ================= TAB BAR ================= */}
      <nav
        className="mobile-nav-bar"
        aria-label="Main"
      >
        {primaryItems.map(({ label, short, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `mobile-nav-tab ${isActive ? "active" : ""}`
            }
          >
            <Icon
              size={22}
              aria-hidden="true"
            />
            <span>{short || label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          className={`mobile-nav-tab ${
            moreOpen || onMorePage ? "active" : ""
          }`}
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
        >
          <Menu
            size={22}
            aria-hidden="true"
          />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}

export default MobileNav;
