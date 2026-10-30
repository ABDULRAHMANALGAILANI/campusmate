import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  Search,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Clock3,
  X,
} from "lucide-react";

import {
  supabase,
} from "../lib/supabase";

import { currentClassIds } from "../lib/classes";

import Sidebar
  from "../components/Sidebar";

import NotificationBell
  from "../components/NotificationBell";

import UserAvatar
  from "../components/UserAvatar";


import "./Dashboard.css";
import "./Calendar.css";


const WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];


const CALENDAR_FILTERS = [
  {
    key: "all",
    label: "All Events",
  },
  {
    key: "assignment",
    label: "Assignment",
  },
  {
    key: "exam",
    label: "Exam",
  },
  {
    key: "project",
    label: "Project",
  },
  {
    key: "meeting",
    label: "Meeting",
  },
  {
    key: "general",
    label: "General",
  },
  {
    key: "class",
    label: "Classes",
  },
];


// Everything your professors scheduled in your classes.
// Tables from newer SQL files that aren't there yet just
// come back empty.
async function loadClassItems(userId) {
  const { data: memberships } =
    await supabase
      .from("course_group_members")
      .select("group_id")
      .eq("student_id", userId)
      .eq("status", "active");

  // Past-semester (archived) classes are left out
  const groupIds =
    await currentClassIds((memberships || []).map((row) => row.group_id));

  if (groupIds.length === 0) {
    return { assignments: [], quizzes: [], meetings: [], groups: [] };
  }

  const [groups, assignments, quizzes, meetings] =
    await Promise.all([
      supabase.from("course_groups").select("id, name, course_code").in("id", groupIds),
      supabase.from("class_assignments").select("*").in("group_id", groupIds),
      supabase
        .from("quizzes")
        .select("id, group_id, title, closes_at, opens_at, is_published")
        .in("group_id", groupIds)
        .eq("is_published", true),
      supabase.from("class_meetings").select("*").in("group_id", groupIds),
    ]);

  return {
    groups: groups.data || [],
    assignments: assignments.data || [],
    quizzes: quizzes.error ? [] : quizzes.data || [],
    meetings: meetings.error ? [] : meetings.data || [],
  };
}


function shortClock(value) {
  if (!value) return "";
  const [hours, minutes] = String(value).split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 === 0 ? 12 : hours % 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}


function Calendar() {
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
    customEvents,
    setCustomEvents,
  ] = useState([]);


  // Deadlines, exams, quizzes and weekly class times from
  // the classes you're in (set by your professors)
  const [
    classItems,
    setClassItems,
  ] = useState({
    assignments: [],
    quizzes: [],
    meetings: [],
    groups: [],
  });


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    message,
    setMessage,
  ] = useState("");


  // =========================================================
  // ADD EVENT FORM
  // =========================================================

  const [
    showForm,
    setShowForm,
  ] = useState(false);


  const [
    title,
    setTitle,
  ] = useState("");


  const [
    eventDate,
    setEventDate,
  ] = useState("");


  const [
    eventType,
    setEventType,
  ] = useState(
    "general"
  );


  const [
    description,
    setDescription,
  ] = useState("");


  // =========================================================
  // FILTERS
  // =========================================================

  const [
    activeFilter,
    setActiveFilter,
  ] = useState(
    "all"
  );


  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");


  // =========================================================
  // CURRENT MONTH
  // =========================================================

  const [
    currentMonth,
    setCurrentMonth,
  ] = useState(
    new Date(
      new Date()
        .getFullYear(),

      new Date()
        .getMonth(),

      1
    )
  );


  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadCalendar();
  }, []);


  // =========================================================
  // DATE HELPERS
  // =========================================================

  function dateKey(
    value
  ) {
    if (!value) {
      return "";
    }


    return String(
      value
    ).slice(
      0,
      10
    );
  }


  function parseDate(
    value
  ) {
    const key =
      dateKey(
        value
      );


    if (!key) {
      return null;
    }


    const [
      year,
      month,
      day,
    ] =
      key
        .split("-")
        .map(Number);


    if (
      !year ||
      !month ||
      !day
    ) {
      return null;
    }


    return new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0
    );
  }


  function toDateKey(
    date
  ) {
    const year =
      date
        .getFullYear();


    const month =
      String(
        date
          .getMonth() +
        1
      ).padStart(
        2,
        "0"
      );


    const day =
      String(
        date
          .getDate()
      ).padStart(
        2,
        "0"
      );


    return (
      `${year}-${month}-${day}`
    );
  }


  function formatShortDate(
    value
  ) {
    const date =
      parseDate(
        value
      );


    if (!date) {
      return "-";
    }


    return date
      .toLocaleDateString(
        "en-GB",
        {
          day:
            "2-digit",

          month:
            "short",

          year:
            "numeric",
        }
      );
  }


  function formatMonthShort(
    value
  ) {
    const date =
      parseDate(
        value
      );


    if (!date) {
      return "";
    }


    return date
      .toLocaleDateString(
        "en-US",
        {
          month:
            "short",
        }
      )
      .toUpperCase();
  }


  function formatDayNumber(
    value
  ) {
    const date =
      parseDate(
        value
      );


    if (!date) {
      return "";
    }


    return String(
      date
        .getDate()
    ).padStart(
      2,
      "0"
    );
  }


  // =========================================================
  // LOAD CALENDAR
  // =========================================================

  async function loadCalendar() {
    setLoading(
      true
    );

    setMessage(
      ""
    );


    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth
        .getUser();


    if (
      userError ||
      !user
    ) {
      navigate(
        "/"
      );

      return;
    }


    // =======================================================
    // PROFILE
    // =======================================================

    const {
      data:
        profileData,
      error:
        profileError,
    } =
      await supabase
        .from(
          "profiles"
        )
        .select("*")
        .eq(
          "id",
          user.id
        )
        .maybeSingle();


    if (
      profileError
    ) {
      console.error(
        "Calendar profile error:",
        profileError
      );
    }


    setProfile(
      profileData ||
      null
    );


    // =======================================================
    // ASSIGNMENTS
    // =======================================================

    const {
      data:
        assignmentData,

      error:
        assignmentError,
    } =
      await supabase
        .from(
          "assignments"
        )
        .select("*")
        .eq(
          "user_id",
          user.id
        )
        .order(
          "due_date",
          {
            ascending:
              true,
          }
        );


    if (
      assignmentError
    ) {
      console.error(
        "Calendar assignment error:",
        assignmentError
      );
    }


    setAssignments(
      assignmentData ||
      []
    );


    // =======================================================
    // CUSTOM EVENTS
    // =======================================================

    const {
      data:
        eventData,

      error:
        eventError,
    } =
      await supabase
        .from(
          "calendar_events"
        )
        .select("*")
        .eq(
          "user_id",
          user.id
        )
        .order(
          "event_date",
          {
            ascending:
              true,
          }
        );


    if (
      eventError
    ) {
      console.error(
        "Calendar event error:",
        eventError
      );


      setMessage(
        "Could not load calendar events: " +
        eventError.message
      );
    }


    setCustomEvents(
      eventData ||
      []
    );


    // =======================================================
    // CLASS DEADLINES, EXAMS, QUIZZES, CLASS TIMES
    // =======================================================

    setClassItems(
      await loadClassItems(
        user.id
      )
    );


    setLoading(
      false
    );
  }


  // =========================================================
  // ADD EVENT
  // =========================================================

  async function addEvent(
    event
  ) {
    event.preventDefault();


    setMessage(
      ""
    );


    if (
      !title.trim() ||
      !eventDate
    ) {
      setMessage(
        "Please enter an event title and date."
      );

      return;
    }


    const {
      data: {
        user,
      },
    } =
      await supabase.auth
        .getUser();


    if (!user) {
      navigate(
        "/"
      );

      return;
    }


    const {
      error,
    } =
      await supabase
        .from(
          "calendar_events"
        )
        .insert({
          user_id:
            user.id,

          title:
            title.trim(),

          event_date:
            eventDate,

          event_type:
            eventType,

          description:
            description.trim(),
        });


    if (error) {
      console.error(
        "Add calendar event error:",
        error
      );


      setMessage(
        "Could not add event: " +
        error.message
      );

      return;
    }


    setTitle(
      ""
    );

    setEventDate(
      ""
    );

    setEventType(
      "general"
    );

    setDescription(
      ""
    );

    setShowForm(
      false
    );


    setMessage(
      "Event added successfully."
    );


    await loadCalendar();
  }


  // =========================================================
  // DELETE EVENT
  // =========================================================

  async function deleteEvent(
    id
  ) {
    const confirmed =
      window.confirm(
        "Delete this calendar event?"
      );


    if (
      !confirmed
    ) {
      return;
    }


    const {
      error,
    } =
      await supabase
        .from(
          "calendar_events"
        )
        .delete()
        .eq(
          "id",
          id
        );


    if (error) {
      setMessage(
        "Could not delete event: " +
        error.message
      );

      return;
    }


    setMessage(
      "Event deleted."
    );


    await loadCalendar();
  }


  // =========================================================
  // ALL EVENTS
  // =========================================================

  const allEvents =
    useMemo(
      () => {
        const assignmentEvents =
          assignments
            .filter(
              (
                assignment
              ) =>
                assignment
                  .due_date
            )
            .map(
              (
                assignment
              ) => ({
                id:
                  `assignment-${assignment.id}`,

                title:
                  assignment.title,

                date:
                  dateKey(
                    assignment
                      .due_date
                  ),

                type:
                  "assignment",

                description:
                  assignment
                    .subject ||
                  "Assignment",

                source:
                  "assignment",

                originalId:
                  assignment.id,
              })
            );


        const calendarEvents =
          customEvents
            .map(
              (
                event
              ) => ({
                id:
                  `event-${event.id}`,

                title:
                  event.title,

                date:
                  dateKey(
                    event
                      .event_date
                  ),

                type:
                  event
                    .event_type ||
                  "general",

                description:
                  event
                    .description ||
                  "",

                source:
                  "custom",

                originalId:
                  event.id,
              })
            );


        // ---------- From your classes ----------

        const groupLabel =
          (groupId) => {
            const group =
              classItems.groups.find(
                (item) =>
                  item.id === groupId
              );

            return (
              group?.course_code ||
              group?.name ||
              "Class"
            );
          };

        const timeOf =
          (value) =>
            new Date(value).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            });

        const classWorkEvents =
          classItems.assignments
            .filter(
              (work) =>
                work.due_at
            )
            .map((work) => ({
              id: `class-work-${work.id}`,
              title: work.title,
              date: dateKey(work.due_at),
              type: work.hand_in === false ? "exam" : "assignment",
              description:
                `${groupLabel(work.group_id)} · ${work.hand_in === false ? "" : "due "}${timeOf(work.due_at)}`,
              source: "class",
              originalId: work.id,
            }));

        const quizEvents =
          classItems.quizzes
            .filter(
              (quiz) =>
                quiz.closes_at
            )
            .map((quiz) => ({
              id: `quiz-${quiz.id}`,
              title: `Quiz: ${quiz.title}`,
              date: dateKey(quiz.closes_at),
              type: "exam",
              description: `${groupLabel(quiz.group_id)} · closes ${timeOf(quiz.closes_at)}`,
              source: "class",
              originalId: quiz.id,
            }));

        // Weekly class times: shown for this month (+ a week either side)
        const meetingEvents =
          [];

        const from =
          new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth(),
            1 - 7
          );

        const until =
          new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth() + 1,
            7
          );

        for (
          const day = new Date(from);
          day <= until;
          day.setDate(day.getDate() + 1)
        ) {
          // JS: Sunday = 0. Timetable: Monday = 1 ... Sunday = 7
          const weekday =
            day.getDay() === 0 ? 7 : day.getDay();

          for (const meeting of classItems.meetings) {
            if (meeting.day_of_week !== weekday) continue;

            meetingEvents.push({
              id: `meeting-${meeting.id}-${toDateKey(day)}`,
              title: `${groupLabel(meeting.group_id)} ${meeting.kind}`,
              date: toDateKey(day),
              type: "class",
              description:
                `${shortClock(meeting.starts_at)} – ${shortClock(meeting.ends_at)}${meeting.room ? ` · ${meeting.room}` : ""}`,
              source: "class",
              originalId: meeting.id,
            });
          }
        }

        return [
          ...assignmentEvents,
          ...calendarEvents,
          ...classWorkEvents,
          ...quizEvents,
          ...meetingEvents,
        ];
      },
      [
        assignments,
        customEvents,
        classItems,
        currentMonth,
      ]
    );


  // =========================================================
  // FILTERED EVENTS
  // =========================================================

  const visibleEvents =
    useMemo(
      () => {
        const query =
          searchQuery
            .trim()
            .toLowerCase();


        return allEvents
          .filter(
            (
              event
            ) => {
              const matchesType =
                activeFilter ===
                  "all" ||
                event.type ===
                  activeFilter;


              const matchesSearch =
                !query ||

                event.title
                  ?.toLowerCase()
                  .includes(
                    query
                  ) ||

                event.description
                  ?.toLowerCase()
                  .includes(
                    query
                  ) ||

                event.type
                  ?.toLowerCase()
                  .includes(
                    query
                  );


              return (
                matchesType &&
                matchesSearch
              );
            }
          );
      },
      [
        allEvents,
        activeFilter,
        searchQuery,
      ]
    );


  // =========================================================
  // CALENDAR GRID
  // =========================================================

  const calendarDays =
    useMemo(
      () => {
        const year =
          currentMonth
            .getFullYear();


        const month =
          currentMonth
            .getMonth();


        const firstDay =
          new Date(
            year,
            month,
            1
          ).getDay();


        const daysInMonth =
          new Date(
            year,
            month + 1,
            0
          ).getDate();


        const cells =
          [];


        for (
          let i = 0;
          i < firstDay;
          i += 1
        ) {
          cells.push(
            null
          );
        }


        for (
          let day = 1;
          day <=
            daysInMonth;
          day += 1
        ) {
          cells.push(
            new Date(
              year,
              month,
              day
            )
          );
        }


        while (
          cells.length %
            7 !==
          0
        ) {
          cells.push(
            null
          );
        }


        return cells;
      },
      [
        currentMonth,
      ]
    );


  // =========================================================
  // EVENTS FOR DATE
  // =========================================================

  function eventsForDate(
    date
  ) {
    if (!date) {
      return [];
    }


    const key =
      toDateKey(
        date
      );


    return visibleEvents
      .filter(
        (
          event
        ) =>
          event.date ===
          key
      );
  }


  // =========================================================
  // UPCOMING EVENTS
  // =========================================================

  const upcomingEvents =
    useMemo(
      () => {
        const today =
          new Date();


        today.setHours(
          0,
          0,
          0,
          0
        );


        return visibleEvents
          .filter(
            (
              event
            ) =>
              event.type !== "class"
          )
          .filter(
            (
              event
            ) => {
              const eventDateValue =
                parseDate(
                  event.date
                );


              if (
                !eventDateValue
              ) {
                return false;
              }


              eventDateValue
                .setHours(
                  0,
                  0,
                  0,
                  0
                );


              return (
                eventDateValue >=
                today
              );
            }
          )
          .sort(
            (
              first,
              second
            ) => {
              const firstDate =
                parseDate(
                  first.date
                );


              const secondDate =
                parseDate(
                  second.date
                );


              return (
                firstDate -
                secondDate
              );
            }
          )
          .slice(
            0,
            8
          );
      },
      [
        visibleEvents,
      ]
    );


  // =========================================================
  // MONTH NAVIGATION
  // =========================================================

  function previousMonth() {
    setCurrentMonth(
      new Date(
        currentMonth
          .getFullYear(),

        currentMonth
          .getMonth() -
          1,

        1
      )
    );
  }


  function nextMonth() {
    setCurrentMonth(
      new Date(
        currentMonth
          .getFullYear(),

        currentMonth
          .getMonth() +
          1,

        1
      )
    );
  }


  function goToToday() {
    const today =
      new Date();


    setCurrentMonth(
      new Date(
        today
          .getFullYear(),

        today
          .getMonth(),

        1
      )
    );
  }


  // =========================================================
  // TODAY
  // =========================================================

  function isToday(
    date
  ) {
    if (!date) {
      return false;
    }


    const today =
      new Date();


    return (
      date
        .getFullYear() ===
        today
          .getFullYear() &&

      date
        .getMonth() ===
        today
          .getMonth() &&

      date
        .getDate() ===
        today
          .getDate()
    );
  }


  // =========================================================
  // CLICK CALENDAR DAY
  // =========================================================

  function openDate(
    date
  ) {
    if (!date) {
      return;
    }


    setEventDate(
      toDateKey(
        date
      )
    );


    setShowForm(
      true
    );
  }


  // =========================================================
  // PROFILE
  // =========================================================

  const displayName =
    profile
      ?.full_name ||
    "Student";


  const programme =
    profile
      ?.programme ||
    "Student";


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

          <div className="search-box">

            <Search
              size={18}
            />


            <input
              type="text"
              value={
                searchQuery
              }
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
                )
              }
              placeholder="Search calendar, assignments, events..."
            />

          </div>


          <div className="topbar-right">

            <NotificationBell />


            <UserAvatar
              profile={
                profile
              }
              name={
                displayName
              }
              size={42}
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
            CALENDAR CONTENT
        ==================================================== */}

        <div className="calendar-content">

          {/* =================================================
              PAGE HEADER
          ================================================== */}

          {/* Calendar + Study Planner = Schedule */}

          <div className="calendar-page-header">

            <div>

              <h1>
                Calendar
              </h1>


              <p>
                Plan your assignments, exams,
                projects and important events.
              </p>

            </div>


            <button
              type="button"
              className="calendar-add-btn"
              onClick={() => {
                setEventDate(
                  ""
                );

                setShowForm(
                  true
                );
              }}
            >

              <Plus
                size={18}
              />

              Add Event

            </button>

          </div>


          {/* =================================================
              MESSAGE
          ================================================== */}

          {message && (

            <div className="calendar-message">

              {message}

            </div>

          )}


          {/* =================================================
              ADD EVENT FORM
          ================================================== */}

          {showForm && (

            <section className="calendar-form-card">

              <div className="calendar-form-header">

                <div>

                  <h2>
                    Add New Event
                  </h2>

                  <p>
                    Add an exam, meeting, project deadline or personal event.
                  </p>

                </div>


                <button
                  type="button"
                  className="calendar-form-close"
                  onClick={() =>
                    setShowForm(
                      false
                    )
                  }
                >

                  <X
                    size={19}
                  />

                </button>

              </div>


              <form
                className="calendar-form"
                onSubmit={
                  addEvent
                }
              >

                <div className="calendar-field">

                  <label>
                    Event Title
                  </label>


                  <input
                    type="text"
                    value={
                      title
                    }
                    onChange={(event) =>
                      setTitle(
                        event.target.value
                      )
                    }
                    placeholder="Example: FYP Meeting"
                    required
                  />

                </div>


                <div className="calendar-field">

                  <label>
                    Date
                  </label>


                  <input
                    type="date"
                    value={
                      eventDate
                    }
                    onChange={(event) =>
                      setEventDate(
                        event.target.value
                      )
                    }
                    required
                  />

                </div>


                <div className="calendar-field">

                  <label>
                    Event Type
                  </label>


                  <select
                    value={
                      eventType
                    }
                    onChange={(event) =>
                      setEventType(
                        event.target.value
                      )
                    }
                  >

                    <option value="general">
                      General
                    </option>

                    <option value="meeting">
                      Meeting
                    </option>

                    <option value="exam">
                      Exam
                    </option>

                    <option value="project">
                      Project
                    </option>

                  </select>

                </div>


                <div className="calendar-field calendar-full">

                  <label>
                    Description
                  </label>


                  <textarea
                    rows={4}
                    value={
                      description
                    }
                    onChange={(event) =>
                      setDescription(
                        event.target.value
                      )
                    }
                    placeholder="Optional event details..."
                  />

                </div>


                <button
                  type="submit"
                  className="calendar-save-btn calendar-full"
                >

                  <Plus
                    size={17}
                  />

                  Save Event

                </button>

              </form>

            </section>

          )}


          {/* =================================================
              CALENDAR LAYOUT
          ================================================== */}

          <div className="calendar-layout">

            {/* ===============================================
                MAIN CALENDAR
            ================================================ */}

            <section className="calendar-card">

              {/* MONTH NAVIGATION */}

              <div className="calendar-month-header">

                <div className="calendar-month-navigation">

                  <button
                    type="button"
                    onClick={
                      previousMonth
                    }
                    aria-label="Previous month"
                  >

                    <ChevronLeft
                      size={20}
                    />

                  </button>


                  <h2>

                    {currentMonth
                      .toLocaleDateString(
                        "en-GB",
                        {
                          month:
                            "long",

                          year:
                            "numeric",
                        }
                      )}

                  </h2>


                  <button
                    type="button"
                    onClick={
                      nextMonth
                    }
                    aria-label="Next month"
                  >

                    <ChevronRight
                      size={20}
                    />

                  </button>

                </div>


                <button
                  type="button"
                  className="calendar-today-btn"
                  onClick={
                    goToToday
                  }
                >
                  Today
                </button>

              </div>


              {/* =============================================
                  FILTER CHIPS
              ============================================== */}

              <div className="calendar-filter-row">

                {CALENDAR_FILTERS
                  .map(
                    (
                      filter
                    ) => (

                      <button
                        type="button"
                        key={
                          filter.key
                        }
                        className={`calendar-filter-chip ${filter.key} ${
                          activeFilter ===
                          filter.key
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setActiveFilter(
                            filter.key
                          )
                        }
                      >

                        <span className="calendar-filter-dot" />

                        {filter.label}

                      </button>

                    )
                  )}

              </div>


              {/* =============================================
                  WEEKDAYS
              ============================================== */}

              <div className="calendar-weekdays">

                {WEEKDAYS.map(
                  (
                    day
                  ) => (

                    <div
                      key={
                        day
                      }
                    >
                      {day}
                    </div>

                  )
                )}

              </div>


              {/* =============================================
                  DAYS
              ============================================== */}

              <div className="calendar-grid">

                {calendarDays.map(
                  (
                    date,
                    index
                  ) => {

                    if (
                      !date
                    ) {
                      return (

                        <div
                          key={
                            `empty-${index}`
                          }
                          className="calendar-day empty"
                        />

                      );
                    }


                    const dayEvents =
                      eventsForDate(
                        date
                      );


                    return (

                      <div
                        key={
                          toDateKey(
                            date
                          )
                        }
                        className={`calendar-day ${
                          isToday(
                            date
                          )
                            ? "today"
                            : ""
                        }`}
                        onClick={() =>
                          openDate(
                            date
                          )
                        }
                        title="Click to add an event"
                      >

                        <div className="calendar-day-number">

                          <span>
                            {date
                              .getDate()}
                          </span>

                        </div>


                        <div className="calendar-day-events">

                          {dayEvents
                            .slice(
                              0,
                              3
                            )
                            .map(
                              (
                                event
                              ) => (

                                <div
                                  key={
                                    event.id
                                  }
                                  className={`calendar-event ${event.type}`}
                                  title={
                                    event.title
                                  }
                                >

                                  <span>
                                    {event.title}
                                  </span>

                                </div>

                              )
                            )}


                          {dayEvents.length >
                            3 && (

                            <small className="calendar-more">

                              +
                              {
                                dayEvents.length -
                                3
                              }{" "}
                              more

                            </small>

                          )}

                        </div>

                      </div>

                    );
                  }
                )}

              </div>

            </section>


            {/* ===============================================
                UPCOMING EVENTS
            ================================================ */}

            <aside className="calendar-upcoming-card">

              <div className="calendar-card-header">

                <h2>

                  <CalendarDays
                    size={19}
                  />

                  Upcoming Events

                </h2>

              </div>


              {loading ? (

                <div className="calendar-empty">

                  <CalendarDays
                    size={40}
                  />

                  <p>
                    Loading events...
                  </p>

                </div>

              ) : upcomingEvents.length ===
                0 ? (

                <div className="calendar-empty">

                  <CalendarDays
                    size={46}
                  />

                  <h3>
                    No upcoming events
                  </h3>

                  <p>
                    Enjoy your free time!
                  </p>

                </div>

              ) : (

                <div className="calendar-upcoming-list">

                  {upcomingEvents.map(
                    (
                      event
                    ) => (

                      <div
                        key={
                          event.id
                        }
                        className="calendar-upcoming-item"
                      >

                        {/* DATE */}

                        <div className="calendar-upcoming-datebox">

                          <span>
                            {formatMonthShort(
                              event.date
                            )}
                          </span>


                          <strong>
                            {formatDayNumber(
                              event.date
                            )}
                          </strong>

                        </div>


                        {/* EVENT INFO */}

                        <div className="calendar-upcoming-main">

                          <strong>
                            {event.title}
                          </strong>


                          <div className="calendar-upcoming-meta">

                            <span
                              className={`calendar-upcoming-type ${event.type}`}
                            >

                              <i />

                              {event.type}

                            </span>


                            <span>

                              <Clock3
                                size={12}
                              />

                              {formatShortDate(
                                event.date
                              )}

                            </span>

                          </div>


                          {event.description && (

                            <small>

                              {event.description}

                            </small>

                          )}

                        </div>


                        {/* DELETE CUSTOM EVENTS ONLY */}

                        {event.source ===
                          "custom" && (

                          <button
                            type="button"
                            className="calendar-delete-btn"
                            onClick={() =>
                              deleteEvent(
                                event.originalId
                              )
                            }
                            title="Delete event"
                          >

                            <Trash2
                              size={15}
                            />

                          </button>

                        )}

                      </div>

                    )
                  )}

                </div>

              )}

            </aside>

          </div>

        </div>

      </main>

    </div>
  );
}


export default Calendar;