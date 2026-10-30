import {
  Fragment,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  GraduationCap,
  Send,
  Video,
} from "lucide-react";

import { supabase } from "../lib/supabase";


// =========================================================
// PROFESSOR CHATS (student side)
//
// Professors message students through the professor_messages
// table. These two pieces show those chats inside the
// student's Friends & Chat page and let the student reply.
//
//   <ProfessorChatList />     rows at the top of "Chats"
//   <ProfessorConversation /> the open chat with a professor
// =========================================================


// ---------- small helpers ----------

function initials(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function formatTime(value) {
  if (!value) return "";

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatListTime(value) {
  if (!value) return "";

  const date = new Date(value);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return formatTime(value);
  }

  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
  });
}

function formatDayLabel(value) {
  if (!value) return "";

  const date = new Date(value);
  const today = new Date();

  const startOf = (day) =>
    new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();

  const daysAgo = Math.round(
    (startOf(today) - startOf(date)) / (24 * 60 * 60 * 1000)
  );

  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";

  if (daysAgo < 7) {
    return date.toLocaleDateString([], { weekday: "long" });
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}


// The professor_messages table has no "read" column, so this
// device remembers when the student last opened each chat.
function seenKey(professorId) {
  return `campusmate-professor-chat-seen-${professorId}`;
}

function markSeen(professorId) {
  try {
    localStorage.setItem(seenKey(professorId), new Date().toISOString());
  } catch {
    // storage blocked: unread counts just stay visible
  }
}

function lastSeen(professorId) {
  try {
    return localStorage.getItem(seenKey(professorId));
  } catch {
    return null;
  }
}


// =========================================================
// LIST: professors at the top of the "Chats" tab
// =========================================================

export function ProfessorChatList({
  currentUserId,
  selectedId,
  onSelect,
}) {
  const [professors, setProfessors] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const [unread, setUnread] = useState({});
  const [refresh, setRefresh] = useState(0);


  useEffect(() => {
    if (!currentUserId) return undefined;

    let active = true;

    async function load() {
      // 1. Professors this student is linked to
      const { data: links } = await supabase
        .from("professor_students")
        .select("professor_id")
        .eq("student_id", currentUserId);

      const ids = [
        ...new Set((links || []).map((row) => row.professor_id)),
      ];

      if (ids.length === 0) {
        if (active) setProfessors([]);
        return;
      }

      // 2. Their names + 3. recent messages, in parallel
      const [profileResult, messageResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, programme")
          .in("id", ids),

        supabase
          .from("professor_messages")
          .select("professor_id, sender_id, message, created_at")
          .eq("student_id", currentUserId)
          .order("created_at", { ascending: false })
          .limit(300),
      ]);

      if (!active) return;

      const latest = {};
      const counts = {};

      (messageResult.data || []).forEach((row) => {
        if (!latest[row.professor_id]) {
          latest[row.professor_id] = row;
        }

        const seen = lastSeen(row.professor_id);

        if (
          row.sender_id !== currentUserId &&
          (!seen || new Date(row.created_at) > new Date(seen))
        ) {
          counts[row.professor_id] = (counts[row.professor_id] || 0) + 1;
        }
      });

      // Most recent conversation first
      const sorted = [...(profileResult.data || [])].sort((a, b) => {
        const timeA = latest[a.id]?.created_at || "";
        const timeB = latest[b.id]?.created_at || "";
        return timeB.localeCompare(timeA);
      });

      setProfessors(sorted);
      setLastMessages(latest);
      setUnread(counts);
    }

    load();

    // Refresh when a professor sends something new
    const channel = supabase
      .channel(`student-professor-list-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "professor_messages",
          filter: `student_id=eq.${currentUserId}`,
        },
        () => setRefresh((value) => value + 1)
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, refresh, selectedId]);


  if (professors.length === 0) {
    return null;
  }


  return (
    <div className="professor-chat-section">
      <p className="professor-chat-label">
        Professors
      </p>

      {professors.map((professor) => {
        const last = lastMessages[professor.id];
        const count =
          selectedId === professor.id ? 0 : unread[professor.id] || 0;

        return (
          <button
            type="button"
            key={professor.id}
            className={`conversation-item ${
              selectedId === professor.id ? "active" : ""
            }`}
            onClick={() => onSelect(professor)}
          >
            <div className="friend-avatar professor-avatar">
              {initials(professor.full_name)}
            </div>

            <div className="conversation-main">
              <div className="conversation-name-row">
                <strong>
                  {professor.full_name}
                  <span className="professor-tag">
                    Professor
                  </span>
                </strong>

                <small>
                  {formatListTime(last?.created_at)}
                </small>
              </div>

              <div className="conversation-preview-row">
                <p>
                  {last
                    ? `${
                        last.sender_id === currentUserId ? "You: " : ""
                      }${last.message}`
                    : "No messages yet"}
                </p>

                {count > 0 && (
                  <span className="chat-unread">
                    {count}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}


// =========================================================
// CONVERSATION: chat with one professor
// =========================================================

export function ProfessorConversation({
  professor,
  currentUserId,
  onBack,
}) {
  const [messages, setMessages] = useState([]);
  const [meeting, setMeeting] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [refresh, setRefresh] = useState(0);

  const bottomRef = useRef(null);

  const professorId = professor?.id;


  // Load messages + any active video meeting, and listen for new ones
  useEffect(() => {
    if (!professorId || !currentUserId) return undefined;

    let active = true;

    async function load() {
      const [messageResult, meetingResult] = await Promise.all([
        supabase
          .from("professor_messages")
          .select("*")
          .eq("professor_id", professorId)
          .eq("student_id", currentUserId)
          .order("created_at", { ascending: true }),

        supabase
          .from("professor_meetings")
          .select("*")
          .eq("professor_id", professorId)
          .eq("student_id", currentUserId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      if (!active) return;

      if (messageResult.error) {
        setErrorMessage(
          "Could not load messages: " + messageResult.error.message
        );
        return;
      }

      setMessages(messageResult.data || []);
      setMeeting(meetingResult.data?.[0] || null);
      markSeen(professorId);
    }

    load();

    const channel = supabase
      .channel(`student-professor-chat-${currentUserId}-${professorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "professor_messages",
          filter: `student_id=eq.${currentUserId}`,
        },
        () => setRefresh((value) => value + 1)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "professor_meetings",
          filter: `student_id=eq.${currentUserId}`,
        },
        () => setRefresh((value) => value + 1)
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [professorId, currentUserId, refresh]);


  // Keep the newest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);


  async function handleSend(event) {
    event.preventDefault();

    const clean = draft.trim();

    if (!clean || sending) return;

    setSending(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("professor_messages")
      .insert({
        professor_id: professorId,
        student_id: currentUserId,
        sender_id: currentUserId,
        message: clean,
      });

    setSending(false);

    if (error) {
      setErrorMessage("Message not sent: " + error.message);
      return;
    }

    setDraft("");
    setRefresh((value) => value + 1);
  }


  return (
    <>
      {/* HEADER */}
      <div className="chat-header">
        <button
          type="button"
          className="chat-back-btn"
          onClick={onBack}
          aria-label="Back to chats"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="friend-avatar professor-avatar">
          {initials(professor.full_name)}
        </div>

        <div className="chat-header-info">
          <strong>
            {professor.full_name}
          </strong>

          <small>
            Professor
            {professor.programme ? ` · ${professor.programme}` : ""}
          </small>
        </div>
      </div>


      {/* ACTIVE VIDEO MEETING */}
      {meeting?.room_name && (
        <div className="professor-meeting-bar">
          <Video size={18} aria-hidden="true" />

          <span>
            Your professor started a video meeting
          </span>

          <a
            href={`https://meet.jit.si/${meeting.room_name}`}
            target="_blank"
            rel="noreferrer"
          >
            Join
          </a>
        </div>
      )}


      {/* MESSAGES */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="start-conversation">
            <GraduationCap size={37} />
            <p>
              No messages with {professor.full_name} yet.
              Say hello or ask a question.
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const mine = message.sender_id === currentUserId;
            const previous = messages[index - 1];
            const dayLabel = formatDayLabel(message.created_at);
            const newDay =
              !previous ||
              formatDayLabel(previous.created_at) !== dayLabel;
            const firstInGroup =
              newDay || previous.sender_id !== message.sender_id;

            return (
              <Fragment key={message.id}>
                {newDay && (
                  <div className="chat-day-chip">
                    <span>{dayLabel}</span>
                  </div>
                )}

                <div
                  className={`message-row ${mine ? "mine" : "theirs"} ${
                    firstInGroup ? "first" : ""
                  }`}
                >
                  <div className="message-bubble">
                    <p>{message.message}</p>

                    <div className="message-meta">
                      <span>{formatTime(message.created_at)}</span>
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })
        )}

        <div ref={bottomRef} />
      </div>


      {errorMessage && (
        <p
          className="professor-chat-error"
          role="alert"
        >
          {errorMessage}
        </p>
      )}


      {/* MESSAGE BOX */}
      <form
        className="chat-input-bar"
        onSubmit={handleSend}
      >
        <label
          className="professor-chat-sr"
          htmlFor="professor-chat-input"
        >
          Message {professor.full_name}
        </label>

        <input
          id="professor-chat-input"
          type="text"
          placeholder={`Message ${professor.full_name}...`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoComplete="off"
        />

        <button
          type="submit"
          className="send-message-btn"
          disabled={!draft.trim() || sending}
          aria-label="Send"
        >
          <Send size={18} />
        </button>
      </form>
    </>
  );
}
