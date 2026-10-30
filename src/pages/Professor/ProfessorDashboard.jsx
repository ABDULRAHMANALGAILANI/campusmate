import {

  useEffect,

  useMemo,

  useState,

} from "react";



import {

  useNavigate,

} from "react-router-dom";



import {

  BookOpen,

  ClipboardList,


  GraduationCap,


  Search,

  Users,

} from "lucide-react";



import {

  supabase,

} from "../../lib/supabase";

import { loadTeachingClasses } from "../../lib/classes";



import ProfessorSidebar

  from "../../components/ProfessorSidebar";



import NotificationBell

  from "../../components/NotificationBell";

import UserAvatar

  from "../../components/UserAvatar";



import ToMarkList from "../../components/ToMarkList";

import "./ProfessorDashboard.css";





function ProfessorDashboard() {

  // Number of hand-ins waiting to be marked (set by ToMarkList)
  const [
    toMarkCount,
    setToMarkCount,
  ] = useState(null);

  const navigate =

    useNavigate();





  // =========================================================

  // ACCOUNT

  // =========================================================



  const [
    , // current user value is not needed here
    setCurrentUser,
  ] = useState(null);



  const [

    profile,

    setProfile,

  ] = useState(null);





  // =========================================================

  // DATA

  // =========================================================



  const [

    classes,

    setClasses,

  ] = useState([]);



  const [

    members,

    setMembers,

  ] = useState([]);



  const [

    ,

    setProjects,

  ] = useState([]);





  // =========================================================

  // UI

  // =========================================================



  const [

    loading,

    setLoading,

  ] = useState(true);



  const [

    search,

    setSearch,

  ] = useState("");



  const [

    errorMessage,

    setErrorMessage,

  ] = useState("");





  // =========================================================

  // INITIAL LOAD

  // =========================================================



  useEffect(() => {

    loadDashboard();

  }, []);





  // =========================================================

  // LOAD DASHBOARD

  // =========================================================



  async function loadDashboard() {

    setLoading(true);



    setErrorMessage("");





    // =======================================================

    // CURRENT USER

    // =======================================================



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

      navigate(

        "/",

        {

          replace: true,

        }

      );



      return;

    }





    setCurrentUser(

      user

    );





    // =======================================================

    // PROFESSOR PROFILE

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

          programme,

          role,

          campus_id,

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





    // =======================================================

    // ROLE PROTECTION

    // =======================================================



    if (

      profileData?.role !==

      "professor"

    ) {

      navigate(

        "/dashboard",

        {

          replace: true,

        }

      );



      return;

    }





    setProfile(

      profileData

    );





    // =======================================================

    // PROFESSOR CLASSES

    // =======================================================



    // Own classes + classes you co-teach (co-lecturer / tutor)
    const classData =
      await loadTeachingClasses(user.id);

    const classError =
      null;





    if (classError) {

      console.error(

        "Class error:",

        classError

      );



      setErrorMessage(

        classError.message

      );



      setLoading(false);



      return;

    }





    const loadedClasses =

      classData || [];





    setClasses(

      loadedClasses

    );





    const classIds =

      loadedClasses.map(

        (group) =>

          group.id

      );





    // =======================================================

    // NO CLASSES YET

    // =======================================================



    if (

      classIds.length ===

      0

    ) {

      setMembers([]);

      setProjects([]);



      setLoading(false);



      return;

    }





    // =======================================================

    // CLASS MEMBERS

    // =======================================================



    const {

      data: memberData,

      error: memberError,

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

          status,

          joined_at

          `

        )

        .in(

          "group_id",

          classIds

        );





    if (memberError) {

      console.error(

        "Member error:",

        memberError

      );



    } else {

      setMembers(

        memberData || []

      );

    }





    // =======================================================

    // PROJECT TEAMS

    // =======================================================



    const {

      data: projectData,

      error: projectError,

    } =

      await supabase

        .from(

          "project_teams"

        )

        .select(

          `

          id,

          group_id,

          title,

          status,

          created_at

          `

        )

        .in(

          "group_id",

          classIds

        )

        .order(

          "created_at",

          {

            ascending: false,

          }

        );





    if (projectError) {

      console.error(

        "Project error:",

        projectError

      );



    } else {

      setProjects(

        projectData || []

      );

    }





    setLoading(false);

  }





  // =========================================================

  // PROFESSOR DISPLAY

  // =========================================================



  const professorName =

    profile?.full_name ||

    "Professor";





  // Greet professors by title + surname ("Dr Tan"), or by first
  // name when there is no title ("Sarah").
  const nameParts =
    professorName.trim().split(/\s+/).filter(Boolean);

  const hasTitle =
    /^(dr|prof|professor|mr|mrs|ms|miss|madam|sir)\.?$/i.test(
      nameParts[0] || ""
    );

  const firstName =
    (hasTitle && nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
      : nameParts[0]) ||
    "Professor";










  // =========================================================

  // STATS

  // =========================================================



  const activeClasses =

    classes.filter(

      (group) =>

        group.is_active

    );





  const activeMembers =

    members.filter(

      (member) =>

        member.status ===

        "active"

    );





  const uniqueStudents =

    new Set(

      activeMembers.map(

        (member) =>

          member.student_id

      )

    ).size;










  // =========================================================

  // SEARCH

  // =========================================================



  const filteredClasses =

    useMemo(

      () => {

        const query =

          search

            .trim()

            .toLowerCase();





        if (!query) {

          return classes;

        }





        return classes.filter(

          (group) =>

            group.name

              ?.toLowerCase()

              .includes(

                query

              )

            ||

            group.course_code

              ?.toLowerCase()

              .includes(

                query

              )

        );

      },

      [

        classes,

        search,

      ]

    );





  // =========================================================

  // CLASS STUDENT COUNT

  // =========================================================



  function studentCount(

    groupId

  ) {

    return new Set(

      members

        .filter(

          (member) =>

            member.group_id ===

              groupId

            &&

            member.status ===

              "active"

        )

        .map(

          (member) =>

            member.student_id

        )

    ).size;

  }





  // =========================================================

  // LOADING

  // =========================================================



  if (loading) {

    return (

      <div className="professor-dashboard-loading">



        <GraduationCap

          size={46}

        />



        <p>

          Loading professor dashboard...

        </p>



      </div>

    );

  }





  // =========================================================

  // PAGE

  // =========================================================



  return (

    <div className="professor-dashboard-page">



      {/* =====================================================

          SIDEBAR

      ====================================================== */}



      <ProfessorSidebar />





      {/* =====================================================

          MAIN

      ====================================================== */}



      <main className="professor-main">



        {/* ===================================================

            TOP BAR

        ==================================================== */}



        <header className="professor-topbar">



          <form
            className="professor-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              if (search.trim().length >= 2) {
                navigate(`/search?q=${encodeURIComponent(search.trim())}`);
              }
            }}
          >



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

              placeholder="Search everything... (press Enter)"
              aria-label="Search your classes"

            />



          </form>





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





        {/* ===================================================

            CONTENT

        ==================================================== */}



        <div className="professor-dashboard-content">



          {/* =================================================

              HEADER

          ================================================== */}



          <section className="professor-welcome">



            <div>



              <h1>

                Welcome back, {firstName}

              </h1>



              <p>

                Manage your classes, students, assignments and projects.

              </p>



            </div>



          </section>





          {/* =================================================

              ERROR

          ================================================== */}



          {errorMessage && (



            <div className="professor-dashboard-error">



              {errorMessage}



            </div>



          )}





          {/* =================================================

              STATS

          ================================================== */}



          <section className="professor-dashboard-stats">



            <button

              type="button"

              className="professor-dashboard-stat"

              onClick={() =>

                navigate(

                  "/professor/classes"

                )

              }

            >



              <span className="professor-stat-icon blue">



                <BookOpen

                  size={23}

                />



              </span>





              <div>



                <strong>

                  {activeClasses.length}

                </strong>



                <span>

                  Active Classes

                </span>



              </div>



            </button>





            <button

              type="button"

              className="professor-dashboard-stat"

              onClick={() =>

                navigate(

                  "/professor/classes"

                )

              }

            >



              <span className="professor-stat-icon green">



                <Users

                  size={23}

                />



              </span>





              <div>



                <strong>

                  {uniqueStudents}

                </strong>



                <span>

                  Students

                </span>



              </div>



            </button>





            <a
              className="professor-dashboard-stat"
              href="#to-mark"
              style={{
                color: "inherit",
                textDecoration: "none",
              }}
            >

              <span className="professor-stat-icon orange">

                <ClipboardList
                  size={23}
                />

              </span>

              <div>

                <strong>
                  {toMarkCount ?? "–"}
                </strong>

                <span>
                  To mark
                </span>

              </div>

            </a>



          </section>





          {/* =================================================

              DASHBOARD GRID

          ================================================== */}



          <div className="professor-home-grid">

            <section
              className="professor-home-card"
              id="to-mark"
            >

              <div className="professor-home-card-header">

                <div>

                  <h2>
                    To mark
                  </h2>

                  <p>
                    Work your students have handed in, oldest first.
                  </p>

                </div>

              </div>

              <ToMarkList onCount={setToMarkCount} />

            </section>




            {/* ===============================================

                CLASSES

            ================================================ */}



            <section className="professor-home-card">



              <div className="professor-home-card-header">



                <div>



                  <h2>

                    My Classes

                  </h2>



                  <p>

                    Your recently created classes.

                  </p>



                </div>





                <button

                  type="button"

                  onClick={() =>

                    navigate(

                      "/professor/classes"

                    )

                  }

                >

                  View All

                </button>



              </div>





              {filteredClasses.length ===

              0 ? (



                <div className="professor-home-empty">



                  <BookOpen

                    size={38}

                  />



                  <h3>

                    No classes yet

                  </h3>



                  <p>

                    Create your first class to start adding students.

                  </p>





                  <button

                    type="button"

                    onClick={() =>

                      navigate(

                        "/professor/classes"

                      )

                    }

                  >

                    Create Class

                  </button>



                </div>



              ) : (



                <div className="professor-dashboard-class-list">



                  {filteredClasses

                    .slice(

                      0,

                      5

                    )

                    .map(

                      (group) => (



                        <button

                          type="button"

                          className="professor-dashboard-class"

                          key={

                            group.id

                          }

                          onClick={() =>

                            navigate(

                              `/professor/classes/${group.id}`

                            )

                          }

                        >



                          <div className="professor-dashboard-class-icon">



                            <BookOpen

                              size={20}

                            />



                          </div>





                          <div className="professor-dashboard-class-info">



                            <strong>

                              {group.name}

                            </strong>





                            <span>



                              {group.course_code ||

                                "No course code"}



                            </span>



                          </div>





                          <div className="professor-dashboard-class-meta">



                            <strong>



                              {studentCount(

                                group.id

                              )}



                            </strong>



                            <span>

                              Students

                            </span>



                          </div>





                          <span

                            className={

                              group.is_active

                                ? "professor-class-status active"

                                : "professor-class-status inactive"

                            }

                          >



                            {group.is_active

                              ? "Active"

                              : "Inactive"}



                          </span>



                        </button>



                      )

                    )}



                </div>



              )}



            </section>









          </div>



        </div>



      </main>



    </div>

  );

}


export default ProfessorDashboard;
