import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BookOpen,
  CheckCircle2,
  Edit3,
  FileText,
  FolderKanban,
  GraduationCap,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import {
  supabase,
} from "../../lib/supabase";

import ProfessorSidebar
  from "../../components/ProfessorSidebar";

import NotificationBell
  from "../../components/NotificationBell";

import "./ProfessorDashboard.css";
import "./ProfessorProjects.css";
import UserAvatar
  from "../../components/UserAvatar";

function ProfessorProjects() {
  const [
    currentUser,
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
    classMembers,
    setClassMembers,
  ] = useState([]);

  const [
    studentProfiles,
    setStudentProfiles,
  ] = useState([]);

  const [
    projects,
    setProjects,
  ] = useState([]);

  const [
    teamMembers,
    setTeamMembers,
  ] = useState([]);

  const [
    updates,
    setUpdates,
  ] = useState([]);

  const [
    files,
    setFiles,
  ] = useState([]);

  const [
    feedback,
    setFeedback,
  ] = useState([]);

  const [
    selectedProjectId,
    setSelectedProjectId,
  ] = useState("");

  const [
    classFilter,
    setClassFilter,
  ] = useState("all");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
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
  // CREATE TEAM
  // =========================================================

  const [
    showCreateTeam,
    setShowCreateTeam,
  ] = useState(false);

  const [
    createClassId,
    setCreateClassId,
  ] = useState("");

  const [
    createTitle,
    setCreateTitle,
  ] = useState("");

  const [
    createDescription,
    setCreateDescription,
  ] = useState("");

  const [
    creatingTeam,
    setCreatingTeam,
  ] = useState(false);


  // =========================================================
  // EDIT TEAM
  // =========================================================

  const [
    editingTeam,
    setEditingTeam,
  ] = useState(false);

  const [
    editTitle,
    setEditTitle,
  ] = useState("");

  const [
    editDescription,
    setEditDescription,
  ] = useState("");

  const [
    editStatus,
    setEditStatus,
  ] = useState("active");

  const [
    savingTeam,
    setSavingTeam,
  ] = useState(false);


  // =========================================================
  // ADD / REMOVE STUDENT
  // =========================================================

  const [
    selectedStudentId,
    setSelectedStudentId,
  ] = useState("");

  const [
    addingStudent,
    setAddingStudent,
  ] = useState(false);

  const [
    removingStudentId,
    setRemovingStudentId,
  ] = useState("");


  // =========================================================
  // DELETE TEAM
  // =========================================================

  const [
    deletingTeam,
    setDeletingTeam,
  ] = useState(false);


  // =========================================================
  // PERMISSION
  // =========================================================

  const [
    changingPermissionId,
    setChangingPermissionId,
  ] = useState("");


  // =========================================================
  // FEEDBACK
  // =========================================================

  const [
    feedbackDrafts,
    setFeedbackDrafts,
  ] = useState({});

  const [
    sendingFeedbackId,
    setSendingFeedbackId,
  ] = useState("");


  // =========================================================
  // INITIAL LOAD
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


    setCurrentUser(
      user
    );

    setProfile(
      profileData
    );


    await loadProfessorData(
      user.id
    );


    setLoading(false);
  }


  // =========================================================
  // LOAD EVERYTHING
  // =========================================================

  async function loadProfessorData(
    professorId
  ) {
    // -------------------------------------------------------
    // CLASSES
    // -------------------------------------------------------

    const {
      data: classData,
      error: classError,
    } =
      await supabase
        .from(
          "course_groups"
        )
        .select(
          `
          id,
          name,
          course_code,
          description,
          professor_id,
          is_active,
          allow_student_team_creation
          `
        )
        .eq(
          "professor_id",
          professorId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );


    if (classError) {
      setErrorMessage(
        "Could not load classes: " +
          classError.message
      );

      return;
    }


    const loadedClasses =
      classData || [];


    setClasses(
      loadedClasses
    );


    if (
      loadedClasses.length >
      0
    ) {
      setCreateClassId(
        (current) =>
          current ||
          loadedClasses[0].id
      );
    }


    const classIds =
      loadedClasses.map(
        (group) =>
          group.id
      );


    if (
      classIds.length ===
      0
    ) {
      clearProjectData();

      return;
    }


    // -------------------------------------------------------
    // CLASS MEMBERS
    // -------------------------------------------------------

    const {
      data: classMemberData,
      error: classMemberError,
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
        )
        .eq(
          "status",
          "active"
        );


    if (classMemberError) {
      console.error(
        classMemberError
      );
    }


    const loadedClassMembers =
      classMemberData || [];


    setClassMembers(
      loadedClassMembers
    );


    // -------------------------------------------------------
    // PROJECTS
    // -------------------------------------------------------

    const {
      data: projectData,
      error: projectError,
    } =
      await supabase
        .from(
          "project_teams"
        )
        .select("*")
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
      setErrorMessage(
        "Could not load project teams: " +
          projectError.message
      );

      return;
    }


    const loadedProjects =
      projectData || [];


    setProjects(
      loadedProjects
    );


    setSelectedProjectId(
      (current) => {
        const stillExists =
          loadedProjects.some(
            (project) =>
              project.id ===
              current
          );


        if (
          current &&
          stillExists
        ) {
          return current;
        }


        return (
          loadedProjects[0]?.id ||
          ""
        );
      }
    );


    const projectIds =
      loadedProjects.map(
        (project) =>
          project.id
      );


    if (
      projectIds.length ===
      0
    ) {
      setTeamMembers([]);
      setUpdates([]);
      setFiles([]);
      setFeedback([]);


      await loadStudentProfiles(
        loadedClassMembers
      );


      return;
    }


    // -------------------------------------------------------
    // TEAM MEMBERS
    // -------------------------------------------------------

    const {
      data: teamMemberData,
      error: teamMemberError,
    } =
      await supabase
        .from(
          "project_team_members"
        )
        .select("*")
        .in(
          "project_id",
          projectIds
        )
        .order(
          "joined_at",
          {
            ascending: true,
          }
        );


    if (teamMemberError) {
      console.error(
        teamMemberError
      );
    }


    const loadedTeamMembers =
      teamMemberData || [];


    setTeamMembers(
      loadedTeamMembers
    );


    await loadStudentProfiles(
      loadedClassMembers,
      loadedTeamMembers
    );


    // -------------------------------------------------------
    // UPDATES
    // -------------------------------------------------------

    const {
      data: updateData,
      error: updateError,
    } =
      await supabase
        .from(
          "project_updates"
        )
        .select("*")
        .in(
          "project_id",
          projectIds
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );


    if (updateError) {
      console.error(
        updateError
      );
    }


    setUpdates(
      updateData || []
    );


    // -------------------------------------------------------
    // FILES
    // -------------------------------------------------------

    const {
      data: fileData,
      error: fileError,
    } =
      await supabase
        .from(
          "project_files"
        )
        .select("*")
        .in(
          "project_id",
          projectIds
        );


    if (fileError) {
      console.error(
        fileError
      );
    }


    setFiles(
      fileData || []
    );


    // -------------------------------------------------------
    // FEEDBACK
    // -------------------------------------------------------

    const {
      data: feedbackData,
      error: feedbackError,
    } =
      await supabase
        .from(
          "project_feedback"
        )
        .select("*")
        .in(
          "project_id",
          projectIds
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );


    if (feedbackError) {
      console.error(
        feedbackError
      );
    }


    setFeedback(
      feedbackData || []
    );
  }


  function clearProjectData() {
    setProjects([]);
    setClassMembers([]);
    setStudentProfiles([]);
    setTeamMembers([]);
    setUpdates([]);
    setFiles([]);
    setFeedback([]);
    setSelectedProjectId("");
  }


  // =========================================================
  // LOAD STUDENT PROFILES
  // =========================================================

  async function loadStudentProfiles(
    loadedClassMembers = [],
    loadedTeamMembers = []
  ) {
    const ids =
      [
        ...new Set(
          [
            ...loadedClassMembers.map(
              (member) =>
                member.student_id
            ),

            ...loadedTeamMembers.map(
              (member) =>
                member.student_id
            ),
          ]
        ),
      ];


    if (
      ids.length ===
      0
    ) {
      setStudentProfiles([]);

      return;
    }


    const {
      data,
      error,
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
          ids
        );


    if (error) {
      console.error(
        error
      );

      return;
    }


    setStudentProfiles(
      data || []
    );
  }


  // =========================================================
  // REFRESH
  // =========================================================

  async function refreshPage() {
    if (!currentUser) {
      return;
    }


    setRefreshing(true);
    setMessage("");
    setErrorMessage("");


    await loadProfessorData(
      currentUser.id
    );


    setRefreshing(false);
  }


  // =========================================================
  // PERMISSION TOGGLE
  // =========================================================

  async function toggleStudentTeamCreation(
    group
  ) {
    setChangingPermissionId(
      group.id
    );

    setMessage("");
    setErrorMessage("");


    const nextValue =
      !group.allow_student_team_creation;


    const {
      error,
    } =
      await supabase
        .from(
          "course_groups"
        )
        .update({
          allow_student_team_creation:
            nextValue,
        })
        .eq(
          "id",
          group.id
        )
        .eq(
          "professor_id",
          currentUser.id
        );


    if (error) {
      setErrorMessage(
        "Could not update permission: " +
          error.message
      );

      setChangingPermissionId("");

      return;
    }


    await loadProfessorData(
      currentUser.id
    );


    setMessage(
      nextValue
        ? `Students can now create teams in ${group.name}.`
        : `Student-created teams are now disabled in ${group.name}.`
    );


    setChangingPermissionId("");
  }


  // =========================================================
  // CREATE TEAM
  // =========================================================

  async function createTeam(
    event
  ) {
    event.preventDefault();


    if (
      !createClassId ||
      !createTitle.trim()
    ) {
      setErrorMessage(
        "Choose a class and enter a project title."
      );

      return;
    }


    setCreatingTeam(true);
    setMessage("");
    setErrorMessage("");


    const {
      data,
      error,
    } =
      await supabase.rpc(
        "professor_create_project_team",
        {
          input_group_id:
            createClassId,

          input_title:
            createTitle.trim(),

          input_description:
            createDescription.trim() ||
            null,
        }
      );


    if (error) {
      setErrorMessage(
        error.message
      );

      setCreatingTeam(false);

      return;
    }


    const result =
      Array.isArray(data)
        ? data[0]
        : data;


    setCreateTitle("");
    setCreateDescription("");
    setShowCreateTeam(false);


    await loadProfessorData(
      currentUser.id
    );


    if (
      result?.project_id
    ) {
      setSelectedProjectId(
        result.project_id
      );
    }


    setMessage(
      result?.team_code
        ? `Team created. Team code: ${result.team_code}`
        : "Team created successfully."
    );


    setCreatingTeam(false);
  }


  // =========================================================
  // EDIT TEAM
  // =========================================================

  function startEditingTeam() {
    if (!selectedProject) {
      return;
    }


    setEditTitle(
      selectedProject.title ||
      ""
    );

    setEditDescription(
      selectedProject.description ||
      ""
    );

    setEditStatus(
      selectedProject.status ||
      "active"
    );

    setEditingTeam(true);
  }


  async function saveTeam(
    event
  ) {
    event.preventDefault();


    if (
      !selectedProject ||
      !editTitle.trim()
    ) {
      return;
    }


    setSavingTeam(true);
    setMessage("");
    setErrorMessage("");


    const {
      error,
    } =
      await supabase.rpc(
        "professor_update_project_team",
        {
          input_project_id:
            selectedProject.id,

          input_title:
            editTitle.trim(),

          input_description:
            editDescription.trim() ||
            null,

          input_status:
            editStatus,
        }
      );


    if (error) {
      setErrorMessage(
        error.message
      );

      setSavingTeam(false);

      return;
    }


    setEditingTeam(false);


    await loadProfessorData(
      currentUser.id
    );


    setMessage(
      "Team updated successfully."
    );


    setSavingTeam(false);
  }


  // =========================================================
  // ADD STUDENT
  // =========================================================

  async function addStudentToTeam(
    event
  ) {
    event.preventDefault();


    if (
      !selectedProject ||
      !selectedStudentId
    ) {
      setErrorMessage(
        "Choose a student first."
      );

      return;
    }


    setAddingStudent(true);
    setMessage("");
    setErrorMessage("");


    const {
      error,
    } =
      await supabase.rpc(
        "professor_add_student_to_project_team",
        {
          input_project_id:
            selectedProject.id,

          input_student_id:
            selectedStudentId,
        }
      );


    if (error) {
      setErrorMessage(
        error.message
      );

      setAddingStudent(false);

      return;
    }


    setSelectedStudentId("");


    await loadProfessorData(
      currentUser.id
    );


    setMessage(
      "Student added to team."
    );


    setAddingStudent(false);
  }


  // =========================================================
  // REMOVE STUDENT
  // =========================================================

  async function removeStudent(
    member
  ) {
    const student =
      getStudent(
        member.student_id
      );


    const confirmed =
      window.confirm(
        `Remove ${
          student?.full_name ||
          "this student"
        } from "${selectedProject.title}"?`
      );


    if (!confirmed) {
      return;
    }


    setRemovingStudentId(
      member.student_id
    );

    setMessage("");
    setErrorMessage("");


    const {
      error,
    } =
      await supabase.rpc(
        "professor_remove_student_from_project_team",
        {
          input_project_id:
            selectedProject.id,

          input_student_id:
            member.student_id,
        }
      );


    if (error) {
      setErrorMessage(
        error.message
      );

      setRemovingStudentId("");

      return;
    }


    await loadProfessorData(
      currentUser.id
    );


    setMessage(
      `${
        student?.full_name ||
        "Student"
      } removed from team.`
    );


    setRemovingStudentId("");
  }


  // =========================================================
  // DELETE TEAM
  // =========================================================

  async function deleteTeam() {
    if (!selectedProject) {
      return;
    }


    const name =
      selectedProject.title;


    const confirmed =
      window.confirm(
        `Delete "${name}" permanently?\n\nThis will remove the team and its project data. This action cannot be undone.`
      );


    if (!confirmed) {
      return;
    }


    setDeletingTeam(true);
    setMessage("");
    setErrorMessage("");


    const {
      error,
    } =
      await supabase.rpc(
        "professor_delete_project_team",
        {
          input_project_id:
            selectedProject.id,
        }
      );


    if (error) {
      setErrorMessage(
        error.message
      );

      setDeletingTeam(false);

      return;
    }


    setSelectedProjectId("");
    setEditingTeam(false);


    await loadProfessorData(
      currentUser.id
    );


    setMessage(
      `"${name}" was deleted.`
    );


    setDeletingTeam(false);
  }


  // =========================================================
  // FEEDBACK
  // =========================================================

  async function submitFeedback(
    update
  ) {
    const comment =
      (
        feedbackDrafts[
          update.id
        ] ||
        ""
      ).trim();


    if (!comment) {
      setErrorMessage(
        "Write your feedback first."
      );

      return;
    }


    setSendingFeedbackId(
      update.id
    );

    setMessage("");
    setErrorMessage("");


    const {
      error,
    } =
      await supabase
        .from(
          "project_feedback"
        )
        .insert({
          project_id:
            update.project_id,

          update_id:
            update.id,

          professor_id:
            currentUser.id,

          comment,
        });


    if (error) {
      setErrorMessage(
        "Could not send feedback: " +
          error.message
      );

      setSendingFeedbackId("");

      return;
    }


    setFeedbackDrafts(
      (current) => ({
        ...current,

        [update.id]:
          "",
      })
    );


    await loadProfessorData(
      currentUser.id
    );


    setMessage(
      "Feedback sent to student."
    );


    setSendingFeedbackId("");
  }


  // =========================================================
  // OPEN FILE
  // =========================================================

  async function openFile(
    projectFile
  ) {
    const {
      data,
      error,
    } =
      await supabase.storage
        .from(
          "project-files"
        )
        .createSignedUrl(
          projectFile.file_path,
          300
        );


    if (
      error ||
      !data?.signedUrl
    ) {
      setErrorMessage(
        "Could not open file."
      );

      return;
    }


    window.open(
      data.signedUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }


  // =========================================================
  // HELPERS
  // =========================================================

  function getClass(
    groupId
  ) {
    return classes.find(
      (group) =>
        group.id ===
        groupId
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


  function formatDate(
    date
  ) {
    if (!date) {
      return "-";
    }


    return new Date(
      date
    ).toLocaleString(
      "en-GB",
      {
        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    );
  }


  // =========================================================
  // SELECTED PROJECT
  // =========================================================

  const selectedProject =
    projects.find(
      (project) =>
        project.id ===
        selectedProjectId
    );


  const selectedMembers =
    teamMembers.filter(
      (member) =>
        member.project_id ===
        selectedProjectId
    );


  const selectedUpdates =
    updates.filter(
      (update) =>
        update.project_id ===
        selectedProjectId
    );


  const selectedClass =
    selectedProject
      ? getClass(
          selectedProject.group_id
        )
      : null;


  // =========================================================
  // AVAILABLE STUDENTS
  // =========================================================

  const availableStudents =
    selectedProject
      ? classMembers
          .filter(
            (member) =>
              member.group_id ===
              selectedProject.group_id
          )
          .filter(
            (member) =>
              !selectedMembers.some(
                (teamMember) =>
                  teamMember.student_id ===
                  member.student_id
              )
          )
          .map(
            (member) =>
              getStudent(
                member.student_id
              )
          )
          .filter(Boolean)
      : [];


  // =========================================================
  // FILTERED PROJECTS
  // =========================================================

  const filteredProjects =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();


        return projects.filter(
          (project) => {
            const group =
              classes.find(
                (item) =>
                  item.id ===
                  project.group_id
              );


            const classMatches =
              classFilter ===
              "all"
                ||
              project.group_id ===
              classFilter;


            const searchMatches =
              !query
              ||
              project.title
                ?.toLowerCase()
                .includes(query)
              ||
              project.team_code
                ?.toLowerCase()
                .includes(query)
              ||
              group?.name
                ?.toLowerCase()
                .includes(query)
              ||
              group?.course_code
                ?.toLowerCase()
                .includes(query);


            return (
              classMatches &&
              searchMatches
            );
          }
        );
      },
      [
        projects,
        classes,
        classFilter,
        search,
      ]
    );


  // =========================================================
  // PROGRESS
  // =========================================================

  const averageProgress =
    selectedUpdates.length ===
    0
      ? 0
      : Math.round(
          selectedUpdates.reduce(
            (
              total,
              update
            ) =>
              total +
              Number(
                update.progress_percent ||
                0
              ),
            0
          )
          /
          selectedUpdates.length
        );


  const professorName =
    profile?.full_name ||
    "Professor";




  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="prof-project-loading">

        <GraduationCap
          size={48}
        />

        <p>
          Loading group projects...
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

        {/* TOP BAR */}

        <header className="professor-topbar">

          <div className="professor-search">

            <Search
              size={18}
            />

            <input
              value={
                search
              }
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search project teams..."
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


        <div className="prof-project-content">

          {/* PAGE HEADER */}

          <div className="prof-project-header">

            <div>

              <h1>
                Group Projects
              </h1>

              <p>
                Create teams, manage students, control student team creation and review progress.
              </p>

            </div>


            <div className="prof-project-header-actions">

              <button
                type="button"
                className="prof-project-refresh"
                onClick={
                  refreshPage
                }
                disabled={
                  refreshing
                }
              >

                <RefreshCw
                  size={17}
                  className={
                    refreshing
                      ? "prof-spin"
                      : ""
                  }
                />

                Refresh

              </button>


              <button
                type="button"
                className="prof-project-create"
                onClick={() =>
                  setShowCreateTeam(
                    true
                  )
                }
                disabled={
                  classes.length ===
                  0
                }
              >

                <Plus
                  size={17}
                />

                Create Team

              </button>

            </div>

          </div>


          {message && (

            <div className="prof-project-success">

              <CheckCircle2
                size={17}
              />

              {message}

            </div>

          )}


          {errorMessage && (

            <div className="prof-project-error">

              {errorMessage}

            </div>

          )}


          {/* CLASS TEAM PERMISSIONS */}

          <section className="prof-team-permissions">

            <div className="prof-section-heading">

              <div>

                <h2>
                  Student Team Creation
                </h2>

                <p>
                  Decide whether students may freely create teams in each class.
                </p>

              </div>


              <Settings2
                size={20}
              />

            </div>


            {classes.length ===
            0 ? (

              <div className="prof-project-empty-small">
                No classes available.
              </div>

            ) : (

              <div className="prof-permission-grid">

                {classes.map(
                  (group) => (

                    <div
                      className="prof-permission-card"
                      key={
                        group.id
                      }
                    >

                      <div>

                        <strong>
                          {group.name}
                        </strong>

                        <small>
                          {group.course_code ||
                            "No course code"}
                        </small>

                      </div>


                      <button
                        type="button"
                        className={
                          group.allow_student_team_creation
                            ? "permission-on"
                            : "permission-off"
                        }
                        disabled={
                          changingPermissionId ===
                          group.id
                        }
                        onClick={() =>
                          toggleStudentTeamCreation(
                            group
                          )
                        }
                      >

                        {changingPermissionId ===
                        group.id
                          ? "Saving..."
                          : group.allow_student_team_creation
                            ? "ON"
                            : "OFF"}

                      </button>

                    </div>

                  )
                )}

              </div>

            )}

          </section>


          {/* FILTER */}

          <div className="prof-project-toolbar">

            <BookOpen
              size={17}
            />

            <select
              value={
                classFilter
              }
              onChange={(event) => {
                setClassFilter(
                  event.target.value
                );

                setSelectedProjectId(
                  ""
                );
              }}
            >

              <option value="all">
                All Classes
              </option>

              {classes.map(
                (group) => (

                  <option
                    key={
                      group.id
                    }
                    value={
                      group.id
                    }
                  >

                    {group.course_code
                      ? `${group.course_code} — ${group.name}`
                      : group.name}

                  </option>

                )
              )}

            </select>

          </div>


          {/* MAIN */}

          {filteredProjects.length ===
          0 ? (

            <div className="prof-project-empty">

              <FolderKanban
                size={50}
              />

              <h2>
                No project teams
              </h2>

              <p>
                Create a project team or allow your students to create their own.
              </p>

            </div>

          ) : (

            <div className="prof-project-layout">

              {/* TEAM LIST */}

              <aside className="prof-project-list-card">

                <div className="prof-project-list-heading">

                  <h2>
                    Teams
                  </h2>

                  <span>
                    {filteredProjects.length}
                  </span>

                </div>


                <div className="prof-project-list">

                  {filteredProjects.map(
                    (project) => {

                      const group =
                        getClass(
                          project.group_id
                        );


                      const memberCount =
                        teamMembers.filter(
                          (member) =>
                            member.project_id ===
                            project.id
                        ).length;


                      return (

                        <button
                          type="button"
                          key={
                            project.id
                          }
                          className={`prof-project-list-item ${
                            selectedProjectId ===
                            project.id
                              ? "active"
                              : ""
                          }`}
                          onClick={() => {
                            setSelectedProjectId(
                              project.id
                            );

                            setEditingTeam(
                              false
                            );

                            setSelectedStudentId(
                              ""
                            );
                          }}
                        >

                          <span className="prof-project-list-icon">

                            <FolderKanban
                              size={18}
                            />

                          </span>


                          <span className="prof-project-list-info">

                            <strong>
                              {project.title}
                            </strong>

                            <small>
                              {group?.name ||
                                "Class"}
                            </small>

                            <small>

                              <Users
                                size={11}
                              />

                              {memberCount} members

                            </small>

                          </span>


                          <span
                            className={
                              project.status ===
                              "completed"
                                ? "prof-status completed"
                                : "prof-status active"
                            }
                          >

                            {project.status ===
                            "completed"
                              ? "Completed"
                              : "Active"}

                          </span>

                        </button>

                      );
                    }
                  )}

                </div>

              </aside>


              {/* SELECTED TEAM */}

              {selectedProject ? (

                <section className="prof-selected-project">

                  <div className="prof-selected-project-header">

                    <div>

                      <h2>
                        {selectedProject.title}
                      </h2>

                      <p>

                        {selectedClass?.course_code
                          ? `${selectedClass.course_code} — ${selectedClass.name}`
                          : selectedClass?.name ||
                            "Class"}

                      </p>


                      <span className="prof-team-code">
                        Team Code:{" "}
                        <strong>
                          {selectedProject.team_code}
                        </strong>
                      </span>

                    </div>


                    <div className="prof-project-management-actions">

                      <button
                        type="button"
                        className="edit"
                        onClick={
                          startEditingTeam
                        }
                      >

                        <Edit3
                          size={15}
                        />

                        Edit

                      </button>


                      <button
                        type="button"
                        className="delete"
                        onClick={
                          deleteTeam
                        }
                        disabled={
                          deletingTeam
                        }
                      >

                        <Trash2
                          size={15}
                        />

                        {deletingTeam
                          ? "Deleting..."
                          : "Delete"}

                      </button>

                    </div>

                  </div>


                  {selectedProject.description && (
                    <div className="prof-project-description">
                      {selectedProject.description}
                    </div>
                  )}


                  {/* EDIT */}

                  {editingTeam && (

                    <form
                      className="prof-project-edit-form"
                      onSubmit={
                        saveTeam
                      }
                    >

                      <div className="prof-edit-header">

                        <h3>
                          Edit Team
                        </h3>

                        <button
                          type="button"
                          onClick={() =>
                            setEditingTeam(
                              false
                            )
                          }
                        >

                          <X
                            size={17}
                          />

                        </button>

                      </div>


                      <label>
                        Project Title
                      </label>

                      <input
                        value={
                          editTitle
                        }
                        onChange={(event) =>
                          setEditTitle(
                            event.target.value
                          )
                        }
                      />


                      <label>
                        Description
                      </label>

                      <textarea
                        rows={4}
                        value={
                          editDescription
                        }
                        onChange={(event) =>
                          setEditDescription(
                            event.target.value
                          )
                        }
                      />


                      <label>
                        Status
                      </label>

                      <select
                        value={
                          editStatus
                        }
                        onChange={(event) =>
                          setEditStatus(
                            event.target.value
                          )
                        }
                      >

                        <option value="active">
                          Active
                        </option>

                        <option value="completed">
                          Completed
                        </option>

                      </select>


                      <button
                        type="submit"
                        className="prof-save-team"
                        disabled={
                          savingTeam
                        }
                      >

                        <Save
                          size={15}
                        />

                        {savingTeam
                          ? "Saving..."
                          : "Save Changes"}

                      </button>

                    </form>

                  )}


                  {/* MEMBERS */}

                  <section className="prof-team-section">

                    <div className="prof-section-heading">

                      <div>

                        <h2>
                          Team Members
                        </h2>

                        <p>
                          Add or remove students enrolled in this class.
                        </p>

                      </div>

                      <Users
                        size={20}
                      />

                    </div>


                    <form
                      className="prof-add-student-form"
                      onSubmit={
                        addStudentToTeam
                      }
                    >

                      <select
                        value={
                          selectedStudentId
                        }
                        onChange={(event) =>
                          setSelectedStudentId(
                            event.target.value
                          )
                        }
                      >

                        <option value="">
                          Select student...
                        </option>

                        {availableStudents.map(
                          (student) => (

                            <option
                              key={
                                student.id
                              }
                              value={
                                student.id
                              }
                            >

                              {student.full_name}

                              {student.campus_id
                                ? ` — ${student.campus_id}`
                                : ""}

                            </option>

                          )
                        )}

                      </select>


                      <button
                        type="submit"
                        disabled={
                          addingStudent ||
                          !selectedStudentId
                        }
                      >

                        <UserPlus
                          size={15}
                        />

                        {addingStudent
                          ? "Adding..."
                          : "Add Student"}

                      </button>

                    </form>


                    {selectedMembers.length ===
                    0 ? (

                      <div className="prof-project-empty-small">
                        No students assigned to this team.
                      </div>

                    ) : (

                      <div className="prof-team-members">

                        {selectedMembers.map(
                          (member) => {

                            const student =
                              getStudent(
                                member.student_id
                              );


                            return (

                              <div
                                className="prof-team-member"
                                key={
                                  member.id
                                }
                              >

                                <div className="prof-team-member-avatar">

                                  {student
                                    ?.full_name
                                    ?.charAt(0)
                                    .toUpperCase() ||
                                    "S"}

                                </div>


                                <div>

                                  <strong>
                                    {student?.full_name ||
                                      "Student"}
                                  </strong>

                                  <small>
                                    {student?.campus_id ||
                                      "No CampusMate ID"}
                                  </small>

                                  <small>
                                    {member.member_role ||
                                      "member"}
                                  </small>

                                </div>


                                <button
                                  type="button"
                                  onClick={() =>
                                    removeStudent(
                                      member
                                    )
                                  }
                                  disabled={
                                    removingStudentId ===
                                    member.student_id
                                  }
                                >

                                  <Trash2
                                    size={14}
                                  />

                                  {removingStudentId ===
                                  member.student_id
                                    ? "Removing..."
                                    : "Remove"}

                                </button>

                              </div>

                            );
                          }
                        )}

                      </div>

                    )}

                  </section>


                  {/* PROGRESS */}

                  <section className="prof-team-section">

                    <div className="prof-section-heading">

                      <div>

                        <h2>
                          Team Progress
                        </h2>

                        <p>
                          Review student contributions and give feedback.
                        </p>

                      </div>


                      <strong className="prof-average-progress">
                        {averageProgress}%
                      </strong>

                    </div>


                    {selectedUpdates.length ===
                    0 ? (

                      <div className="prof-project-empty-small">
                        No progress updates yet.
                      </div>

                    ) : (

                      <div className="prof-update-list">

                        {selectedUpdates.map(
                          (update) => {

                            const student =
                              getStudent(
                                update.student_id
                              );


                            const updateFiles =
                              files.filter(
                                (file) =>
                                  file.update_id ===
                                  update.id
                              );


                            const updateFeedback =
                              feedback.filter(
                                (item) =>
                                  item.update_id ===
                                  update.id
                              );


                            return (

                              <article
                                className="prof-update-card"
                                key={
                                  update.id
                                }
                              >

                                <div className="prof-update-top">

                                  <div>

                                    <strong>
                                      {student?.full_name ||
                                        "Student"}
                                    </strong>

                                    <small>

                                      {student?.campus_id ||
                                        ""}

                                      {student?.campus_id
                                        ? " • "
                                        : ""}

                                      {formatDate(
                                        update.created_at
                                      )}

                                    </small>

                                  </div>


                                  <span>
                                    {update.progress_percent}%
                                  </span>

                                </div>


                                <h3>
                                  {update.title}
                                </h3>


                                {update.update_text && (
                                  <p>
                                    {update.update_text}
                                  </p>
                                )}


                                <div className="prof-progress-bar">

                                  <div
                                    style={{
                                      width:
                                        `${update.progress_percent}%`,
                                    }}
                                  />

                                </div>


                                {updateFiles.length >
                                  0 && (

                                  <div className="prof-project-files">

                                    {updateFiles.map(
                                      (projectFile) => (

                                        <button
                                          type="button"
                                          key={
                                            projectFile.id
                                          }
                                          onClick={() =>
                                            openFile(
                                              projectFile
                                            )
                                          }
                                        >

                                          <FileText
                                            size={15}
                                          />

                                          {projectFile.file_name}

                                        </button>

                                      )
                                    )}

                                  </div>

                                )}


                                {updateFeedback.length >
                                  0 && (

                                  <div className="prof-existing-feedback">

                                    <strong>
                                      Previous Feedback
                                    </strong>

                                    {updateFeedback.map(
                                      (item) => (

                                        <div
                                          key={
                                            item.id
                                          }
                                        >

                                          <p>
                                            {item.comment}
                                          </p>

                                          <small>
                                            {formatDate(
                                              item.created_at
                                            )}
                                          </small>

                                        </div>

                                      )
                                    )}

                                  </div>

                                )}


                                <div className="prof-feedback-form">

                                  <MessageSquare
                                    size={16}
                                  />

                                  <textarea
                                    rows={2}
                                    value={
                                      feedbackDrafts[
                                        update.id
                                      ] ||
                                      ""
                                    }
                                    onChange={(event) =>
                                      setFeedbackDrafts(
                                        (current) => ({
                                          ...current,

                                          [update.id]:
                                            event.target.value,
                                        })
                                      )
                                    }
                                    placeholder="Write feedback for this student..."
                                  />


                                  <button
                                    type="button"
                                    onClick={() =>
                                      submitFeedback(
                                        update
                                      )
                                    }
                                    disabled={
                                      sendingFeedbackId ===
                                      update.id
                                    }
                                  >

                                    <Send
                                      size={14}
                                    />

                                    {sendingFeedbackId ===
                                    update.id
                                      ? "Sending..."
                                      : "Send"}

                                  </button>

                                </div>

                              </article>

                            );
                          }
                        )}

                      </div>

                    )}

                  </section>

                </section>

              ) : (

                <div className="prof-project-empty">
                  Select a team.
                </div>

              )}

            </div>

          )}

        </div>

      </main>


      {/* CREATE TEAM MODAL */}

      {showCreateTeam && (

        <div className="prof-project-modal-overlay">

          <div className="prof-project-modal">

            <div className="prof-project-modal-header">

              <div>

                <h2>
                  Create Project Team
                </h2>

                <p>
                  Create a professor-managed team for one of your classes.
                </p>

              </div>


              <button
                type="button"
                onClick={() =>
                  setShowCreateTeam(
                    false
                  )
                }
              >

                <X
                  size={18}
                />

              </button>

            </div>


            <form
              onSubmit={
                createTeam
              }
              className="prof-project-modal-form"
            >

              <label>
                Class
              </label>

              <select
                value={
                  createClassId
                }
                onChange={(event) =>
                  setCreateClassId(
                    event.target.value
                  )
                }
                required
              >

                {classes.map(
                  (group) => (

                    <option
                      key={
                        group.id
                      }
                      value={
                        group.id
                      }
                    >

                      {group.course_code
                        ? `${group.course_code} — ${group.name}`
                        : group.name}

                    </option>

                  )
                )}

              </select>


              <label>
                Project Title
              </label>

              <input
                value={
                  createTitle
                }
                onChange={(event) =>
                  setCreateTitle(
                    event.target.value
                  )
                }
                placeholder="Example: Campus Navigation System"
                required
              />


              <label>
                Description
              </label>

              <textarea
                rows={4}
                value={
                  createDescription
                }
                onChange={(event) =>
                  setCreateDescription(
                    event.target.value
                  )
                }
                placeholder="Project description..."
              />


              <button
                type="submit"
                disabled={
                  creatingTeam
                }
              >

                <Plus
                  size={16}
                />

                {creatingTeam
                  ? "Creating..."
                  : "Create Team"}

              </button>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}


export default ProfessorProjects;