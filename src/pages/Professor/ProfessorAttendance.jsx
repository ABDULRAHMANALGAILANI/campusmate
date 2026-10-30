import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarCheck,
  Check,
  CheckCircle2,
  QrCode,
  RefreshCw,
  GraduationCap,
  Play,
  Search,
  Square,
  Users,
  X,
} from "lucide-react";

import {
  QRCodeSVG,
} from "qrcode.react";

import {
  supabase,
} from "../../lib/supabase";

import { loadTeachingClasses } from "../../lib/classes";

import ProfessorSidebar
  from "../../components/ProfessorSidebar";

import NotificationBell
  from "../../components/NotificationBell";

import "./ProfessorDashboard.css";
import "./ProfessorAttendance.css";
import UserAvatar
  from "../../components/UserAvatar";

function ProfessorAttendance() {
  const [
    , // current user value is not needed here
    setCurrentUser,
  ] = useState(null);


  const [
    profile,
    setProfile,
  ] = useState(null);


  const [
    classes,
    setClasses,
  ] = useState([]);


  const [
    selectedClassId,
    setSelectedClassId,
  ] = useState("");


  const [
    session,
    setSession,
  ] = useState(null);


  const [
    records,
    setRecords,
  ] = useState([]);


  const [
    studentProfiles,
    setStudentProfiles,
  ] = useState([]);


  const [
    search,
    setSearch,
  ] = useState("");


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    starting,
    setStarting,
  ] = useState(false);


  const [
    closing,
    setClosing,
  ] = useState(false);


  const [
    updatingStudent,
    setUpdatingStudent,
  ] = useState(null);


  const [
    message,
    setMessage,
  ] = useState("");


  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  useEffect(() => {
    loadPage();
  }, []);


  useEffect(() => {
    if (!selectedClassId) {
      return;
    }

    loadActiveSession(
      selectedClassId
    );
  }, [selectedClassId]);


  useEffect(() => {
    if (!session?.id) {
      return;
    }


    const channel =
      supabase
        .channel(
          `attendance-${session.id}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "attendance_records",

            filter:
              `session_id=eq.${session.id}`,
          },
          () => {
            loadSessionRecords(
              session.id
            );
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table:
              "attendance_sessions",

            filter:
              `id=eq.${session.id}`,
          },
          () => {
            loadActiveSession(
              selectedClassId
            );
          }
        )
        .subscribe();


    return () => {
      supabase.removeChannel(
        channel
      );
    };

  }, [
    session?.id,
    selectedClassId,
  ]);


  async function loadPage() {
    setLoading(true);


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


    setCurrentUser(
      user
    );


    const {
      data: profileData,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          campus_id,
          role
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


    setProfile(
      profileData
    );


    // Own classes + classes you co-teach (co-lecturer / tutor)
    const classData =
      await loadTeachingClasses(
        user.id
      );


    const loadedClasses =
      classData || [];


    setClasses(
      loadedClasses
    );


    // Opened from a course page: ?class=<id>
    const wanted =
      new URLSearchParams(
        window.location.search
      ).get("class");

    if (
      loadedClasses.length >
        0
    ) {
      setSelectedClassId(
        loadedClasses.some(
          (group) =>
            group.id === wanted
        )
          ? wanted
          : loadedClasses[0].id
      );
    }


    setLoading(false);
  }


  async function loadActiveSession(
    groupId
  ) {
    const now =
      new Date()
        .toISOString();


    const {
      data,
      error,
    } =
      await supabase
        .from(
          "attendance_sessions"
        )
        .select("*")
        .eq(
          "group_id",
          groupId
        )
        .eq(
          "is_active",
          true
        )
        .is(
          "closed_at",
          null
        )
        .gt(
          "expires_at",
          now
        )
        .order(
          "started_at",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();


    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }


    setSession(
      data || null
    );


    if (data) {
      await loadSessionRecords(
        data.id
      );
    } else {
      setRecords([]);
      setStudentProfiles([]);
    }
  }


  async function loadSessionRecords(
    sessionId
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "attendance_records"
        )
        .select("*")
        .eq(
          "session_id",
          sessionId
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


    const loadedRecords =
      data || [];


    setRecords(
      loadedRecords
    );


    const studentIds =
      loadedRecords.map(
        (record) =>
          record.student_id
      );


    if (
      studentIds.length ===
        0
    ) {
      setStudentProfiles([]);

      return;
    }


    const {
      data: studentData,
      error: studentError,
    } =
      await supabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          campus_id,
          programme
          `
        )
        .in(
          "id",
          studentIds
        );


    if (studentError) {
      setErrorMessage(
        studentError.message
      );

      return;
    }


    setStudentProfiles(
      studentData || []
    );
  }


  async function startAttendance() {
    if (!selectedClassId) {
      return;
    }


    setStarting(true);

    setMessage("");
    setErrorMessage("");


    const {
      error,
    } =
      // Stays open until the professor closes it.
      await supabase.rpc(
        "start_attendance_open",
        {
          input_group_id:
            selectedClassId,
        }
      );


    if (error) {
      setErrorMessage(
        error.message
      );

      setStarting(false);

      return;
    }


    await loadActiveSession(
      selectedClassId
    );


    setMessage(
      "Attendance started. Click Generate QR when students are ready to scan."
    );


    setStarting(false);
  }


  async function closeAttendance() {
    if (!session) {
      return;
    }


    setClosing(true);


    const {
      error,
    } =
      await supabase.rpc(
        "close_attendance_session",
        {
          input_session_id:
            session.id,
        }
      );


    if (error) {
      setErrorMessage(
        error.message
      );

      setClosing(false);

      return;
    }


    setSession(null);
    setRecords([]);
    setStudentProfiles([]);

    setMessage(
      "Attendance session closed."
    );


    setClosing(false);
  }


  async function updateStatus(
    studentId,
    status
  ) {
    if (!session) {
      return;
    }


    setUpdatingStudent(
      studentId
    );


    const {
      error,
    } =
      await supabase.rpc(
        "professor_set_attendance_status",
        {
          input_session_id:
            session.id,

          input_student_id:
            studentId,

          input_status:
            status,
        }
      );


    if (error) {
      setErrorMessage(
        error.message
      );

      setUpdatingStudent(
        null
      );

      return;
    }


    await loadSessionRecords(
      session.id
    );


    setUpdatingStudent(
      null
    );
  }


  function getStudent(
    studentId
  ) {
    return studentProfiles.find(
      (student) =>
        student.id ===
        studentId
    );
  }


  const selectedClass =
    classes.find(
      (item) =>
        item.id ===
        selectedClassId
    );


  const presentCount =
    records.filter(
      (record) =>
        record.status ===
        "present"
    ).length;


  const absentCount =
    records.filter(
      (record) =>
        record.status ===
        "absent"
    ).length;


  const filteredRecords =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();


        if (!query) {
          return records;
        }


        return records.filter(
          (record) => {
            const student =
              studentProfiles.find(
                (item) =>
                  item.id ===
                  record.student_id
              );


            return (
              student?.full_name
                ?.toLowerCase()
                .includes(query) ||
              student?.campus_id
                ?.toLowerCase()
                .includes(query)
            );
          }
        );
      },
      [
        records,
        studentProfiles,
        search,
      ]
    );


  // =========================================================
  // QR CODE (professor generates it, works for 30 seconds)
  // supabase/10-attendance-qr.sql
  // =========================================================

  const [
    qrCode,
    setQrCode,
  ] = useState(null);

  const [
    qrSecondsLeft,
    setQrSecondsLeft,
  ] = useState(0);

  const [
    generatingQr,
    setGeneratingQr,
  ] = useState(false);


  // A new session (or a closed one) starts with no QR.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQrCode(null);
  }, [session?.id]);


  // 30, 29, 28 ... 0
  useEffect(() => {
    if (!qrCode) {
      return undefined;
    }

    function tick() {
      setQrSecondsLeft(
        Math.max(
          0,
          Math.ceil((qrCode.endsAt - Date.now()) / 1000)
        )
      );
    }

    tick();

    const timer =
      window.setInterval(tick, 250);

    return () =>
      window.clearInterval(timer);
  }, [qrCode]);


  async function generateQr() {
    if (!session) {
      return;
    }

    setGeneratingQr(true);
    setErrorMessage("");

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "generate_attendance_qr",
        {
          input_session_id:
            session.id,
        }
      );

    setGeneratingQr(false);

    const row =
      data?.[0];

    if (error || !row?.code) {
      setErrorMessage(
        error?.message ||
        "Couldn't generate a QR code. Try again."
      );
      return;
    }

    // Count down from what the server says, so a wrong
    // laptop clock doesn't matter.
    setQrCode({
      code: row.code,
      endsAt: Date.now() + (row.seconds || 30) * 1000,
    });
  }


  const qrActive =
    Boolean(qrCode) && qrSecondsLeft > 0;

  const qrUrl =
    qrCode
      ? `${window.location.origin}/attendance/check-in/${qrCode.code}`
      : "";


  const professorName =
    profile?.full_name ||
    "Professor";


  if (loading) {
    return (
      <div className="prof-att-loading">

        <CalendarCheck
          size={46}
        />

        <p>
          Loading attendance...
        </p>

      </div>
    );
  }


  return (
    <div className="professor-dashboard-page">

      <ProfessorSidebar />


      <main className="professor-main">

        <header className="professor-topbar">

          <div className="prof-att-top-title">

            <CalendarCheck
              size={20}
            />

            Attendance

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


        <div className="prof-att-content">

          <div className="prof-att-header">

            <div>

              <h1>
                Attendance
              </h1>

              <p>
                Start a secure attendance session for one of your classes.
              </p>

            </div>

          </div>


          {message && (

            <div className="prof-att-success">

              <CheckCircle2
                size={17}
              />

              {message}

            </div>

          )}


          {errorMessage && (

            <div className="prof-att-error">

              {errorMessage}

            </div>

          )}


          {classes.length === 0 ? (

            <div className="prof-att-empty">

              <GraduationCap
                size={45}
              />

              <h2>
                No classes found
              </h2>

              <p>
                Create a class first before taking attendance.
              </p>

            </div>

          ) : (

            <>
              <section className="prof-att-control-card">

                <div className="prof-att-class-field">

                  <label>
                    Class
                  </label>


                  <select
                    value={
                      selectedClassId
                    }
                    onChange={(event) =>
                      setSelectedClassId(
                        event.target.value
                      )
                    }
                  >

                    {classes.map(
                      (item) => (

                        <option
                          key={
                            item.id
                          }
                          value={
                            item.id
                          }
                        >

                          {item.course_code
                            ? `${item.course_code} — ${item.name}`
                            : item.name}

                        </option>

                      )
                    )}

                  </select>

                </div>


                {!session && (

                  <>
                    <button
                      type="button"
                      className="prof-att-start"
                      onClick={
                        startAttendance
                      }
                      disabled={
                        starting
                      }
                    >

                      <Play
                        size={17}
                      />

                      {starting
                        ? "Starting..."
                        : "Start Attendance"}

                    </button>

                  </>

                )}

              </section>


              {session && (

                <>
                  <section className="prof-att-session">

                    <div className="prof-att-qr-card">

                      {qrActive ? (
                        <>
                          <div className="prof-att-qr">

                            <QRCodeSVG
                              value={
                                qrUrl
                              }
                              size={210}
                              level="H"
                              includeMargin
                            />

                          </div>

                          <div
                            className={`prof-att-qr-timer ${qrSecondsLeft <= 10 ? "ending" : ""}`}
                            role="timer"
                            aria-live="off"
                          >
                            <strong>{qrSecondsLeft}s</strong>
                            <span>left to scan</span>
                          </div>

                          <div
                            className="prof-att-qr-bar"
                            aria-hidden="true"
                          >
                            <span
                              style={{
                                width: `${(qrSecondsLeft / 30) * 100}%`,
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="prof-att-qr-empty">

                          <QrCode
                            size={54}
                            aria-hidden="true"
                          />

                          <strong>
                            {qrCode
                              ? "QR code expired"
                              : "No QR code yet"}
                          </strong>

                          <span>
                            {qrCode
                              ? "Generate a new one for students who haven't scanned."
                              : "Generate one when your students are ready."}
                          </span>

                        </div>
                      )}


                      <button
                        type="button"
                        className="prof-att-generate"
                        onClick={
                          generateQr
                        }
                        disabled={
                          generatingQr
                        }
                      >

                        {qrActive ? (
                          <RefreshCw
                            size={16}
                          />
                        ) : (
                          <QrCode
                            size={16}
                          />
                        )}

                        {generatingQr
                          ? "Generating..."
                          : qrActive
                            ? "Generate new QR"
                            : "Generate QR"}

                      </button>


                      <p>
                        Each QR works for 30 seconds. Students scan it with their phone camera while signed in to CampusMate.
                      </p>

                    </div>


                    <div className="prof-att-session-info">

                      <span className="prof-att-live">
                        ● LIVE
                      </span>


                      <h2>
                        {selectedClass?.name}
                      </h2>


                      <p className="prof-att-open-note">
                        Attendance is open until you close it.
                      </p>


                      <button
                        type="button"
                        className="prof-att-close"
                        onClick={
                          closeAttendance
                        }
                        disabled={
                          closing
                        }
                      >

                        <Square
                          size={15}
                        />

                        {closing
                          ? "Closing..."
                          : "Close Attendance"}

                      </button>

                    </div>

                  </section>


                  <section className="prof-att-stats">

                    <div>

                      <span className="all">

                        <Users
                          size={21}
                        />

                      </span>

                      <strong>
                        {records.length}
                      </strong>

                      <small>
                        Students
                      </small>

                    </div>


                    <div>

                      <span className="present">

                        <Check
                          size={21}
                        />

                      </span>

                      <strong>
                        {presentCount}
                      </strong>

                      <small>
                        Present
                      </small>

                    </div>


                    <div>

                      <span className="absent">

                        <X
                          size={21}
                        />

                      </span>

                      <strong>
                        {absentCount}
                      </strong>

                      <small>
                        Absent
                      </small>

                    </div>

                  </section>


                  <section className="prof-att-roster">

                    <div className="prof-att-roster-header">

                      <div>

                        <h2>
                          Live Attendance
                        </h2>

                        <p>
                          Student check-ins appear here automatically.
                        </p>

                      </div>


                      <div className="prof-att-search">

                        <Search
                          size={16}
                        />

                        <input
                          type="text"
                          value={
                            search
                          }
                          onChange={(event) =>
                            setSearch(
                              event.target.value
                            )
                          }
                          placeholder="Search name or ID..."
                        />

                      </div>

                    </div>


                    <div className="prof-att-table-head">

                      <span>
                        Student
                      </span>

                      <span>
                        CampusMate ID
                      </span>

                      <span>
                        Check-in
                      </span>

                      <span>
                        Status
                      </span>

                      <span>
                        Professor Action
                      </span>

                    </div>


                    {filteredRecords.map(
                      (record) => {

                        const student =
                          getStudent(
                            record.student_id
                          );


                        return (

                          <div
                            className="prof-att-row"
                            key={
                              record.id
                            }
                          >

                            <div className="prof-att-student">

                              <div>

                                {student?.full_name
                                  ?.charAt(0)
                                  .toUpperCase() ||
                                  "S"}

                              </div>


                              <strong>

                                {student?.full_name ||
                                  "Student"}

                              </strong>

                            </div>


                            <span className="prof-att-id">

                              {student?.campus_id ||
                                "-"}

                            </span>


                            <span>

                              {record.checked_in_at
                                ? new Date(
                                    record.checked_in_at
                                  ).toLocaleTimeString(
                                    [],
                                    {
                                      hour:
                                        "2-digit",
                                      minute:
                                        "2-digit",
                                    }
                                  )
                                : "—"}

                            </span>


                            <span
                              className={`prof-att-status ${record.status}`}
                            >

                              {record.status ===
                              "present"
                                ? "Present"
                                : "Absent"}

                            </span>


                            <div className="prof-att-actions">

                              <button
                                type="button"
                                className="present"
                                disabled={
                                  updatingStudent ===
                                  record.student_id
                                }
                                onClick={() =>
                                  updateStatus(
                                    record.student_id,
                                    "present"
                                  )
                                }
                              >

                                <Check
                                  size={14}
                                />

                                Present

                              </button>


                              <button
                                type="button"
                                className="absent"
                                disabled={
                                  updatingStudent ===
                                  record.student_id
                                }
                                onClick={() =>
                                  updateStatus(
                                    record.student_id,
                                    "absent"
                                  )
                                }
                              >

                                <X
                                  size={14}
                                />

                                Absent

                              </button>

                            </div>

                          </div>

                        );
                      }
                    )}

                  </section>

                </>

              )}

            </>

          )}

        </div>

      </main>

    </div>
  );
}


export default ProfessorAttendance;