import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Hash,
  KeyRound,
  QrCode,
  Search,
  Users,
  XCircle,
} from "lucide-react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  supabase,
} from "../lib/supabase";

import Sidebar
  from "../components/Sidebar";

import NotificationBell
  from "../components/NotificationBell";

import UserAvatar
  from "../components/UserAvatar";

import "./StudentClasses.css";


function StudentClasses() {
  const navigate =
    useNavigate();

  const {
    code,
  } = useParams();

  const autoJoinAttempted =
    useRef(false);


  // =========================================================
  // USER
  // =========================================================

  const [
    currentUser,
    setCurrentUser,
  ] = useState(null);

  const [
    profile,
    setProfile,
  ] = useState(null);


  // =========================================================
  // CLASS DATA
  // =========================================================

  const [
    memberships,
    setMemberships,
  ] = useState([]);

  const [
    classes,
    setClasses,
  ] = useState([]);

  const [
    professors,
    setProfessors,
  ] = useState([]);


  // =========================================================
  // JOIN
  // =========================================================

  const [
    joinCode,
    setJoinCode,
  ] = useState("");


  // Past-semester (archived) classes are hidden unless asked for
  const [
    showPast,
    setShowPast,
  ] = useState(false);

  const [
    joining,
    setJoining,
  ] = useState(false);


  // =========================================================
  // SEARCH
  // =========================================================

  const [
    search,
    setSearch,
  ] = useState("");


  // =========================================================
  // UI
  // =========================================================

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadPage();
  }, []);


  // =========================================================
  // LOAD PAGE
  // =========================================================

  async function loadPage() {
    setLoading(true);

    setMessage("");
    setErrorMessage("");


    // =======================================================
    // CURRENT AUTH USER
    // =======================================================

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
      navigate("/");

      return;
    }


    setCurrentUser(
      user
    );


    // =======================================================
    // STUDENT PROFILE
    // =======================================================

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
        "Could not load your profile: " +
          profileError.message
      );

      setLoading(false);

      return;
    }


    if (
      profileData?.role &&
      profileData.role !==
        "student"
    ) {
      setErrorMessage(
        "This page is available to student accounts."
      );

      setLoading(false);

      return;
    }


    setProfile(
      profileData
    );


    // =======================================================
    // EXISTING CLASSES
    // =======================================================

    await loadJoinedClasses(
      user.id
    );


    setLoading(false);


    // =======================================================
    // QR / JOIN LINK
    // =======================================================

    if (
      code &&
      !autoJoinAttempted.current
    ) {
      autoJoinAttempted.current =
        true;


      await joinWithCode(
        code,
        user,
        true
      );
    }
  }


  // =========================================================
  // LOAD JOINED CLASSES
  // =========================================================

  async function loadJoinedClasses(
    studentId
  ) {
    const {
      data: membershipData,
      error: membershipError,
    } =
      await supabase
        .from(
          "course_group_members"
        )
        .select(
          `
          id,
          group_id,
          student_id,
          joined_at,
          status
          `
        )
        .eq(
          "student_id",
          studentId
        )
        .eq(
          "status",
          "active"
        )
        .order(
          "joined_at",
          {
            ascending: false,
          }
        );


    if (membershipError) {
      console.error(
        "Membership load error:",
        membershipError
      );


      setErrorMessage(
        "Could not load your classes: " +
          membershipError.message
      );

      return;
    }


    const loadedMemberships =
      membershipData || [];


    setMemberships(
      loadedMemberships
    );


    if (
      loadedMemberships.length ===
      0
    ) {
      setClasses([]);
      setProfessors([]);

      return;
    }


    // =======================================================
    // LOAD CLASSES
    // =======================================================

    const groupIds =
      [
        ...new Set(
          loadedMemberships.map(
            (membership) =>
              membership.group_id
          )
        ),
      ];


    const {
      data: classData,
      error: classError,
    } =
      await supabase
        .from(
          "course_groups"
        )
        // "*" so semester / archived_at (supabase/18) come too
        .select("*")
        .in(
          "id",
          groupIds
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );


    if (classError) {
      console.error(
        "Class load error:",
        classError
      );


      setErrorMessage(
        "Membership exists, but CampusMate could not load the class: " +
          classError.message
      );

      return;
    }


    const loadedClasses =
      classData || [];


    setClasses(
      loadedClasses
    );


    // =======================================================
    // PROFESSOR PROFILES
    // =======================================================

    const professorIds =
      [
        ...new Set(
          loadedClasses
            .map(
              (item) =>
                item.professor_id
            )
            .filter(Boolean)
        ),
      ];


    if (
      professorIds.length ===
      0
    ) {
      setProfessors([]);

      return;
    }


    const {
      data: professorData,
      error: professorError,
    } =
      await supabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          campus_id,
          programme,
          avatar_path
          `
        )
        .in(
          "id",
          professorIds
        );


    if (professorError) {
      console.warn(
        "Professor profile load error:",
        professorError
      );

      setProfessors([]);

      return;
    }


    setProfessors(
      professorData || []
    );
  }


  // =========================================================
  // JOIN FORM
  // =========================================================

  async function joinClass(
    event
  ) {
    event.preventDefault();


    await joinWithCode(
      joinCode,
      currentUser,
      false
    );
  }


  // =========================================================
  // JOIN CLASS
  // =========================================================

  async function joinWithCode(
    rawCode,
    userOverride,
    fromQr
  ) {
    const user =
      userOverride ||
      currentUser;


    if (!user) {
      setErrorMessage(
        "You must be logged in."
      );

      return;
    }


    const cleanCode =
      String(
        rawCode || ""
      )
        .trim()
        .toUpperCase();


    if (!cleanCode) {
      setErrorMessage(
        "Please enter a class code."
      );

      return;
    }


    setJoining(true);

    setMessage("");
    setErrorMessage("");


    const {
      data,
      error,
    } =
      await supabase.rpc(
        "join_course_group_by_code",
        {
          input_code:
            cleanCode,
        }
      );


    console.log(
      "CampusMate join result:",
      {
        data,
        error,
      }
    );


    if (error) {
      console.error(
        "Join class error:",
        error
      );


      setErrorMessage(
        error.message ||
          "Could not join the class."
      );


      setJoining(false);

      return;
    }


    await loadJoinedClasses(
      user.id
    );


    setJoinCode("");


    setMessage(
      "You joined the class successfully."
    );


    setJoining(false);


    if (fromQr) {
      navigate(
        "/classes",
        {
          replace: true,
        }
      );
    }
  }


  // =========================================================
  // REALTIME MEMBERSHIP UPDATES
  // =========================================================

  useEffect(() => {
    if (!currentUser) {
      return;
    }


    const channel =
      supabase
        .channel(
          `student-classes-${currentUser.id}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",

            schema:
              "public",

            table:
              "course_group_members",

            filter:
              `student_id=eq.${currentUser.id}`,
          },
          () => {
            loadJoinedClasses(
              currentUser.id
            );
          }
        )
        .subscribe();


    return () => {
      supabase.removeChannel(
        channel
      );
    };

  }, [currentUser]);


  // =========================================================
  // HELPERS
  // =========================================================

  function getProfessor(
    professorId
  ) {
    return professors.find(
      (professor) =>
        professor.id ===
        professorId
    );
  }


  function getMembership(
    groupId
  ) {
    return memberships.find(
      (membership) =>
        membership.group_id ===
        groupId
    );
  }


  function formatDate(
    value
  ) {
    if (!value) {
      return "-";
    }


    return new Date(
      value
    ).toLocaleDateString(
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


  // =========================================================
  // FILTER
  // =========================================================

  const filteredClasses =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();


        const visible =
          classes.filter(
            (item) =>
              showPast ||
              !item.archived_at
          );


        if (!query) {
          return visible;
        }


        return visible.filter(
          (item) => {
            const professor =
              professors.find(
                (person) =>
                  person.id ===
                  item.professor_id
              );


            return (
              item.name
                ?.toLowerCase()
                .includes(query)

              ||

              item.course_code
                ?.toLowerCase()
                .includes(query)

              ||

              professor
                ?.full_name
                ?.toLowerCase()
                .includes(query)
            );
          }
        );
      },
      [
        classes,
        professors,
        search,
        showPast,
      ]
    );


  // =========================================================
  // USER INFO
  // =========================================================

  const fullName =
    profile?.full_name ||
    "Student";


  const programme =
    profile?.programme ||
    "Student";


  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="student-classes-loading">

        <BookOpen
          size={46}
        />


        <p>
          Loading your classes...
        </p>

      </div>
    );
  }


  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="student-classes-page">

      <Sidebar />


      <main className="student-classes-main">

        {/* ===================================================
            TOP BAR
        ==================================================== */}

        <header className="student-classes-topbar">

          <div className="student-classes-search">

            <Search
              size={18}
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
              placeholder="Search my classes..."
            />

          </div>


          <div className="student-classes-profile">

            <NotificationBell />


            {/* STUDENT PROFILE PHOTO */}

            <UserAvatar
              profile={profile}
              name={fullName}
              size={46}
            />


            <div>

              <strong>
                {fullName}
              </strong>


              <small>
                {programme}
              </small>

            </div>

          </div>

        </header>


        {/* ===================================================
            CONTENT
        ==================================================== */}

        <div className="student-classes-content">

          {/* =================================================
              HEADER
          ================================================== */}

          <div className="student-classes-header">

            <h1>
              My Classes
            </h1>


            <p>
              Join your professor&apos;s class and access assignments,
              projects and attendance.
            </p>

          </div>


          {/* =================================================
              SUCCESS
          ================================================== */}

          {message && (

            <div className="student-class-success">

              <CheckCircle2
                size={18}
              />

              {message}

            </div>

          )}


          {/* =================================================
              ERROR
          ================================================== */}

          {errorMessage && (

            <div className="student-class-error">

              <XCircle
                size={18}
              />


              <div>

                <strong>
                  Could not join class
                </strong>

                <span>
                  {errorMessage}
                </span>

              </div>

            </div>

          )}


          {/* =================================================
              JOIN CARD
          ================================================== */}

          <section className="student-join-card">

            <div className="student-join-heading">

              <div className="student-join-heading-icon">

                <KeyRound
                  size={26}
                />

              </div>


              <div>

                <h2>
                  Join a Class
                </h2>


                <p>
                  Enter the code shared by your professor, or scan the class QR code.
                </p>

              </div>

            </div>


            <form
              className="student-join-form"
              onSubmit={
                joinClass
              }
            >

              <div className="student-join-input">

                <Hash
                  size={19}
                />


                <input
                  type="text"
                  value={
                    joinCode
                  }
                  onChange={(event) =>
                    setJoinCode(
                      event.target.value
                        .toUpperCase()
                        .replace(
                          /[^A-Z0-9]/g,
                          ""
                        )
                    )
                  }
                  placeholder="Example: H8CE7C"
                  maxLength={6}
                  autoComplete="off"
                />

              </div>


              <button
                type="submit"
                disabled={
                  joining
                }
              >

                {joining
                  ? "Joining..."
                  : "Join Class"}


                {!joining && (

                  <ArrowRight
                    size={17}
                  />

                )}

              </button>

            </form>


            <div className="student-join-qr-note">

              <QrCode
                size={18}
              />


              <span>
                If your professor displays a QR code, scan it using your phone camera.
                CampusMate will open this page and join the class.
              </span>

            </div>

          </section>


          


          {/* =================================================
              JOINED CLASSES
          ================================================== */}

          <section className="student-joined-card">

            <div className="student-joined-header">

              <div>

                <h2>
                  Joined Classes
                </h2>


                <p>
                  Classes you currently belong to.
                </p>

              </div>


              <span className="student-class-count">

                {filteredClasses.length}

              </span>

            </div>


            {classes.some((item) => item.archived_at) && (
              <label className="student-past-toggle">
                <input
                  type="checkbox"
                  checked={showPast}
                  onChange={(event) =>
                    setShowPast(event.target.checked)
                  }
                />
                Show past classes ({classes.filter((item) => item.archived_at).length})
              </label>
            )}


            {classes.length ===
            0 ? (

              <div className="student-class-empty">

                <BookOpen
                  size={52}
                />


                <h3>
                  You haven&apos;t joined a class yet
                </h3>


                <p>
                  Ask your professor for the class code or QR code and join above.
                </p>

              </div>

            ) : filteredClasses.length ===
              0 ? (

              <div className="student-class-empty">

                <Search
                  size={45}
                />


                <h3>
                  {search.trim()
                    ? "No classes found"
                    : "No current classes"}
                </h3>


                <p>
                  {search.trim()
                    ? "Try another search."
                    : "Your classes from past semesters are under Show past classes."}
                </p>

              </div>

            ) : (

              <div className="student-class-grid">

                {filteredClasses.map(
                  (item) => {

                    const professor =
                      getProfessor(
                        item.professor_id
                      );


                    const membership =
                      getMembership(
                        item.id
                      );


                    return (

                      <article
                        className="student-class-card"
                        key={
                          item.id
                        }
                      >

                        <div className="student-class-card-top">

                          <div className="student-class-book-icon">

                            <BookOpen
                              size={23}
                            />

                          </div>


                          <span
                            className={`student-class-open-status ${
                              item.is_active
                                ? "open"
                                : "closed"
                            }`}
                          >

                            {item.archived_at
                              ? "Past"
                              : item.is_active
                                ? "Active"
                                : "Closed"}

                          </span>

                        </div>


                        <h3>
                          {item.name}
                        </h3>


                        <span className="student-class-course-code">

                          {item.course_code ||
                            "No course code"}
                          {item.semester ? ` · ${item.semester}` : ""}

                        </span>


                        {item.description && (

                          <p className="student-class-description">

                            {item.description}

                          </p>

                        )}


                        <div className="student-class-details">

                          {/* PROFESSOR WITH AVATAR */}

                          <div>

                            <UserAvatar
                              profile={professor}
                              userId={
                                item.professor_id
                              }
                              name={
                                professor?.full_name ||
                                "Professor"
                              }
                              size={36}
                            />


                            <div>

                              <small>
                                Professor
                              </small>


                              <strong>

                                {professor?.full_name ||
                                  "Professor"}

                              </strong>

                            </div>

                          </div>


                          <div>

                            <Users
                              size={16}
                            />


                            <div>

                              <small>
                                Joined
                              </small>


                              <strong>

                                {formatDate(
                                  membership?.joined_at
                                )}

                              </strong>

                            </div>

                          </div>

                        </div>


                        <Link
                          to={`/classes/${item.id}`}
                          className="student-class-footer student-class-open-link"
                        >

                          <span>
                            Open course
                          </span>


                          <ArrowRight
                            size={18}
                          />

                        </Link>

                      </article>

                    );
                  }
                )}

              </div>

            )}

          </section>

        </div>

      </main>

    </div>
  );
}


export default StudentClasses;