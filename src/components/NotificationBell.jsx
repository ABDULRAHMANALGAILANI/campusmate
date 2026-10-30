import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Bell,
  CalendarCheck,
  CheckCheck,
  CheckCircle2,
  FileHeart,
  FileText,
  ListChecks,
  Megaphone,
  MessageCircleQuestion,
  Paperclip,
  X,
} from "lucide-react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { supabase } from "../lib/supabase";

import SearchButton from "./SearchButton";

import "./NotificationBell.css";


// =========================================================
// NOTIFICATION BELL
// Shows how many notifications are unread. Click it to see
// them in a drop-down; click one to open its class.
// Notifications are made by the database
// (supabase/12-notifications.sql, 13-late-work-and-reminders.sql).
// =========================================================

const ICONS = {
  assignment: FileText,
  announcement: Megaphone,
  material: Paperclip,
  marked: CheckCircle2,
  question: MessageCircleQuestion,
  quiz: ListChecks,
  excuse: FileHeart,
  attendance: CalendarCheck,
};


function timeAgo(value) {
  if (!value) return "";

  const minutes =
    Math.round((Date.now() - new Date(value).getTime()) / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours =
    Math.round(minutes / 60);

  if (hours < 24) return `${hours} h ago`;

  const days =
    Math.round(hours / 24);

  if (days < 7) return `${days} d ago`;

  return new Date(value).toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}


function NotificationBell({ showSearch = true }) {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const wrapper =
    useRef(null);

  const [userId, setUserId] = useState("");
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);


  // Unread count, refreshed whenever the page changes.
  // Also makes any "due soon" reminders first.
  useEffect(() => {
    let active =
      true;

    async function loadCount() {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      const id =
        session?.user?.id;

      if (!id || !active) return;

      setUserId(id);

      await supabase
        .rpc("create_due_soon_reminders")
        .then(() => {}, () => {});

      const { count: unread } =
        await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", id)
          .eq("is_read", false);

      if (active) {
        setCount(unread || 0);
      }
    }

    loadCount();

    return () => {
      active =
        false;
    };
  }, [location.pathname]);


  const loadItems = useCallback(async () => {
    if (!userId) return;

    setLoading(true);

    const { data } =
      await supabase
        .from("notifications")
        .select("id, title, message, category, link, is_read, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

    setItems(data || []);
    setLoading(false);
  }, [userId]);


  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return undefined;

    function onClick(event) {
      if (wrapper.current && !wrapper.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);


  function toggle() {
    if (!open) loadItems();
    setOpen((value) => !value);
  }


  async function openItem(item) {
    setOpen(false);

    if (!item.is_read) {
      setCount((value) => Math.max(0, value - 1));

      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", item.id);
    }

    if (item.link) {
      navigate(item.link);
    }
  }


  async function markAllRead() {
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    setCount(0);

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
  }


  return (
    <>
    {showSearch && <SearchButton />}
    <div className="notification-bell" ref={wrapper}>

      <button
        type="button"
        className="notification-bell-button"
        onClick={toggle}
        aria-label={count > 0 ? `Notifications (${count} unread)` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
      >
        <Bell size={21} strokeWidth={2} />

        {count > 0 && (
          <span className="notification-bell-badge">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>


      {open && (
        <div
          className="notification-panel"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="notification-panel-head">
            <strong>Notifications</strong>

            <div>
              {items.some((item) => !item.is_read) && (
                <button
                  type="button"
                  className="notification-panel-link"
                  onClick={markAllRead}
                >
                  <CheckCheck size={15} aria-hidden="true" />
                  Mark all read
                </button>
              )}

              <button
                type="button"
                className="notification-panel-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="notification-panel-list">
            {loading && items.length === 0 ? (
              <p className="notification-panel-empty">Loading...</p>
            ) : items.length === 0 ? (
              <div className="notification-panel-empty">
                <CheckCircle2 size={30} aria-hidden="true" />
                <strong>You&apos;re all caught up</strong>
                <span>New work, announcements and marks will show up here.</span>
              </div>
            ) : (
              items.map((item) => {
                const Icon =
                  ICONS[item.category] || Bell;

                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`notification-panel-item ${item.is_read ? "" : "unread"} ${item.category || ""}`}
                    onClick={() => openItem(item)}
                  >
                    <span className="notification-panel-icon">
                      <Icon size={16} aria-hidden="true" />
                    </span>

                    <span className="notification-panel-text">
                      <strong>{item.title}</strong>
                      {item.message && <span>{item.message}</span>}
                      <small>{timeAgo(item.created_at)}</small>
                    </span>

                    {!item.is_read && (
                      <span className="notification-panel-dot" aria-label="Unread" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
    </>
  );
}

export default NotificationBell;
