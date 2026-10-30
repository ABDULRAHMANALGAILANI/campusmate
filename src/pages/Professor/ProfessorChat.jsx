import {
  Fragment,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Search,
  MessageCircle,
  Send,
  Video,
  PhoneOff,
  GraduationCap,
  Users,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import ProfessorSidebar from "../../components/ProfessorSidebar";
import NotificationBell from "../../components/NotificationBell";
import UserAvatar from "../../components/UserAvatar";

import "./ProfessorDashboard.css";
import "./ProfessorChat.css";


function ProfessorChat() {
  // Phones: show the student list first, then a full-screen chat.
  const [
    mobileChatOpen,
    setMobileChatOpen,
  ] = useState(false);

  const [
    currentUser,
    setCurrentUser,
  ] = useState(null);

  const [
    profile,
    setProfile,
  ] = useState(null);

  const [
    students,
    setStudents,
  ] = useState([]);

  const [
    selectedStudentId,
    setSelectedStudentId,
  ] = useState("");

  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    meeting,
    setMeeting,
  ] = useState(null);

  const [
    messageText,
    setMessageText,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    startingMeeting,
    setStartingMeeting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  const bottomRef =
    useRef(null);


  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadPage();
  }, []);


  async function loadPage() {
    setLoading(true);
    setErrorMessage("");


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
      setErrorMessage(
        "You must be logged in."
      );

      setLoading(false);

      return;
    }


    setCurrentUser(user);


    const {
      data: profileData,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        `
        id,
        full_name,
        programme,
        role,
        avatar_path
        `
      )
      .eq(
        "id",
        user.id
      )
      .maybeSingle();


    if (profileError) {
      setErrorMessage(
        profileError.message
      );

      setLoading(false);

      return;
    }


    if (
      profileData?.role !==
      "professor"
    ) {
      setErrorMessage(
        "This page is available only to professor accounts."
      );

      setLoading(false);

      return;
    }


    setProfile(
      profileData
    );


    await loadStudents(
      user.id
    );


    setLoading(false);
  }


  // =========================================================
  // STUDENTS
  // =========================================================

  async function loadStudents(
    professorId
  ) {
    const {
      data: relations,
      error,
    } = await supabase
      .from("professor_students")
      .select("student_id")
      .eq(
        "professor_id",
        professorId
      );


    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }


    const ids =
      (
        relations ||
        []
      ).map(
        (item) =>
          item.student_id
      );


    if (
      ids.length === 0
    ) {
      setStudents([]);
      setSelectedStudentId("");

      return;
    }


    const {
      data,
      error: studentError,
    } = await supabase
      .from("profiles")
      .select(
        `
        id,
        full_name,
        student_id,
        programme,
        avatar_path
        `
      )
      .in(
        "id",
        ids
      )
      .order(
        "full_name",
        {
          ascending: true,
        }
      );


    if (studentError) {
      setErrorMessage(
        studentError.message
      );

      return;
    }


    setStudents(
      data ||
      []
    );


    setSelectedStudentId(
      data?.[0]?.id ||
      ""
    );
  }


  // =========================================================
  // LOAD CHAT WHEN STUDENT CHANGES
  // =========================================================

  useEffect(() => {
    if (
      !currentUser ||
      !selectedStudentId
    ) {
      return;
    }


    loadConversation();

    loadActiveMeeting();


    const channel =
      supabase
        .channel(
          `professor-chat-${currentUser.id}-${selectedStudentId}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table:
              "professor_messages",
          },
          (payload) => {

            const message =
              payload.new;


            const belongsToChat =
              message.professor_id ===
                currentUser.id &&
              message.student_id ===
                selectedStudentId;


            if (
              belongsToChat
            ) {
              setMessages(
                (current) => {

                  const exists =
                    current.some(
                      (item) =>
                        item.id ===
                        message.id
                    );


                  if (exists) {
                    return current;
                  }


                  return [
                    ...current,
                    message,
                  ];

                }
              );
            }

          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "professor_meetings",
          },
          () => {
            loadActiveMeeting();
          }
        )
        .subscribe();


    return () => {
      supabase.removeChannel(
        channel
      );
    };

  }, [
    currentUser,
    selectedStudentId,
  ]);


  // =========================================================
  // SCROLL
  // =========================================================

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);


  // =========================================================
  // CONVERSATION
  // =========================================================

  async function loadConversation() {
    const {
      data,
      error,
    } = await supabase
      .from("professor_messages")
      .select("*")
      .eq(
        "professor_id",
        currentUser.id
      )
      .eq(
        "student_id",
        selectedStudentId
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );


    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }


    setMessages(
      data ||
      []
    );
  }


  // =========================================================
  // SEND MESSAGE
  // =========================================================

  async function sendMessage(
    event
  ) {
    event.preventDefault();


    const clean =
      messageText.trim();


    if (
      !clean ||
      !currentUser ||
      !selectedStudentId
    ) {
      return;
    }


    setSending(true);
    setErrorMessage("");


    const {
      error,
    } = await supabase
      .from("professor_messages")
      .insert({
        professor_id:
          currentUser.id,

        student_id:
          selectedStudentId,

        sender_id:
          currentUser.id,

        message:
          clean,
      });


    if (error) {
      setErrorMessage(
        "Could not send message: " +
          error.message
      );

      setSending(false);

      return;
    }


    setMessageText("");

    setSending(false);
  }


  // =========================================================
  // ACTIVE MEETING
  // =========================================================

  async function loadActiveMeeting() {
    if (
      !currentUser ||
      !selectedStudentId
    ) {
      return;
    }


    const {
      data,
      error,
    } = await supabase
      .from("professor_meetings")
      .select("*")
      .eq(
        "professor_id",
        currentUser.id
      )
      .eq(
        "student_id",
        selectedStudentId
      )
      .eq(
        "status",
        "active"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();


    if (error) {
      console.error(
        "Meeting error:",
        error
      );

      return;
    }


    setMeeting(
      data ||
      null
    );
  }


  // =========================================================
  // START MEETING
  // =========================================================

  async function startMeeting() {
    if (
      !currentUser ||
      !selectedStudentId
    ) {
      return;
    }


    if (meeting) {
      joinMeeting(
        meeting
      );

      return;
    }


    setStartingMeeting(
      true
    );

    setErrorMessage("");


    const roomName =
      `campusmate-${crypto
        .randomUUID()
        .replaceAll("-", "")}`;


    const selectedStudent =
      students.find(
        (student) =>
          student.id ===
          selectedStudentId
      );


    const {
      data,
      error,
    } = await supabase
      .from("professor_meetings")
      .insert({
        professor_id:
          currentUser.id,

        student_id:
          selectedStudentId,

        title:
          `Meeting with ${
            selectedStudent?.full_name ||
            "Student"
          }`,

        room_name:
          roomName,

        status:
          "active",
      })
      .select()
      .single();


    if (error) {
      setErrorMessage(
        "Could not start meeting: " +
          error.message
      );

      setStartingMeeting(
        false
      );

      return;
    }


    setMeeting(
      data
    );


    // Send meeting notification into chat.

    await supabase
      .from("professor_messages")
      .insert({
        professor_id:
          currentUser.id,

        student_id:
          selectedStudentId,

        sender_id:
          currentUser.id,

        message:
          "📹 A video meeting has been started. Open Chat & Meetings to join.",
      });


    setStartingMeeting(
      false
    );


    joinMeeting(
      data
    );
  }


  // =========================================================
  // JOIN MEETING
  // =========================================================

  function joinMeeting(
    meetingData
  ) {
    if (
      !meetingData?.room_name
    ) {
      return;
    }


    const url =
      `https://meet.jit.si/${meetingData.room_name}`;


    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }


  // =========================================================
  // END MEETING
  // =========================================================

  async function endMeeting() {
    if (!meeting) {
      return;
    }


    const {
      error,
    } = await supabase
      .from("professor_meetings")
      .update({
        status:
          "ended",

        ended_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        meeting.id
      );


    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }


    setMeeting(null);


    await supabase
      .from("professor_messages")
      .insert({
        professor_id:
          currentUser.id,

        student_id:
          selectedStudentId,

        sender_id:
          currentUser.id,

        message:
          "📹 Video meeting ended.",
      });
  }


  // =========================================================
  // HELPERS
  // =========================================================

  // "Today", "Yesterday", a weekday, or a date
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


  function formatTime(
    value
  ) {
    return new Date(
      value
    ).toLocaleTimeString(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }


  const selectedStudent =
    students.find(
      (student) =>
        student.id ===
        selectedStudentId
    );


  const filteredStudents =
    students.filter(
      (student) => {

        const query =
          search
            .trim()
            .toLowerCase();


        if (!query) {
          return true;
        }


        return (
          student.full_name
            ?.toLowerCase()
            .includes(query) ||
          student.student_id
            ?.toLowerCase()
            .includes(query)
        );

      }
    );


  const professorName =
    profile?.full_name ||
    "Professor";




  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="professor-loading">

        <div>

          <GraduationCap
            size={42}
          />

          <p>
            Loading chat...
          </p>

        </div>

      </div>
    );
  }


  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="professor-dashboard-page">

      <ProfessorSidebar />


      <main className="professor-main">

        {/* TOP BAR */}

        <header className="professor-topbar">

          <div className="professor-search">

            <Search size={18} />

            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

          </div>


          <div className="professor-topbar-right">

            <NotificationBell />


            <UserAvatar
              profile={profile}
              name={professorName}
              size={46}
            />


            <div className="professor-profile-info">

              <strong>
                {professorName}
              </strong>

              <small>
                Professor
              </small>

            </div>

          </div>

        </header>


        <div className="professor-chat-content">

          <div className="professor-chat-page-header">

            <h1>
              Chat & Meetings
            </h1>

            <p>
              Communicate directly with your assigned students.
            </p>

          </div>


          {errorMessage && (

            <div className="professor-error">

              {errorMessage}

            </div>

          )}


          {students.length === 0 ? (

            <div className="professor-chat-empty-page">

              <Users
                size={46}
              />

              <h2>
                No students assigned
              </h2>

              <p>
                Add students from the Students page before starting a conversation.
              </p>

            </div>

          ) : (

            <div className={`professor-chat-layout ${
                mobileChatOpen ? "chat-open" : ""
              }`}>

              {/* =============================================
                  CONTACT LIST
              ============================================== */}

              <aside className="professor-chat-students">

                <div className="professor-chat-students-header">

                  <MessageCircle
                    size={18}
                  />

                  <h2>
                    Students
                  </h2>

                </div>


                <div className="professor-chat-student-list">

                  {filteredStudents.map(
                    (student) => (

                      <button
                        type="button"
                        key={
                          student.id
                        }
                        className={`professor-chat-student ${
                          selectedStudentId ===
                          student.id
                            ? "active"
                            : ""
                        }`}
                        onClick={() => {
                          setSelectedStudentId(
                            student.id
                          );
                          setMobileChatOpen(true);
                        }}
                      >

                        <UserAvatar
                          profile={student}
                          userId={student.id}
                          name={student.full_name}
                          size={38}
                        />


                        <div>

                          <strong>
                            {
                              student.full_name
                            }
                          </strong>

                          <small>
                            {
                              student.student_id ||
                              "Student"
                            }
                          </small>

                        </div>

                      </button>

                    )
                  )}

                </div>

              </aside>


              {/* =============================================
                  CHAT
              ============================================== */}

              <section className="professor-chat-panel">

                {/* CHAT HEADER */}

                <div className="professor-chat-header">

                  <div className="professor-chat-person">
                    <button
                      type="button"
                      className="professor-chat-back"
                      onClick={() =>
                        setMobileChatOpen(false)
                      }
                      aria-label="Back to students"
                    >
                      <ArrowLeft size={20} />
                    </button>


                    <UserAvatar
                      profile={selectedStudent}
                      userId={selectedStudent?.id}
                      name={selectedStudent?.full_name || "Student"}
                      size={44}
                    />


                    <div>

                      <h2>
                        {selectedStudent
                          ?.full_name ||
                          "Student"}
                      </h2>

                      <p>
                        {selectedStudent
                          ?.programme ||
                          "Student"}
                      </p>

                    </div>

                  </div>


                  <div className="professor-chat-call-actions">

                    {meeting && (

                      <span className="professor-live-meeting">

                        <span />

                        Meeting Live

                      </span>

                    )}


                    <button
                      type="button"
                      className="professor-video-button"
                      onClick={
                        startMeeting
                      }
                      disabled={
                        startingMeeting
                      }
                    >

                      <Video
                        size={17}
                      />

                      <span className="professor-video-label">{meeting
                        ? "Join Meeting"
                        : startingMeeting
                        ? "Starting..."
                        : "Start Meeting"}</span>

                    </button>


                    {meeting && (

                      <button
                        type="button"
                        className="professor-end-call"
                        onClick={
                          endMeeting
                        }
                      >

                        <PhoneOff
                          size={17}
                        />

                        End

                      </button>

                    )}

                  </div>

                </div>


                {/* MESSAGES */}

                <div className="professor-chat-messages">

                  {messages.length ===
                  0 ? (

                    <div className="professor-chat-no-messages">

                      <MessageCircle
                        size={45}
                      />

                      <h3>
                        Start the conversation
                      </h3>

                      <p>
                        Send a message to this student.
                      </p>

                    </div>

                  ) : (

                    messages.map(
                      (message, index) => {
                        const mine =
                          message.sender_id ===
                          currentUser?.id;
                        const previous =
                          messages[index - 1];
                        const dayLabel =
                          formatDayLabel(message.created_at);
                        const newDay =
                          !previous ||
                          formatDayLabel(previous.created_at) !== dayLabel;
                        const firstInGroup =
                          newDay ||
                          previous.sender_id !== message.sender_id;
                        return (
                          <Fragment key={message.id}>
                          {newDay && (
                            <div className="professor-chat-day">
                              <span>{dayLabel}</span>
                            </div>
                          )}
                          <div
                            className={`professor-message-row ${
                              mine
                                ? "mine"
                                : "student"
                            } ${firstInGroup ? "first" : ""}`}
                          >

                            <div className="professor-message-bubble">

                              <p>
                                {
                                  message.message
                                }
                              </p>

                              <small>
                                {
                                  formatTime(
                                    message.created_at
                                  )
                                }
                              </small>

                            </div>

                          </div>
                          </Fragment>

                        );

                      }
                    )

                  )}


                  <div
                    ref={
                      bottomRef
                    }
                  />

                </div>


                {/* MESSAGE INPUT */}

                <form
                  className="professor-chat-input"
                  onSubmit={
                    sendMessage
                  }
                >

                  <input
                    type="text"
                    value={
                      messageText
                    }
                    onChange={(event) =>
                      setMessageText(
                        event.target.value
                      )
                    }
                    placeholder="Type a message..."
                    maxLength={2000}
                  />


                  <button
                    type="submit"
                    disabled={
                      sending ||
                      !messageText.trim()
                    }
                  >

                    <Send
                      size={17}
                    />

                    {sending
                      ? "Sending..."
                      : "Send"}

                  </button>

                </form>

              </section>

            </div>

          )}

        </div>

      </main>

    </div>
  );
}


export default ProfessorChat;