import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  BookOpen,
  Copy,
  GraduationCap,
  Hash,
  Link as LinkIcon,
  Lock,
  Plus,
  Search,
  Trash2,
  Unlock,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import {
  QRCodeSVG,
} from "qrcode.react";

import {
  supabase,
} from "../../lib/supabase";

import ProfessorSidebar
  from "../../components/ProfessorSidebar";

import NotificationBell
  from "../../components/NotificationBell";

import UserAvatar
  from "../../components/UserAvatar";

import { loadTeachingClasses } from "../../lib/classes";

import "./ProfessorDashboard.css";
import "./ProfessorClasses.css";


function ProfessorClasses() {
  // =========================================================
  // ACCOUNT
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
  // CLASSES
  // =========================================================

  const [
    groups,
    setGroups,
  ] = useState([]);


  const [
    members,
    setMembers,
  ] = useState([]);


  const [
    studentProfiles,
    setStudentProfiles,
  ] = useState([]);


  const [
    selectedGroupId,
    setSelectedGroupId,
  ] = useState("");


  // =========================================================
  // CREATE CLASS
  // =========================================================

  const [
    showCreate,
    setShowCreate,
  ] = useState(false);


  const [
    groupName,
    setGroupName,
  ] = useState("");


  const [
    courseCode,
    setCourseCode,
  ] = useState("");


  const [
    description,
    setDescription,
  ] = useState("");


  const [
    creating,
    setCreating,
  ] = useState(false);


  // =========================================================
  // DELETE CLASS
  // =========================================================

  const [
    showDeleteConfirm,
    setShowDeleteConfirm,
  ] = useState(false);


  const [
    deleting,
    setDeleting,
  ] = useState(false);


  // =========================================================
  // ADD STUDENT
  // =========================================================

  const [
    addCampusId,
    setAddCampusId,
  ] = useState("");


  const [
    addStudentName,
    setAddStudentName,
  ] = useState("");


  const [
    addingStudent,
    setAddingStudent,
  ] = useState(false);


  // =========================================================
  // SEARCH
  // =========================================================

  const [
    search,
    setSearch,
  ] = useState("");


  const [
    showArchived,
    setShowArchived,
  ] = useState(false);


  const [
    studentSearch,
    setStudentSearch,
  ] = useState("");


  // =========================================================
  // UI
  // =========================================================

  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    updatingGroup,
    setUpdatingGroup,
  ] = useState(false);


  const [
    message,
    setMessage,
  ] = useState("");


  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  // =========================================================
  // LOAD PAGE
  // =========================================================

  useEffect(() => {
    loadPage();
  }, []);


  async function loadPage() {
    setLoading(true);

    setMessage("");
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
        "Could not load professor profile: " +
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
        "This page is available only to professors."
      );

      setLoading(false);

      return;
    }


    setProfile(
      profileData
    );


    await loadGroups(
      user.id
    );


    setLoading(false);
  }


  // =========================================================
  // LOAD PROFESSOR CLASSES
  // =========================================================

  async function loadGroups(
    professorId
  ) {
    // Own classes + classes you co-teach (co-lecturer / tutor)
    const loadedGroups =
      await loadTeachingClasses(
        professorId,
        { includeArchived: true }
      );


    setGroups(
      loadedGroups
    );


    setSelectedGroupId(
      (current) => {
        const stillExists =
          loadedGroups.some(
            (group) =>
              group.id === current
          );


        if (
          current &&
          stillExists
        ) {
          return current;
        }


        return (
          loadedGroups[0]?.id ||
          ""
        );
      }
    );


    await loadMembers(
      loadedGroups
    );
  }


  // =========================================================
  // LOAD MEMBERS
  // =========================================================

  async function loadMembers(
    loadedGroups = groups
  ) {
    const groupIds =
      loadedGroups.map(
        (group) =>
          group.id
      );


    if (
      groupIds.length === 0
    ) {
      setMembers([]);
      setStudentProfiles([]);

      return;
    }


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
          joined_at,
          status
          `
        )
        .in(
          "group_id",
          groupIds
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


    if (memberError) {
      setErrorMessage(
        "Could not load students: " +
          memberError.message
      );

      return;
    }


    const loadedMembers =
      memberData || [];


    setMembers(
      loadedMembers
    );


    const studentIds =
      [
        ...new Set(
          loadedMembers.map(
            (member) =>
              member.student_id
          )
        ),
      ];


    if (
      studentIds.length === 0
    ) {
      setStudentProfiles([]);

      return;
    }


    const {
      data: profilesData,
      error: profilesError,
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
          studentIds
        );


    if (profilesError) {
      setErrorMessage(
        "Could not load student profiles: " +
          profilesError.message
      );

      return;
    }


    setStudentProfiles(
      profilesData || []
    );
  }


  // =========================================================
  // GENERATE JOIN CODE
  // =========================================================

  function generateCode() {
    const characters =
      "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


    let code = "";


    for (
      let index = 0;
      index < 6;
      index += 1
    ) {
      code +=
        characters.charAt(
          Math.floor(
            Math.random() *
              characters.length
          )
        );
    }


    return code;
  }


  // =========================================================
  // CREATE CLASS
  // =========================================================

  async function createGroup(
    event
  ) {
    event.preventDefault();


    if (!currentUser) {
      return;
    }


    setMessage("");
    setErrorMessage("");


    if (
      !groupName.trim()
    ) {
      setErrorMessage(
        "Please enter a class name."
      );

      return;
    }


    setCreating(true);


    let createdGroup =
      null;


    let finalError =
      null;


    // Try several codes if collision occurs.

    for (
      let attempt = 0;
      attempt < 5;
      attempt += 1
    ) {
      const joinCode =
        generateCode();


      const {
        data,
        error,
      } =
        await supabase
          .from(
            "course_groups"
          )
          .insert({
            professor_id:
              currentUser.id,

            name:
              groupName.trim(),

            course_code:
              courseCode
                .trim()
                .toUpperCase() ||
              null,

            description:
              description.trim() ||
              null,

            join_code:
              joinCode,

            is_active:
              true,
          })
          .select()
          .single();


      if (!error) {
        createdGroup =
          data;

        break;
      }


      finalError =
        error;


      if (
        error.code !==
        "23505"
      ) {
        break;
      }
    }


    if (!createdGroup) {
      setErrorMessage(
        "Could not create class: " +
          (
            finalError?.message ||
            "Unknown error"
          )
      );

      setCreating(false);

      return;
    }


    setGroupName("");
    setCourseCode("");
    setDescription("");

    setShowCreate(false);


    await loadGroups(
      currentUser.id
    );


    setSelectedGroupId(
      createdGroup.id
    );


    setMessage(
      `${createdGroup.name} was created successfully. Join code: ${createdGroup.join_code}`
    );


    setCreating(false);
  }


  // =========================================================
  // DELETE CLASS
  // =========================================================

  async function deleteClass() {
    if (
      !currentUser ||
      !selectedGroup
    ) {
      return;
    }


    setDeleting(true);

    setMessage("");
    setErrorMessage("");


    const className =
      selectedGroup.name;


    /*
      professor_id check is included here as
      extra protection in addition to Supabase RLS.
    */

    const {
      error,
    } =
      await supabase
        .from(
          "course_groups"
        )
        .delete()
        .eq(
          "id",
          selectedGroup.id
        )
        .eq(
          "professor_id",
          currentUser.id
        );


    if (error) {
      setErrorMessage(
        "Could not delete class: " +
          error.message
      );

      setDeleting(false);

      return;
    }


    setShowDeleteConfirm(
      false
    );


    setSelectedGroupId("");


    await loadGroups(
      currentUser.id
    );


    setMessage(
      `${className} was removed successfully.`
    );


    setDeleting(false);
  }


  // =========================================================
  // OPEN / CLOSE JOINING
  // =========================================================

  async function toggleGroupStatus() {
    if (
      !selectedGroup ||
      !currentUser
    ) {
      return;
    }


    setUpdatingGroup(true);

    setMessage("");
    setErrorMessage("");


    const nextStatus =
      !selectedGroup.is_active;


    const {
      error,
    } =
      await supabase
        .from(
          "course_groups"
        )
        .update({
          is_active:
            nextStatus,
        })
        .eq(
          "id",
          selectedGroup.id
        )
        .eq(
          "professor_id",
          currentUser.id
        );


    if (error) {
      setErrorMessage(
        error.message
      );

      setUpdatingGroup(false);

      return;
    }


    await loadGroups(
      currentUser.id
    );


    setMessage(
      nextStatus
        ? "Students can now join this class."
        : "Class joining has been closed."
    );


    setUpdatingGroup(false);
  }


  // =========================================================
  // ADD STUDENT MANUALLY
  // =========================================================

  async function addStudentManually(
    event
  ) {
    event.preventDefault();


    if (!selectedGroup) {
      setErrorMessage(
        "Select a class first."
      );

      return;
    }


    if (
      !addCampusId.trim() ||
      !addStudentName.trim()
    ) {
      setErrorMessage(
        "Enter both CampusMate ID and student full name."
      );

      return;
    }


    setAddingStudent(true);

    setMessage("");
    setErrorMessage("");


    const normalizedCampusId =
      addCampusId
        .trim()
        .toUpperCase();


    const {
      error,
    } =
      await supabase.rpc(
        "add_student_to_course_group",
        {
          input_group_id:
            selectedGroup.id,

          input_campus_id:
            normalizedCampusId,

          input_student_name:
            addStudentName.trim(),
        }
      );


    if (error) {
      setErrorMessage(
        error.message
      );

      setAddingStudent(false);

      return;
    }


    setAddCampusId("");
    setAddStudentName("");


    await loadGroups(
      currentUser.id
    );


    setMessage(
      `${normalizedCampusId} was added to the class.`
    );


    setAddingStudent(false);
  }


  // =========================================================
  // COPY
  // =========================================================

  async function copyText(
    value,
    successText
  ) {
    try {
      await navigator.clipboard
        .writeText(
          value
        );


      setMessage(
        successText
      );

    } catch {
      setErrorMessage(
        "Could not copy automatically."
      );
    }
  }


  // =========================================================
  // SELECTED CLASS
  // =========================================================

  const selectedGroup =
    groups.find(
      (group) =>
        group.id ===
        selectedGroupId
    );


  const selectedMembers =
    members.filter(
      (member) =>
        member.group_id ===
        selectedGroupId
    );


  // =========================================================
  // STUDENT HELPER
  // =========================================================

  function getStudent(
    studentId
  ) {
    return studentProfiles.find(
      (student) =>
        student.id ===
        studentId
    );
  }


  // =========================================================
  // FILTER CLASSES
  // =========================================================

  const filteredGroups =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();


        // Archived classes (past semesters) are hidden unless asked for
        const visible =
          groups.filter(
            (group) =>
              showArchived ||
              !group.archived_at
          );


        if (!query) {
          return visible;
        }


        return visible.filter(
          (group) =>
            group.name
              ?.toLowerCase()
              .includes(query)

            ||

            group.course_code
              ?.toLowerCase()
              .includes(query)

            ||

            group.join_code
              ?.toLowerCase()
              .includes(query)
        );
      },
      [
        groups,
        search,
        showArchived,
      ]
    );


  // =========================================================
  // FILTER STUDENTS
  // =========================================================

  const filteredMembers =
    useMemo(
      () => {
        const query =
          studentSearch
            .trim()
            .toLowerCase();


        if (!query) {
          return selectedMembers;
        }


        return selectedMembers.filter(
          (member) => {
            const student =
              studentProfiles.find(
                (item) =>
                  item.id ===
                  member.student_id
              );


            return (
              student?.full_name
                ?.toLowerCase()
                .includes(query)

              ||

              student?.campus_id
                ?.toLowerCase()
                .includes(query)

              ||

              student?.programme
                ?.toLowerCase()
                .includes(query)
            );
          }
        );
      },
      [
        selectedMembers,
        studentProfiles,
        studentSearch,
      ]
    );


  // =========================================================
  // JOIN LINK
  // =========================================================

  const joinLink =
    selectedGroup
      ? `${window.location.origin}/join/${selectedGroup.join_code}`
      : "";


  // =========================================================
  // PROFESSOR
  // =========================================================

  const professorName =
    profile?.full_name ||
    "Professor";




  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="professor-class-loading">

        <GraduationCap
          size={46}
        />

        <p>
          Loading classes...
        </p>

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

        {/* ===================================================
            TOP BAR
        ==================================================== */}

        <header className="professor-topbar">

          <div className="professor-search">

            <Search
              size={18}
            />


            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search classes..."
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


        {/* ===================================================
            CONTENT
        ==================================================== */}

        <div className="professor-classes-content">

          {/* HEADER */}

          <div className="professor-classes-header">

            <div>

              <h1>
                My Classes
              </h1>

              <p>
                Create classes, manage students and remove classes you no longer need.
              </p>

            </div>


            <button
              type="button"
              className="create-class-button"
              onClick={() =>
                setShowCreate(true)
              }
            >

              <Plus
                size={18}
              />

              Create Class

            </button>

          </div>


          {/* MESSAGES */}

          {message && (

            <div className="professor-class-message">

              {message}

            </div>

          )}


          {errorMessage && (

            <div className="professor-class-error">

              {errorMessage}

            </div>

          )}


          


          {/* =================================================
              CREATE CLASS FORM
          ================================================== */}

          {showCreate && (

            <section className="professor-create-class">

              <div className="professor-create-class-header">

                <div>

                  <h2>
                    Create New Class
                  </h2>

                  <p>
                    CampusMate will generate the join code automatically.
                  </p>

                </div>


                <button
                  type="button"
                  className="class-close-form-button"
                  onClick={() =>
                    setShowCreate(false)
                  }
                >

                  <X
                    size={18}
                  />

                </button>

              </div>


              <form
                className="professor-create-class-form"
                onSubmit={
                  createGroup
                }
              >

                <div>

                  <label>
                    Class Name *
                  </label>

                  <input
                    type="text"
                    value={groupName}
                    onChange={(event) =>
                      setGroupName(
                        event.target.value
                      )
                    }
                    placeholder="Example: Mathematics"
                    required
                  />

                </div>


                <div>

                  <label>
                    Course Code
                  </label>

                  <input
                    type="text"
                    value={courseCode}
                    onChange={(event) =>
                      setCourseCode(
                        event.target.value
                      )
                    }
                    placeholder="Example: CCA101"
                  />

                </div>


                <div className="class-description-field">

                  <label>
                    Description
                  </label>

                  <textarea
                    value={description}
                    onChange={(event) =>
                      setDescription(
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder="Optional class description..."
                  />

                </div>


                <button
                  type="submit"
                  disabled={creating}
                >

                  <Plus
                    size={17}
                  />

                  {creating
                    ? "Creating..."
                    : "Create Class"}

                </button>

              </form>

            </section>

          )}


          {/* =================================================
              NO CLASSES
          ================================================== */}

          {groups.length === 0 ? (

            <section className="professor-class-empty">

              <BookOpen
                size={50}
              />

              <h2>
                No classes yet
              </h2>

              <p>
                Create your first class and invite students.
              </p>


              <button
                type="button"
                onClick={() =>
                  setShowCreate(true)
                }
              >

                <Plus
                  size={17}
                />

                Create First Class

              </button>

            </section>

          ) : (

            <div className="professor-classes-layout">

              {/* =============================================
                  CLASS LIST
              ============================================== */}

              <aside className="professor-class-list-card">

                <div className="professor-class-list-header">

                  <h2>
                    Classes
                  </h2>

                  <span>
                    {filteredGroups.length}
                  </span>

                </div>


                {groups.some((group) => group.archived_at) && (
                  <label className="professor-archived-toggle">
                    <input
                      type="checkbox"
                      checked={showArchived}
                      onChange={(event) =>
                        setShowArchived(event.target.checked)
                      }
                    />
                    Show archived classes ({groups.filter((group) => group.archived_at).length})
                  </label>
                )}


                <div className="professor-class-list">

                  {filteredGroups.map(
                    (group) => {

                      const count =
                        members.filter(
                          (member) =>
                            member.group_id ===
                            group.id
                        ).length;


                      return (

                        <button
                          key={group.id}
                          type="button"
                          className={`professor-class-list-item ${
                            selectedGroupId ===
                            group.id
                              ? "active"
                              : ""
                          }`}
                          onClick={() => {
                            setSelectedGroupId(
                              group.id
                            );

                            setStudentSearch("");
                            setShowDeleteConfirm(false);
                          }}
                        >

                          <div className="class-list-icon">

                            <BookOpen
                              size={18}
                            />

                          </div>


                          <div className="class-list-info">

                            <strong>
                              {group.name}
                            </strong>

                            <small>
                              {group.course_code ||
                                "No course code"}
                              {group.semester ? ` · ${group.semester}` : ""}
                            </small>

                            {group.archived_at && (
                              <em className="class-archived-badge">
                                Archived
                              </em>
                            )}

                            <span>

                              <Users
                                size={12}
                              />

                              {count}{" "}
                              {count === 1
                                ? "student"
                                : "students"}

                            </span>

                          </div>


                          <span
                            className={`class-state-dot ${
                              group.is_active
                                ? "active"
                                : "closed"
                            }`}
                          />

                        </button>

                      );
                    }
                  )}

                </div>

              </aside>


              {/* =============================================
                  SELECTED CLASS
              ============================================== */}

              {selectedGroup && (

                <section className="professor-selected-class">

                  {/* CLASS HEADER */}

                  <div className="selected-class-header">

                    <div>

                      <div className="selected-class-title">

                        <h2>
                          {selectedGroup.name}
                        </h2>


                        <span
                          className={
                            selectedGroup.is_active
                              ? "open"
                              : "closed"
                          }
                        >

                          {selectedGroup.is_active
                            ? "Open"
                            : "Closed"}

                        </span>

                      </div>


                      <p>
                        {selectedGroup.course_code ||
                          "No course code"}
                      </p>


                      {selectedGroup.description && (

                        <small>
                          {selectedGroup.description}
                        </small>

                      )}

                    </div>


                    <div className="selected-class-actions">

                      <Link
                        to={`/professor/classes/${selectedGroup.id}`}
                        className="class-open-toggle class-open-course"
                      >

                        <BookOpen
                          size={15}
                        />

                        Open course page

                      </Link>
                      {selectedGroup.professor_id !== currentUser?.id && (
                        <span className="class-open-toggle class-coteach-chip">
                          You co-teach this class
                        </span>
                      )}

                      {selectedGroup.professor_id === currentUser?.id && (


                      <button
                        type="button"
                        className="class-open-toggle"
                        onClick={
                          toggleGroupStatus
                        }
                        disabled={
                          updatingGroup
                        }
                      >

                        {selectedGroup.is_active ? (

                          <Lock
                            size={15}
                          />

                        ) : (

                          <Unlock
                            size={15}
                          />

                        )}


                        {updatingGroup
                          ? "Updating..."
                          : selectedGroup.is_active
                          ? "Close Joining"
                          : "Open Joining"}

                      </button>
                      )}


                      {/* DELETE CLASS */}
                      {selectedGroup.professor_id === currentUser?.id && (

                      <button
                        type="button"
                        className="delete-class-button"
                        onClick={() =>
                          setShowDeleteConfirm(
                            true
                          )
                        }
                      >

                        <Trash2
                          size={16}
                        />

                        Delete Class

                      </button>
                      )}

                    </div>

                  </div>


                  {/* =========================================
                      JOIN CODE + QR
                  ========================================== */}

                  <div className="professor-class-join-grid">

                    <div className="class-code-card">

                      <div className="class-card-heading">

                        <Hash
                          size={19}
                        />

                        <div>

                          <h3>
                            Class Join Code
                          </h3>

                          <p>
                            Share this code with your students.
                          </p>

                        </div>

                      </div>


                      <div className="class-code">

                        {selectedGroup.join_code}

                      </div>


                      <div className="class-code-buttons">

                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              selectedGroup.join_code,
                              "Class code copied."
                            )
                          }
                        >

                          <Copy
                            size={15}
                          />

                          Copy Code

                        </button>


                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              joinLink,
                              "Class invitation link copied."
                            )
                          }
                        >

                          <LinkIcon
                            size={15}
                          />

                          Copy Link

                        </button>

                      </div>

                    </div>


                    <div className="class-qr-card">

                      <div className="class-qr-box">

                        <QRCodeSVG
                          value={joinLink}
                          size={160}
                          level="H"
                          includeMargin
                        />

                      </div>


                      <h3>
                        Scan to Join
                      </h3>

                      <p>
                        Students can scan this QR code to join the class.
                      </p>

                    </div>

                  </div>


                  {/* =========================================
                      ADD STUDENT
                  ========================================== */}

                  <div className="professor-manual-student">

                    <div className="professor-manual-student-heading">

                      <div className="professor-manual-heading-icon">

                        <UserPlus
                          size={20}
                        />

                      </div>


                      <div>

                        <h3>
                          Add Student Manually
                        </h3>

                        <p>
                          Add a student using their CampusMate ID and registered name.
                        </p>

                      </div>

                    </div>


                    <form
                      className="professor-manual-student-form"
                      onSubmit={
                        addStudentManually
                      }
                    >

                      <div>

                        <label>
                          CampusMate ID
                        </label>

                        <input
                          type="text"
                          value={addCampusId}
                          onChange={(event) =>
                            setAddCampusId(
                              event.target.value
                                .toUpperCase()
                                .replace(
                                  /[^A-Z0-9-]/g,
                                  ""
                                )
                            )
                          }
                          placeholder="STU-2026000003"
                        />

                      </div>


                      <div>

                        <label>
                          Student Full Name
                        </label>

                        <input
                          type="text"
                          value={
                            addStudentName
                          }
                          onChange={(event) =>
                            setAddStudentName(
                              event.target.value
                            )
                          }
                          placeholder="Example: Abdu"
                        />

                      </div>


                      <button
                        type="submit"
                        disabled={
                          addingStudent
                        }
                      >

                        <UserPlus
                          size={16}
                        />

                        {addingStudent
                          ? "Adding..."
                          : "Add Student"}

                      </button>

                    </form>

                  </div>


                  {/* =========================================
                      STUDENTS
                  ========================================== */}

                  <div className="professor-class-members">

                    <div className="class-members-header">

                      <div>

                        <h3>
                          Students
                        </h3>

                        <p>
                          Students enrolled in this class.
                        </p>

                      </div>


                      <span>

                        <Users
                          size={15}
                        />

                        {selectedMembers.length}

                      </span>

                    </div>


                    {selectedMembers.length >
                      0 && (

                      <div className="class-member-search">

                        <Search
                          size={16}
                        />

                        <input
                          type="text"
                          value={
                            studentSearch
                          }
                          onChange={(event) =>
                            setStudentSearch(
                              event.target.value
                            )
                          }
                          placeholder="Search student name or CampusMate ID..."
                        />

                      </div>

                    )}


                    {selectedMembers.length ===
                    0 ? (

                      <div className="class-members-empty">

                        <UserRound
                          size={42}
                        />

                        <h4>
                          No students yet
                        </h4>

                        <p>
                          Share the join code, QR code, or add a student manually.
                        </p>

                      </div>

                    ) : (

                      <div className="class-members-table">

                        <div className="class-member-table-head">

                          <span>
                            Student
                          </span>

                          <span>
                            CampusMate ID
                          </span>

                          <span>
                            Programme
                          </span>

                          <span>
                            Joined
                          </span>

                        </div>


                        {filteredMembers.map(
                          (member) => {

                            const student =
                              getStudent(
                                member.student_id
                              );


                            return (

                              <div
                                className="class-member-row"
                                key={`${member.group_id}-${member.student_id}`}
                              >

                                <div className="class-member-person">

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


                                <span className="class-campus-id">

                                  {student?.campus_id ||
                                    "Not assigned"}

                                </span>


                                <span>

                                  {student?.programme ||
                                    "Not added"}

                                </span>


                                <span>

                                  {member.joined_at
                                    ? new Date(
                                        member.joined_at
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
                                      )
                                    : "-"}

                                </span>

                              </div>

                            );
                          }
                        )}

                      </div>

                    )}

                  </div>

                </section>

              )}

            </div>

          )}

        </div>

      </main>


      {/* =====================================================
          DELETE CONFIRMATION
      ====================================================== */}

      {showDeleteConfirm &&
        selectedGroup && (

        <div className="delete-class-overlay">

          <div className="delete-class-modal">

            <div className="delete-class-warning-icon">

              <AlertTriangle
                size={29}
              />

            </div>


            <h2>
              Delete Class?
            </h2>


            <p>
              You are about to permanently remove{" "}
              <strong>
                {selectedGroup.name}
              </strong>.
            </p>


            <div className="delete-class-warning">

              <AlertTriangle
                size={17}
              />

              <span>
                Students will no longer see this class. Related class memberships may also be removed.
              </span>

            </div>


            <div className="delete-class-modal-actions">

              <button
                type="button"
                className="delete-class-cancel"
                disabled={deleting}
                onClick={() =>
                  setShowDeleteConfirm(
                    false
                  )
                }
              >

                Cancel

              </button>


              <button
                type="button"
                className="delete-class-confirm"
                disabled={deleting}
                onClick={
                  deleteClass
                }
              >

                <Trash2
                  size={16}
                />

                {deleting
                  ? "Deleting..."
                  : "Delete Class"}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}


export default ProfessorClasses;