import {

  useEffect,

  useMemo,

  useState,

} from "react";



import {


  CheckCircle2,

  Copy,

  Crown,

  Edit3,

  File,

  FileText,

  FolderKanban,

  Hash,

  Lock,

  LogOut,

  MessageSquare,

  Plus,

  RefreshCw,

  Save,

  Search,

  Send,

  Trash2,

  Upload,

  Users,

  X,

} from "lucide-react";



import {

  supabase,

} from "../lib/supabase";



import Sidebar

  from "../components/Sidebar";



import NotificationBell

  from "../components/NotificationBell";

import UserAvatar

  from "../components/UserAvatar";

import "./Projects.css";





// Unique prefix for uploaded file names (kept outside the component
// so React does not treat it as part of rendering).
function uniquePrefix() {
  return Date.now();
}


function Projects() {

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

    projects,

    setProjects,

  ] = useState([]);



  const [

    projectMembers,

    setProjectMembers,

  ] = useState([]);



  const [

    memberProfiles,

    setMemberProfiles,

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

    showCreateTeam,

    setShowCreateTeam,

  ] = useState(false);



  const [

    createClassId,

    setCreateClassId,

  ] = useState("");



  const [

    projectTitle,

    setProjectTitle,

  ] = useState("");



  const [

    projectDescription,

    setProjectDescription,

  ] = useState("");



  const [

    creatingTeam,

    setCreatingTeam,

  ] = useState(false);



  const [

    showJoinTeam,

    setShowJoinTeam,

  ] = useState(false);



  const [

    teamCode,

    setTeamCode,

  ] = useState("");



  const [

    joiningTeam,

    setJoiningTeam,

  ] = useState(false);



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

    savingTeam,

    setSavingTeam,

  ] = useState(false);



  const [

    removingMemberId,

    setRemovingMemberId,

  ] = useState("");



  const [

    leavingTeam,

    setLeavingTeam,

  ] = useState(false);



  const [

    deletingTeam,

    setDeletingTeam,

  ] = useState(false);



  const [

    changingStatus,

    setChangingStatus,

  ] = useState(false);



  const [

    updateTitle,

    setUpdateTitle,

  ] = useState("");



  const [

    updateText,

    setUpdateText,

  ] = useState("");



  const [

    progressPercent,

    setProgressPercent,

  ] = useState(0);



  const [

    selectedFiles,

    setSelectedFiles,

  ] = useState([]);



  const [

    postingUpdate,

    setPostingUpdate,

  ] = useState(false);



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

      error,

    } =

      await supabase.auth.getUser();





    if (

      error ||

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





    setProfile(

      profileData

    );





    await loadClasses(

      user.id

    );



    await loadProjects(

      user.id

    );





    setLoading(false);

  }





  async function loadClasses(

    studentId

  ) {

    const {

      data: membershipData,

      error,

    } =

      await supabase

        .from(

          "course_group_members"

        )

        .select(

          `

          group_id,

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

        );





    if (error) {

      console.error(

        error

      );



      return;

    }





    const ids =

      (

        membershipData ||

        []

      ).map(

        (item) =>

          item.group_id

      );





    if (

      ids.length ===

      0

    ) {

      setClasses([]);



      return;

    }





    const {

      data,

      error: groupError,

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

          professor_id,

          is_active,

          allow_student_team_creation

          `

        )

        .in(

          "id",

          ids

        );





    if (groupError) {

      console.error(

        groupError

      );



      return;

    }





    const loaded =

      data || [];





    setClasses(

      loaded

    );





    const firstAllowed =

      loaded.find(

        (group) =>

          group.allow_student_team_creation

          &&

          group.is_active

      );





    setCreateClassId(

      firstAllowed?.id ||

      ""

    );

  }





  async function loadProjects(

    studentId

  ) {

    const {

      data: memberships,

      error,

    } =

      await supabase

        .from(

          "project_team_members"

        )

        .select("*")

        .eq(

          "student_id",

          studentId

        );





    if (error) {

      setErrorMessage(

        error.message

      );



      return;

    }





    const projectIds =

      (

        memberships ||

        []

      ).map(

        (item) =>

          item.project_id

      );





    if (

      projectIds.length ===

      0

    ) {

      setProjects([]);

      setProjectMembers([]);

      setMemberProfiles([]);

      setUpdates([]);

      setFiles([]);

      setFeedback([]);

      setSelectedProjectId("");



      return;

    }





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

          "id",

          projectIds

        )

        .order(

          "created_at",

          {

            ascending: false,

          }

        );





    if (projectError) {

      setErrorMessage(

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

        if (

          loadedProjects.some(

            (project) =>

              project.id ===

              current

          )

        ) {

          return current;

        }





        return (

          loadedProjects[0]?.id ||

          ""

        );

      }

    );





    await loadDetails(

      projectIds

    );

  }





  async function loadDetails(

    projectIds

  ) {

    const {

      data: members,

    } =

      await supabase

        .from(

          "project_team_members"

        )

        .select("*")

        .in(

          "project_id",

          projectIds

        );





    const loadedMembers =

      members || [];





    setProjectMembers(

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

      studentIds.length >

      0

    ) {

      const {

        data: profiles,

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





      setMemberProfiles(

        profiles || []

      );

    }





    const {

      data: updateData,

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





    setUpdates(

      updateData || []

    );





    const {

      data: fileData,

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





    setFiles(

      fileData || []

    );





    const {

      data: feedbackData,

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





    setFeedback(

      feedbackData || []

    );

  }





  async function refreshProjects() {

    if (!currentUser) {

      return;

    }





    setRefreshing(true);



    await loadClasses(

      currentUser.id

    );



    await loadProjects(

      currentUser.id

    );



    setRefreshing(false);

  }





  // =========================================================

  // ALLOWED CLASSES

  // =========================================================



  const classesAllowingCreation =

    classes.filter(

      (group) =>

        group.allow_student_team_creation

        &&

        group.is_active

    );





  // =========================================================

  // CREATE

  // =========================================================



  async function createTeam(

    event

  ) {

    event.preventDefault();





    if (

      !createClassId ||

      !projectTitle.trim()

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

        "create_project_team",

        {

          input_group_id:

            createClassId,



          input_title:

            projectTitle.trim(),



          input_description:

            projectDescription.trim() ||

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





    setProjectTitle("");

    setProjectDescription("");

    setShowCreateTeam(false);





    await loadProjects(

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

        : "Team created."

    );





    setCreatingTeam(false);

  }





  // =========================================================

  // JOIN

  // =========================================================



  async function joinTeam(

    event

  ) {

    event.preventDefault();





    const code =

      teamCode

        .trim()

        .toUpperCase();





    if (!code) {

      return;

    }





    setJoiningTeam(true);

    setMessage("");

    setErrorMessage("");





    const {

      error,

    } =

      await supabase.rpc(

        "join_project_team",

        {

          input_team_code:

            code,

        }

      );





    if (error) {

      setErrorMessage(

        error.message

      );



      setJoiningTeam(false);



      return;

    }





    setTeamCode("");

    setShowJoinTeam(false);





    await loadProjects(

      currentUser.id

    );





    setMessage(

      "You joined the team."

    );





    setJoiningTeam(false);

  }





  // =========================================================

  // EDIT

  // =========================================================



  function startEditingTeam() {

    setEditTitle(

      selectedProject.title ||

      ""

    );



    setEditDescription(

      selectedProject.description ||

      ""

    );



    setEditingTeam(true);

  }





  async function saveTeam(

    event

  ) {

    event.preventDefault();





    setSavingTeam(true);

    setMessage("");

    setErrorMessage("");





    const {

      error,

    } =

      await supabase

        .from(

          "project_teams"

        )

        .update({

          title:

            editTitle.trim(),



          description:

            editDescription.trim() ||

            null,



          updated_at:

            new Date()

              .toISOString(),

        })

        .eq(

          "id",

          selectedProject.id

        )

        .eq(

          "created_by",

          currentUser.id

        );





    if (error) {

      setErrorMessage(

        error.message

      );



      setSavingTeam(false);



      return;

    }





    setEditingTeam(false);





    await loadProjects(

      currentUser.id

    );





    setMessage(

      "Project updated."

    );





    setSavingTeam(false);

  }





  // =========================================================

  // STATUS

  // =========================================================



  async function toggleProjectStatus() {

    const next =

      selectedProject.status ===

      "completed"

        ? "active"

        : "completed";





    setChangingStatus(true);





    const {

      error,

    } =

      await supabase

        .from(

          "project_teams"

        )

        .update({

          status:

            next,



          updated_at:

            new Date()

              .toISOString(),

        })

        .eq(

          "id",

          selectedProject.id

        )

        .eq(

          "created_by",

          currentUser.id

        );





    if (error) {

      setErrorMessage(

        error.message

      );



      setChangingStatus(false);



      return;

    }





    await loadProjects(

      currentUser.id

    );





    setMessage(

      next ===

      "completed"

        ? "Project completed."

        : "Project reopened."

    );





    setChangingStatus(false);

  }





  // =========================================================

  // REMOVE MEMBER

  // =========================================================



  async function removeMember(

    member

  ) {

    const student =

      getMemberProfile(

        member.student_id

      );





    if (

      !window.confirm(

        `Remove ${

          student?.full_name ||

          "this student"

        } from the team?`

      )

    ) {

      return;

    }





    setRemovingMemberId(

      member.student_id

    );





    const {

      error,

    } =

      await supabase.rpc(

        "remove_project_team_member",

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



      setRemovingMemberId("");



      return;

    }





    await loadProjects(

      currentUser.id

    );





    setMessage(

      "Student removed."

    );





    setRemovingMemberId("");

  }





  // =========================================================

  // LEAVE

  // =========================================================



  async function leaveTeam() {

    if (

      !window.confirm(

        `Leave "${selectedProject.title}"?`

      )

    ) {

      return;

    }





    setLeavingTeam(true);





    const {

      error,

    } =

      await supabase.rpc(

        "leave_project_team",

        {

          input_project_id:

            selectedProject.id,

        }

      );





    if (error) {

      setErrorMessage(

        error.message

      );



      setLeavingTeam(false);



      return;

    }





    setSelectedProjectId("");





    await loadProjects(

      currentUser.id

    );





    setMessage(

      "You left the team."

    );





    setLeavingTeam(false);

  }





  // =========================================================

  // DELETE

  // =========================================================



  async function deleteTeam() {

    if (

      !window.confirm(

        `Delete "${selectedProject.title}" permanently?`

      )

    ) {

      return;

    }





    setDeletingTeam(true);





    const projectPaths =

      files

        .filter(

          (file) =>

            file.project_id ===

            selectedProject.id

        )

        .map(

          (file) =>

            file.file_path

        )

        .filter(Boolean);





    if (

      projectPaths.length >

      0

    ) {

      await supabase.storage

        .from(

          "project-files"

        )

        .remove(

          projectPaths

        );

    }





    const {

      error,

    } =

      await supabase.rpc(

        "delete_project_team",

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





    await loadProjects(

      currentUser.id

    );





    setMessage(

      "Team deleted."

    );





    setDeletingTeam(false);

  }





  // =========================================================

  // POST UPDATE

  // =========================================================



  async function postUpdate(

    event

  ) {

    event.preventDefault();





    if (

      !updateTitle.trim()

    ) {

      setErrorMessage(

        "Enter an update title."

      );



      return;

    }





    setPostingUpdate(true);

    setMessage("");

    setErrorMessage("");





    const {

      data: newUpdate,

      error,

    } =

      await supabase

        .from(

          "project_updates"

        )

        .insert({

          project_id:

            selectedProject.id,



          student_id:

            currentUser.id,



          title:

            updateTitle.trim(),



          update_text:

            updateText.trim() ||

            null,



          progress_percent:

            Number(

              progressPercent

            ),

        })

        .select()

        .single();





    if (error) {

      setErrorMessage(

        error.message

      );



      setPostingUpdate(false);



      return;

    }





    for (

      const uploadFile

      of selectedFiles

    ) {

      const safeName =

        uploadFile.name.replace(

          /[^a-zA-Z0-9._-]/g,

          "_"

        );





      const path =

        `${selectedProject.id}/` +

        `${currentUser.id}/` +

        `${uniquePrefix()}-${safeName}`;





      const {

        error: uploadError,

      } =

        await supabase.storage

          .from(

            "project-files"

          )

          .upload(

            path,

            uploadFile

          );





      if (uploadError) {

        continue;

      }





      await supabase

        .from(

          "project_files"

        )

        .insert({

          project_id:

            selectedProject.id,



          update_id:

            newUpdate.id,



          uploaded_by:

            currentUser.id,



          file_name:

            uploadFile.name,



          file_path:

            path,



          mime_type:

            uploadFile.type ||

            null,



          file_size:

            uploadFile.size,

        });

    }





    setUpdateTitle("");

    setUpdateText("");

    setProgressPercent(0);

    setSelectedFiles([]);





    await loadProjects(

      currentUser.id

    );





    setMessage(

      "Progress update posted."

    );





    setPostingUpdate(false);

  }





  function handleFiles(

    event

  ) {

    const allowed =

      [

        ".pdf",

        ".ppt",

        ".pptx",

        ".doc",

        ".docx",

      ];





    const chosen =

      Array.from(

        event.target.files ||

        []

      ).filter(

        (file) =>

          allowed.some(

            (extension) =>

              file.name

                .toLowerCase()

                .endsWith(

                  extension

                )

          )

          &&

          file.size <=

            15 *

            1024 *

            1024

      );





    setSelectedFiles(

      chosen

    );

  }





  async function openProjectFile(

    file

  ) {

    const {

      data,

    } =

      await supabase.storage

        .from(

          "project-files"

        )

        .createSignedUrl(

          file.file_path,

          300

        );





    if (

      data?.signedUrl

    ) {

      window.open(

        data.signedUrl,

        "_blank"

      );

    }

  }





  async function copyTeamCode(

    code

  ) {

    await navigator.clipboard

      .writeText(

        code

      );





    setMessage(

      "Team code copied."

    );

  }





  function getClass(

    id

  ) {

    return classes.find(

      (group) =>

        group.id === id

    );

  }





  function getMemberProfile(

    id

  ) {

    return memberProfiles.find(

      (student) =>

        student.id === id

    );

  }





  function formatDate(

    value

  ) {

    return new Date(

      value

    ).toLocaleString(

      "en-GB"

    );

  }





  const selectedProject =

    projects.find(

      (project) =>

        project.id ===

        selectedProjectId

    );





  const selectedMembers =

    projectMembers.filter(

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





  const isTeamLeader =

    Boolean(

      selectedProject &&

      currentUser &&

      selectedProject.created_by ===

        currentUser.id

    );





  /*

    Important:

    A professor-created team has created_by = professor ID.

    Therefore a student is NOT considered its leader.

  */





  const filteredProjects =

    useMemo(

      () => {

        const query =

          search

            .toLowerCase()

            .trim();





        if (!query) {

          return projects;

        }





        return projects.filter(

          (project) =>

            project.title

              ?.toLowerCase()

              .includes(

                query

              )

            ||

            project.team_code

              ?.toLowerCase()

              .includes(

                query

              )

        );

      },

      [

        projects,

        search,

      ]

    );





  const averageProgress =

    selectedUpdates.length ===

    0

      ? 0

      : Math.round(

          selectedUpdates.reduce(

            (

              sum,

              item

            ) =>

              sum +

              Number(

                item.progress_percent ||

                0

              ),

            0

          )

          /

          selectedUpdates.length

        );





  const fullName =

    profile?.full_name ||

    "Student";










  if (loading) {

    return (

      <div className="student-project-loading">



        <FolderKanban

          size={48}

        />



        <p>

          Loading projects...

        </p>



      </div>

    );

  }





  return (

    <div className="student-project-page">



      <Sidebar />





      <main className="student-project-main">



        <header className="student-project-topbar">



          <div className="student-project-search">



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

              placeholder="Search group projects..."

            />



          </div>





          <div className="student-project-profile">



            <NotificationBell />





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

                Student

              </small>



            </div>



          </div>



        </header>





        <div className="student-project-content">



          <div className="student-project-header">



            <div>



              <h1>

                Group Projects

              </h1>



              <p>

                Work with your classmates and keep your professor updated.

              </p>



            </div>





            <div className="student-project-header-actions">



              <button

                type="button"

                className="refresh"

                onClick={

                  refreshProjects

                }

              >



                <RefreshCw

                  size={17}

                  className={

                    refreshing

                      ? "student-spin"

                      : ""

                  }

                />



                Refresh



              </button>





              <button

                type="button"

                className="join"

                onClick={() =>

                  setShowJoinTeam(

                    true

                  )

                }

              >



                <Hash

                  size={17}

                />



                Join Team



              </button>





              <button

                type="button"

                className="create"

                disabled={

                  classesAllowingCreation.length ===

                  0

                }

                onClick={() =>

                  setShowCreateTeam(

                    true

                  )

                }

              >



                {classesAllowingCreation.length ===

                0 ? (

                  <Lock

                    size={17}

                  />

                ) : (

                  <Plus

                    size={17}

                  />

                )}



                Create Team



              </button>



            </div>



          </div>





          {message && (

            <div className="student-project-success">

              {message}

            </div>

          )}





          {errorMessage && (

            <div className="student-project-error">

              {errorMessage}

            </div>

          )}





          {classes.length >

            0 &&

            classesAllowingCreation.length ===

              0 && (



            <div className="student-project-warning">



              <Lock

                size={17}

              />



              Your professor currently controls team creation. You can still work in or join existing teams.



            </div>



          )}





          <section className="student-project-stats">



            <div>



              <span className="blue">

                <FolderKanban />

              </span>



              <div>



                <strong>

                  {projects.length}

                </strong>



                <small>

                  My Teams

                </small>



              </div>



            </div>





            <div>



              <span className="green">

                <Users />

              </span>



              <div>



                <strong>

                  {selectedMembers.length}

                </strong>



                <small>

                  Team Members

                </small>



              </div>



            </div>





            <div>



              <span className="purple">

                <FileText />

              </span>



              <div>



                <strong>

                  {selectedUpdates.length}

                </strong>



                <small>

                  Updates

                </small>



              </div>



            </div>





            <div>



              <span className="orange">

                <CheckCircle2 />

              </span>



              <div>



                <strong>

                  {averageProgress}%

                </strong>



                <small>

                  Progress

                </small>



              </div>



            </div>



          </section>





          {projects.length ===

          0 ? (



            <section className="student-project-empty">



              <FolderKanban

                size={50}

              />



              <h2>

                No project teams

              </h2>



              <p>

                Join an existing team or create one when your professor allows it.

              </p>



            </section>



          ) : (



            <div className="student-project-layout">



              <aside className="student-project-list-card">



                <div className="student-project-list-header">



                  <h2>

                    My Teams

                  </h2>



                  <span>

                    {filteredProjects.length}

                  </span>



                </div>





                <div className="student-project-list">



                  {filteredProjects.map(

                    (project) => {



                      const group =

                        getClass(

                          project.group_id

                        );





                      return (



                        <button

                          type="button"

                          key={

                            project.id

                          }

                          className={`student-project-list-item ${

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

                          }}

                        >



                          <div className="student-project-list-icon">

                            <FolderKanban />

                          </div>





                          <div>



                            <strong>

                              {project.title}

                            </strong>



                            <small>

                              {group?.name ||

                                "Class"}

                            </small>



                            <span>



                              <Users

                                size={11}

                              />



                              {

                                projectMembers.filter(

                                  (member) =>

                                    member.project_id ===

                                    project.id

                                ).length

                              }{" "}

                              members



                            </span>



                          </div>



                        </button>



                      );

                    }

                  )}



                </div>



              </aside>





              {selectedProject && (



                <section className="student-selected-project">



                  <div className="student-selected-project-header">



                    <div>



                      <div className="student-project-title-row">



                        <h2>

                          {selectedProject.title}

                        </h2>





                        {isTeamLeader && (



                          <span className="student-leader-badge">



                            <Crown

                              size={12}

                            />



                            Team Leader



                          </span>



                        )}



                      </div>





                      <p>

                        {getClass(

                          selectedProject.group_id

                        )?.name ||

                          "Class"}

                      </p>





                      <span

                        className={

                          selectedProject.status ===

                          "completed"

                            ? "student-project-main-status completed"

                            : "student-project-main-status active"

                        }

                      >



                        {selectedProject.status ===

                        "completed"

                          ? "Completed"

                          : "Active"}



                      </span>



                    </div>





                    <div className="student-project-header-right">



                      <div className="student-team-code">



                        <small>

                          Team Code

                        </small>



                        <strong>

                          {selectedProject.team_code}

                        </strong>



                        <button

                          type="button"

                          onClick={() =>

                            copyTeamCode(

                              selectedProject.team_code

                            )

                          }

                        >



                          <Copy />



                        </button>



                      </div>





                      <div className="student-team-management-buttons">



                        {isTeamLeader ? (

                          <>



                            <button

                              type="button"

                              className="edit"

                              onClick={

                                startEditingTeam

                              }

                            >



                              <Edit3 />



                              Edit



                            </button>





                            <button

                              type="button"

                              className={

                                selectedProject.status ===

                                "completed"

                                  ? "reopen"

                                  : "complete"

                              }

                              onClick={

                                toggleProjectStatus

                              }

                              disabled={

                                changingStatus

                              }

                            >



                              <CheckCircle2 />



                              {selectedProject.status ===

                              "completed"

                                ? "Reopen"

                                : "Complete"}



                            </button>





                            <button

                              type="button"

                              className="delete-team"

                              onClick={

                                deleteTeam

                              }

                              disabled={

                                deletingTeam

                              }

                            >



                              <Trash2 />



                              Delete Team



                            </button>



                          </>



                        ) : (



                          <button

                            type="button"

                            className="leave-team"

                            onClick={

                              leaveTeam

                            }

                            disabled={

                              leavingTeam

                            }

                          >



                            <LogOut />



                            Leave Team



                          </button>



                        )}



                      </div>



                    </div>



                  </div>





                  {editingTeam &&

                    isTeamLeader && (



                    <form

                      className="student-team-edit-form"

                      onSubmit={

                        saveTeam

                      }

                    >



                      <div className="student-team-edit-form-header">



                        <h3>

                          Edit Project

                        </h3>



                        <button

                          type="button"

                          onClick={() =>

                            setEditingTeam(

                              false

                            )

                          }

                        >



                          <X />



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





                      <button

                        type="submit"

                        className="student-team-save-button"

                        disabled={

                          savingTeam

                        }

                      >



                        <Save />



                        Save Changes



                      </button>



                    </form>



                  )}





                  {selectedProject.description &&

                    !editingTeam && (



                    <div className="student-project-description">

                      {selectedProject.description}

                    </div>



                  )}





                  <div className="student-project-members">



                    <div className="student-members-heading">



                      <div>



                        <h3>

                          Team Members

                        </h3>



                        <p>

                          Students working on this project.

                        </p>



                      </div>



                      <span>

                        {selectedMembers.length}

                      </span>



                    </div>





                    <div className="student-project-member-list">



                      {selectedMembers.map(

                        (member) => {



                          const student =

                            getMemberProfile(

                              member.student_id

                            );





                          const leader =

                            member.student_id ===

                            selectedProject.created_by;





                          return (



                            <div

                              className="student-project-member"

                              key={

                                member.id

                              }

                            >



                              <UserAvatar

                                profile={student}

                                userId={member.student_id}

                                name={student?.full_name || "Student"}

                                size={38}

                              />





                              <span className="student-member-info">



                                <strong>

                                  {student?.full_name ||

                                    "Student"}

                                </strong>



                                <small>

                                  {student?.campus_id ||

                                    "No ID"}

                                </small>



                                <small>



                                  {leader

                                    ? "Team Leader"

                                    : "Team Member"}



                                </small>



                              </span>





                              {leader && (

                                <Crown

                                  className="student-member-crown"

                                />

                              )}





                              {isTeamLeader &&

                                !leader && (



                                <button

                                  type="button"

                                  className="student-remove-member-button"

                                  onClick={() =>

                                    removeMember(

                                      member

                                    )

                                  }

                                  disabled={

                                    removingMemberId ===

                                    member.student_id

                                  }

                                >



                                  <Trash2 />



                                  Remove



                                </button>



                              )}



                            </div>



                          );

                        }

                      )}



                    </div>



                  </div>





                  {selectedProject.status !==

                    "completed" && (



                    <form

                      className="student-project-update-form"

                      onSubmit={

                        postUpdate

                      }

                    >



                      <div className="student-project-update-heading">



                        <h3>

                          Post Progress Update

                        </h3>



                        <p>

                          Tell your professor and team what you completed.

                        </p>



                      </div>





                      <div className="student-project-update-grid">



                        <div className="full">



                          <label>

                            Update Title

                          </label>



                          <input

                            value={

                              updateTitle

                            }

                            onChange={(event) =>

                              setUpdateTitle(

                                event.target.value

                              )

                            }

                            required

                          />



                        </div>





                        <div className="full">



                          <label>

                            Description

                          </label>



                          <textarea

                            rows={4}

                            value={

                              updateText

                            }

                            onChange={(event) =>

                              setUpdateText(

                                event.target.value

                              )

                            }

                          />



                        </div>





                        <div>



                          <label>

                            Progress

                          </label>



                          <select

                            value={

                              progressPercent

                            }

                            onChange={(event) =>

                              setProgressPercent(

                                Number(

                                  event.target.value

                                )

                              )

                            }

                          >



                            {[0, 10, 25, 50, 75, 90, 100]

                              .map(

                                (value) => (



                                  <option

                                    key={

                                      value

                                    }

                                    value={

                                      value

                                    }

                                  >



                                    {value}%



                                  </option>



                                )

                              )}



                          </select>



                        </div>





                        <div>



                          <label>

                            Files

                          </label>



                          <label className="student-project-file-picker">



                            <Upload />



                            Choose Files



                            <input

                              type="file"

                              multiple

                              accept=".pdf,.ppt,.pptx,.doc,.docx"

                              onChange={

                                handleFiles

                              }

                            />



                          </label>



                        </div>



                      </div>





                      {selectedFiles.length >

                        0 && (



                        <div className="student-project-selected-files">



                          {selectedFiles.map(

                            (file) => (



                              <span

                                key={

                                  file.name

                                }

                              >



                                <File />



                                {file.name}



                              </span>



                            )

                          )}



                        </div>



                      )}





                      <button

                        type="submit"

                        className="student-project-post-button"

                        disabled={

                          postingUpdate

                        }

                      >



                        <Send />



                        {postingUpdate

                          ? "Posting..."

                          : "Post Update"}



                      </button>



                    </form>



                  )}





                  {selectedProject.status ===

                    "completed" && (



                    <div className="student-project-completed-notice">



                      <CheckCircle2 />



                      <div>



                        <strong>

                          Project Completed

                        </strong>



                        <p>

                          New progress posts are currently disabled.

                        </p>



                      </div>



                    </div>



                  )}





                  <div className="student-project-updates">



                    <div className="student-project-updates-header">



                      <h3>

                        Team Progress

                      </h3>



                      <span>

                        {selectedUpdates.length}

                      </span>



                    </div>





                    <div className="student-project-update-list">



                      {selectedUpdates.map(

                        (update) => {



                          const student =

                            getMemberProfile(

                              update.student_id

                            );





                          const postFiles =

                            files.filter(

                              (file) =>

                                file.update_id ===

                                update.id

                            );





                          const comments =

                            feedback.filter(

                              (item) =>

                                item.update_id ===

                                update.id

                            );





                          return (



                            <article

                              className="student-project-update-card"

                              key={

                                update.id

                              }

                            >



                              <div className="student-project-update-top">



                                <div className="student-project-update-author">



                                  <UserAvatar

                                    profile={student}

                                    userId={update.student_id}

                                    name={student?.full_name || "Student"}

                                    size={36}

                                  />





                                  <span>



                                    <strong>

                                      {student?.full_name ||

                                        "Student"}

                                    </strong>



                                    <small>

                                      {formatDate(

                                        update.created_at

                                      )}

                                    </small>



                                  </span>



                                </div>





                                <span className="student-project-progress-pill">

                                  {update.progress_percent}%

                                </span>



                              </div>





                              <h4>

                                {update.title}

                              </h4>





                              {update.update_text && (

                                <p>

                                  {update.update_text}

                                </p>

                              )}





                              <div className="student-project-progress-bar">



                                <div

                                  style={{

                                    width:

                                      `${update.progress_percent}%`,

                                  }}

                                />



                              </div>





                              {postFiles.length >

                                0 && (



                                <div className="student-project-files">



                                  {postFiles.map(

                                    (file) => (



                                      <button

                                        type="button"

                                        key={

                                          file.id

                                        }

                                        onClick={() =>

                                          openProjectFile(

                                            file

                                          )

                                        }

                                      >



                                        <FileText />



                                        <span>



                                          <strong>

                                            {file.file_name}

                                          </strong>



                                        </span>



                                      </button>



                                    )

                                  )}



                                </div>



                              )}





                              {comments.length >

                                0 && (



                                <div className="student-professor-feedback">



                                  <div className="student-professor-feedback-title">



                                    <MessageSquare />



                                    Professor Feedback



                                  </div>





                                  {comments.map(

                                    (comment) => (



                                      <div

                                        className="student-feedback-message"

                                        key={

                                          comment.id

                                        }

                                      >



                                        <p>

                                          {comment.comment}

                                        </p>



                                        <small>

                                          {formatDate(

                                            comment.created_at

                                          )}

                                        </small>



                                      </div>



                                    )

                                  )}



                                </div>



                              )}



                            </article>



                          );

                        }

                      )}



                    </div>



                  </div>



                </section>



              )}



            </div>



          )}



        </div>



      </main>





      {/* CREATE TEAM */}



      {showCreateTeam && (



        <div className="student-project-modal-overlay">



          <div className="student-project-modal">



            <div className="student-project-modal-header">



              <div>



                <h2>

                  Create Project Team

                </h2>



                <p>

                  Choose a class where your professor allows student-created teams.

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



                <X />



              </button>



            </div>





            <form

              className="student-project-modal-form"

              onSubmit={

                createTeam

              }

            >



              <div>



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

                >



                  {classesAllowingCreation.map(

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





              <div>



                <label>

                  Project Title

                </label>



                <input

                  value={

                    projectTitle

                  }

                  onChange={(event) =>

                    setProjectTitle(

                      event.target.value

                    )

                  }

                  required

                />



              </div>





              <div>



                <label>

                  Description

                </label>



                <textarea

                  rows={4}

                  value={

                    projectDescription

                  }

                  onChange={(event) =>

                    setProjectDescription(

                      event.target.value

                    )

                  }

                />



              </div>





              <button

                type="submit"

                disabled={

                  creatingTeam

                }

              >



                <Plus />



                {creatingTeam

                  ? "Creating..."

                  : "Create Team"}



              </button>



            </form>



          </div>



        </div>



      )}





      {/* JOIN TEAM */}



      {showJoinTeam && (



        <div className="student-project-modal-overlay">



          <div className="student-project-small-modal">



            <div className="student-project-modal-header">



              <div>



                <h2>

                  Join Team

                </h2>



                <p>

                  Enter your team code.

                </p>



              </div>





              <button

                type="button"

                onClick={() =>

                  setShowJoinTeam(

                    false

                  )

                }

              >



                <X />



              </button>



            </div>





            <form

              className="student-project-join-form"

              onSubmit={

                joinTeam

              }

            >



              <label>

                Team Code

              </label>



              <div>



                <Hash />



                <input

                  value={

                    teamCode

                  }

                  maxLength={6}

                  onChange={(event) =>

                    setTeamCode(

                      event.target.value

                        .toUpperCase()

                        .replace(

                          /[^A-Z0-9]/g,

                          ""

                        )

                    )

                  }

                  placeholder="ABC123"

                />



              </div>





              <button

                type="submit"

                disabled={

                  joiningTeam

                }

              >



                {joiningTeam

                  ? "Joining..."

                  : "Join Team"}



              </button>



            </form>



          </div>



        </div>



      )}



    </div>

  );

}





export default Projects;