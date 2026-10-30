import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  LifeBuoy,
  LogOut,
  Settings,
  User,
  X,
} from "lucide-react";

import {
  Link,
  useLocation,
} from "react-router-dom";

import { supabase } from "../lib/supabase";

import LanguageSwitcher from "./LanguageSwitcher";

import "./AccountMenu.css";


// =========================================================
// ACCOUNT MENU
// Clicking your photo or name in the top-right corner of any
// page opens this menu: Profile, Settings and Log out.
//
// Every page builds its own top bar, so instead of editing
// each page this listens for clicks on the avatar area inside
// any top bar (<header class="...topbar...">) and opens the
// menu underneath it.
// =========================================================

const TRIGGER_SELECTOR = [
  ".campusmate-user-avatar",
  ".profile-text",
  ".professor-profile-info",
  ".profile-top-avatar",
  ".profile-top-user",
  ".profile-circle",
  ".professor-avatar",
  ".account-chevron",
].join(", ");

// Remembered on this device once the person has seen the tip.
const TIP_KEY =
  "campusmate-account-tip-seen";

// One tip per account, so a student and a professor sharing a
// computer each see it once.
let tipUserId =
  "";

function tipKey() {
  return `${TIP_KEY}-${tipUserId || "unknown"}`;
}

function tipAlreadySeen() {
  // Wait until we know who is signed in.
  if (!tipUserId) {
    return true;
  }

  try {
    return localStorage.getItem(tipKey()) === "true";
  } catch {
    return true; // storage blocked: don't nag every page
  }
}

function rememberTipSeen() {
  try {
    localStorage.setItem(tipKey(), "true");
  } catch {
    // storage blocked: nothing to do
  }
}

// A small down arrow, the usual sign that something opens a menu.
const CHEVRON_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

function findTrigger(element) {
  const trigger =
    element?.closest?.(TRIGGER_SELECTOR);

  if (!trigger) {
    return null;
  }

  const header =
    trigger.closest("header");

  return header && /topbar/.test(header.className)
    ? trigger
    : null;
}


function AccountMenu({
  profilePath,
  settingsPath,
  onLogout,
}) {
  const location =
    useLocation();

  const menuRef =
    useRef(null);

  const [
    position,
    setPosition,
  ] = useState(null);

  const [
    account,
    setAccount,
  ] = useState(null);

  // First-time tip pointing at the avatar: where it should sit
  const [
    tipPosition,
    setTipPosition,
  ] = useState(null);


  // Who is signed in (name + CampusMate ID for the menu header)
  useEffect(() => {
    let active =
      true;

    async function load() {
      const {
        data,
      } =
        await supabase.auth.getUser();

      const userId =
        data?.user?.id;

      if (!userId) return;

      tipUserId =
        userId;

      const {
        data: profile,
      } =
        await supabase
          .from("profiles")
          .select("full_name, campus_id, programme")
          .eq("id", userId)
          .maybeSingle();

      if (active) {
        setAccount(profile || null);
      }
    }

    load();

    return () => {
      active =
        false;
    };
  }, []);


  // Make the avatar areas behave like buttons (mouse + keyboard)
  useEffect(() => {
    function markTriggers() {
      document
        .querySelectorAll("header")
        .forEach((header) => {
          if (!/topbar/.test(header.className)) return;

          header
            .querySelectorAll(TRIGGER_SELECTOR)
            .forEach((element) => {
              if (element.dataset.accountTrigger) return;

              element.dataset.accountTrigger = "true";
              element.setAttribute("role", "button");
              element.setAttribute("tabindex", "0");
              element.setAttribute("aria-haspopup", "menu");
              element.setAttribute("aria-label", "Open account menu");
              element.setAttribute(
                "title",
                "Account: profile, settings, log out"
              );
            });

          // One arrow after the last avatar/name element
          const triggers =
            header.querySelectorAll(
              "[data-account-trigger]:not(.account-chevron)"
            );

          const last =
            triggers[triggers.length - 1];

          if (
            last &&
            !header.querySelector(".account-chevron")
          ) {
            const chevron =
              document.createElement("span");

            chevron.className = "account-chevron";
            chevron.dataset.accountTrigger = "true";
            chevron.setAttribute("aria-hidden", "true");
            chevron.title = "Account: profile, settings, log out";
            chevron.innerHTML = CHEVRON_SVG;

            last.insertAdjacentElement("afterend", chevron);
          }
        });

      // Show the one-time tip under the arrow (computers only)
      if (!tipAlreadySeen()) {
        const chevron =
          document.querySelector("header .account-chevron");

        const rect =
          chevron?.getBoundingClientRect();

        if (rect && rect.width > 0 && window.innerWidth > 768) {
          setTipPosition((current) =>
            current ||
            {
              top: rect.bottom + 12,
              right: Math.max(8, window.innerWidth - rect.right - 6),
            }
          );
        }
      }
    }

    markTriggers();

    // Pages load their top bar after fetching data, so watch for it.
    const observer =
      new MutationObserver(markTriggers);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    function open(trigger) {
      rememberTipSeen();
      setTipPosition(null);

      const rect =
        trigger.getBoundingClientRect();

      setPosition({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }

    function handleClick(event) {
      if (menuRef.current?.contains(event.target)) return;

      const trigger =
        findTrigger(event.target);

      if (trigger) {
        rememberTipSeen();
        setTipPosition(null);

        setPosition((current) => {
          if (current) return null;

          const rect =
            trigger.getBoundingClientRect();

          return {
            top: rect.bottom + 8,
            right: Math.max(8, window.innerWidth - rect.right),
          };
        });
        return;
      }

      setPosition(null);
    }

    function handleKey(event) {
      if (event.key === "Escape") {
        setPosition(null);
        return;
      }

      if (
        (event.key === "Enter" || event.key === " ") &&
        findTrigger(event.target)
      ) {
        event.preventDefault();
        open(findTrigger(event.target));
      }
    }

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKey);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);


  // Once we know who is signed in, show their tip if they
  // haven't seen it yet (the top bar may already be on screen).
  useEffect(() => {
    if (!account || tipAlreadySeen()) {
      return undefined;
    }

    const timer =
      setTimeout(() => {
        const chevron =
          document.querySelector("header .account-chevron");

        const rect =
          chevron?.getBoundingClientRect();

        if (rect && rect.width > 0 && window.innerWidth > 768) {
          setTipPosition((current) =>
            current ||
            {
              top: rect.bottom + 12,
              right: Math.max(8, window.innerWidth - rect.right - 6),
            }
          );
        }
      }, 300);

    return () => clearTimeout(timer);
  }, [account]);


  // Close when moving to another page
  useEffect(() => {
    setPosition(null);
  }, [location.pathname]);


  // Move keyboard focus into the menu when it opens
  useEffect(() => {
    if (position) {
      menuRef.current?.querySelector("a, button")?.focus();
    }
  }, [position]);


  function dismissTip() {
    rememberTipSeen();
    setTipPosition(null);
  }


  if (!position) {
    if (!tipPosition) {
      return null;
    }

    return (
      <div
        className="account-tip"
        role="status"
        style={{
          top: tipPosition.top,
          right: tipPosition.right,
        }}
      >
        <button
          type="button"
          className="account-tip-close"
          onClick={dismissTip}
          aria-label="Dismiss tip"
        >
          <X size={16} />
        </button>

        <strong>
          Your account is here
        </strong>

        <p>
          Click your name or photo to open your
          profile, settings and log out.
        </p>

        <button
          type="button"
          className="account-tip-ok"
          onClick={dismissTip}
        >
          Got it
        </button>
      </div>
    );
  }


  return (
    <div
      ref={menuRef}
      className="account-menu"
      role="menu"
      aria-label="Account"
      style={{
        top: position.top,
        right: position.right,
      }}
    >
      {account && (
        <div className="account-menu-header">
          <strong>
            {account.full_name}
          </strong>

          <span>
            {[account.campus_id, account.programme]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      )}

      <Link
        role="menuitem"
        to={profilePath}
        className="account-menu-item"
      >
        <User size={18} aria-hidden="true" />
        Profile
      </Link>

      <Link
        role="menuitem"
        to={settingsPath}
        className="account-menu-item"
      >
        <Settings size={18} aria-hidden="true" />
        Settings
      </Link>

      <Link
        role="menuitem"
        to="/help"
        className="account-menu-item"
      >
        <LifeBuoy size={18} aria-hidden="true" />
        Help
      </Link>

      <LanguageSwitcher variant="menu" />

      <div className="account-menu-divider" />

      <button
        type="button"
        role="menuitem"
        className="account-menu-item logout"
        onClick={onLogout}
      >
        <LogOut size={18} aria-hidden="true" />
        Log out
      </button>
    </div>
  );
}

export default AccountMenu;
