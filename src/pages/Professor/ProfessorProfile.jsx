import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Camera,
  CheckCircle2,
  FileText,
  FolderKanban,
  GraduationCap,
  ImagePlus,
  Mail,
  Save,
  School,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  supabase,
} from "../../lib/supabase";

import ProfessorSidebar
  from "../../components/ProfessorSidebar";

import NotificationBell
  from "../../components/NotificationBell";

import "./ProfessorDashboard.css";
import "./ProfessorProfile.css";


function ProfessorProfile() {
  const navigate =
    useNavigate();


  // =========================================================
  // REFS
  // =========================================================

  const fileInputRef =
    useRef(null);


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
  // EDIT PROFILE
  // =========================================================

  const [
    fullName,
    setFullName,
  ] = useState("");

  const [
    programme,
    setProgramme,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);


  // =========================================================
  // PROFILE PHOTO
  // =========================================================

  const [
    avatarUploading,
    setAvatarUploading,
  ] = useState(false);

  const [
    avatarVersion,
    setAvatarVersion,
  ] = useState(() => Date.now());


  // =========================================================
  // STATS
  // =========================================================

  const [
    assignedStudents,
    setAssignedStudents,
  ] = useState(0);

  const [
    assignmentCount,
    setAssignmentCount,
  ] = useState(0);

  const [
    projectCount,
    setProjectCount,
  ] = useState(0);


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
  // LOAD
  // =========================================================

  useEffect(() => {
    loadPage();
  }, []);


  async function loadPage() {
    setLoading(true);

    setMessage("");
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
        .select("*")
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


    setFullName(
      profileData?.full_name ||
        ""
    );


    setProgramme(
      profileData?.programme ||
        ""
    );


    // =======================================================
    // PROFESSOR CLASSES
    // =======================================================

    const {
      data: classData,
      error: classError,
    } =
      await supabase
        .from(
          "course_groups"
        )
        .select(
          "id"
        )
        .eq(
          "professor_id",
          user.id
        );


    if (classError) {
      console.error(
        "Professor profile class error:",
        classError
      );

      setLoading(false);

      return;
    }


    const classIds =
      (
        classData ||
        []
      ).map(
        (group) =>
          group.id
      );


    if (
      classIds.length ===
      0
    ) {
      setAssignedStudents(
        0
      );

      setAssignmentCount(
        0
      );

      setProjectCount(
        0
      );

      setLoading(false);

      return;
    }


    // =======================================================
    // ASSIGNED STUDENTS
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
          group_id,
          student_id,
          status
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


    if (memberError) {
      console.error(
        "Professor profile member error:",
        memberError
      );

    } else {

      const studentIds =
        [
          ...new Set(
            (
              memberData ||
              []
            ).map(
              (member) =>
                member.student_id
            )
          ),
        ];


      setAssignedStudents(
        studentIds.length
      );


      // =====================================================
      // STUDENT ASSIGNMENTS
      // =====================================================

      if (
        studentIds.length >
        0
      ) {
        const {
          data: assignmentData,
          error: assignmentError,
        } =
          await supabase
            .from(
              "assignments"
            )
            .select(
              "id"
            )
            .in(
              "user_id",
              studentIds
            );


        if (
          assignmentError
        ) {
          console.error(
            "Professor profile assignment error:",
            assignmentError
          );

        } else {
          setAssignmentCount(
            (
              assignmentData ||
              []
            ).length
          );
        }

      } else {
        setAssignmentCount(
          0
        );
      }
    }


    // =======================================================
    // GROUP PROJECTS
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
          group_id
          `
        )
        .in(
          "group_id",
          classIds
        );


    if (projectError) {
      console.error(
        "Professor profile project error:",
        projectError
      );

    } else {
      setProjectCount(
        (
          projectData ||
          []
        ).length
      );
    }


    setLoading(false);
  }


  // =========================================================
  // AVATAR URL
  // =========================================================

  function getAvatarUrl(
    avatarPath
  ) {
    if (!avatarPath) {
      return "";
    }


    const {
      data,
    } =
      supabase.storage
        .from(
          "avatars"
        )
        .getPublicUrl(
          avatarPath
        );


    if (
      !data?.publicUrl
    ) {
      return "";
    }


    return (
      `${data.publicUrl}?v=${avatarVersion}`
    );
  }


  // =========================================================
  // UPLOAD PHOTO
  // =========================================================

  async function handleAvatarSelect(
    event
  ) {
    const file =
      event.target
        .files?.[0];


    event.target.value =
      "";


    if (
      !file ||
      !currentUser
    ) {
      return;
    }


    setMessage("");
    setErrorMessage("");


    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];


    if (
      !allowedTypes.includes(
        file.type
      )
    ) {
      setErrorMessage(
        "Please select a JPG, PNG or WEBP image."
      );

      return;
    }


    const maxSize =
      5 *
      1024 *
      1024;


    if (
      file.size >
      maxSize
    ) {
      setErrorMessage(
        "Profile photo must be smaller than 5 MB."
      );

      return;
    }


    setAvatarUploading(
      true
    );


    const avatarPath =
      `${currentUser.id}/profile`;


    // =======================================================
    // UPLOAD TO STORAGE
    // =======================================================

    const {
      error: uploadError,
    } =
      await supabase.storage
        .from(
          "avatars"
        )
        .upload(
          avatarPath,
          file,
          {
            upsert: true,

            cacheControl:
              "3600",

            contentType:
              file.type,
          }
        );


    if (uploadError) {
      setErrorMessage(
        "Could not upload photo: " +
          uploadError.message
      );

      setAvatarUploading(
        false
      );

      return;
    }


    // =======================================================
    // SAVE AVATAR PATH
    // =======================================================

    const {
      error: profileError,
    } =
      await supabase
        .from(
          "profiles"
        )
        .update({
          avatar_path:
            avatarPath,
        })
        .eq(
          "id",
          currentUser.id
        );


    if (profileError) {
      setErrorMessage(
        "Photo uploaded, but the profile could not be updated: " +
          profileError.message
      );

      setAvatarUploading(
        false
      );

      return;
    }


    setProfile(
      (current) => ({
        ...current,

        avatar_path:
          avatarPath,
      })
    );


    setAvatarVersion(
      Date.now()
    );


    setMessage(
      "Profile photo updated successfully."
    );


    setAvatarUploading(
      false
    );
  }


  // =========================================================
  // REMOVE PHOTO
  // =========================================================

  async function removeAvatar() {
    if (
      !currentUser ||
      !profile?.avatar_path
    ) {
      return;
    }


    const confirmed =
      window.confirm(
        "Remove your profile photo?"
      );


    if (!confirmed) {
      return;
    }


    setAvatarUploading(
      true
    );

    setMessage("");
    setErrorMessage("");


    // =======================================================
    // REMOVE FROM STORAGE
    // =======================================================

    const {
      error: deleteError,
    } =
      await supabase.storage
        .from(
          "avatars"
        )
        .remove([
          profile.avatar_path,
        ]);


    if (deleteError) {
      setErrorMessage(
        "Could not remove photo: " +
          deleteError.message
      );

      setAvatarUploading(
        false
      );

      return;
    }


    // =======================================================
    // CLEAR PROFILE PATH
    // =======================================================

    const {
      error: profileError,
    } =
      await supabase
        .from(
          "profiles"
        )
        .update({
          avatar_path:
            null,
        })
        .eq(
          "id",
          currentUser.id
        );


    if (profileError) {
      setErrorMessage(
        "Could not update profile: " +
          profileError.message
      );

      setAvatarUploading(
        false
      );

      return;
    }


    setProfile(
      (current) => ({
        ...current,

        avatar_path:
          null,
      })
    );


    setMessage(
      "Profile photo removed."
    );


    setAvatarUploading(
      false
    );
  }


  // =========================================================
  // SAVE PROFILE
  // =========================================================

  async function saveProfile(
    event
  ) {
    event.preventDefault();


    if (!currentUser) {
      return;
    }


    const cleanName =
      fullName
        .trim()
        .replace(
          /\s+/g,
          " "
        );


    // =======================================================
    // NAME VALIDATION
    // =======================================================

    if (!cleanName) {
      setErrorMessage(
        "Full name cannot be empty."
      );

      return;
    }


    const parts =
      cleanName
        .split(" ")
        .filter(Boolean);


    if (
      parts.length <
      2
    ) {
      setErrorMessage(
        "Please enter your first and last name."
      );

      return;
    }


    if (
      /\d/.test(
        cleanName
      )
    ) {
      setErrorMessage(
        "Numbers are not allowed in your full name."
      );

      return;
    }


    if (
      cleanName.includes(
        "@"
      )
    ) {
      setErrorMessage(
        "Please enter your name, not an email address."
      );

      return;
    }


    const validNamePattern =
      /^[\p{L}][\p{L}\s.'-]*[\p{L}.]$/u;


    if (
      !validNamePattern.test(
        cleanName
      )
    ) {
      setErrorMessage(
        "Full name can contain letters, spaces, apostrophes, periods and hyphens only."
      );

      return;
    }


    setSaving(
      true
    );

    setMessage("");
    setErrorMessage("");


    const {
      error,
    } =
      await supabase
        .from(
          "profiles"
        )
        .update({
          full_name:
            cleanName,

          programme:
            programme.trim() ||
            null,
        })
        .eq(
          "id",
          currentUser.id
        );


    if (error) {
      setErrorMessage(
        "Could not update professor profile: " +
          error.message
      );

      setSaving(
        false
      );

      return;
    }


    setProfile(
      (current) => ({
        ...current,

        full_name:
          cleanName,

        programme:
          programme.trim() ||
          null,
      })
    );


    setFullName(
      cleanName
    );


    setMessage(
      "Professor profile updated successfully."
    );


    setSaving(
      false
    );
  }


  // =========================================================
  // DISPLAY
  // =========================================================

  const professorName =
    profile?.full_name ||
    "Professor";


  const firstName =
    professorName
      .trim()
      .split(" ")[0] ||
    "Professor";


  const initial =
    firstName
      .charAt(0)
      .toUpperCase();


  const email =
    currentUser?.email ||
    "No email";


  const department =
    profile?.programme ||
    "Department not added";


  const campusId =
    profile?.campus_id ||
    "Not assigned";


  const avatarUrl =
    getAvatarUrl(
      profile?.avatar_path
    );


  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="professor-profile-loading">

        <GraduationCap
          size={45}
        />

        <p>
          Loading professor profile...
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

          <div aria-hidden="true" />


          <div className="professor-topbar-right">

            <NotificationBell />


            <div className="professor-avatar">

              {avatarUrl ? (

                <img
                  src={avatarUrl}
                  alt={`${professorName} profile`}
                  className="professor-avatar-image"
                />

              ) : (

                initial

              )}

            </div>


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

        <div className="professor-profile-content">

          <div className="professor-profile-heading">

            <h1>
              My Profile
            </h1>

            <p>
              Manage your professor account information.
            </p>

          </div>


          {/* =================================================
              MESSAGES
          ================================================== */}

          {message && (

            <div className="professor-profile-success">

              <CheckCircle2
                size={17}
              />

              {message}

            </div>

          )}


          {errorMessage && (

            <div className="professor-profile-error">

              {errorMessage}

            </div>

          )}


          {/* =================================================
              HERO
          ================================================== */}

          <section className="professor-profile-hero">

            <div className="professor-profile-photo-area">

              <div className="professor-profile-large-avatar">

                {avatarUrl ? (

                  <img
                    src={avatarUrl}
                    alt={`${professorName} profile`}
                    className="professor-avatar-image"
                  />

                ) : (

                  initial

                )}

              </div>


              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={
                  handleAvatarSelect
                }
                hidden
              />


              <div className="professor-photo-buttons">

                <button
                  type="button"
                  className="professor-photo-upload"
                  onClick={() =>
                    fileInputRef
                      .current
                      ?.click()
                  }
                  disabled={
                    avatarUploading
                  }
                >

                  {avatarUrl ? (

                    <Camera
                      size={15}
                    />

                  ) : (

                    <ImagePlus
                      size={15}
                    />

                  )}


                  {avatarUploading
                    ? "Uploading..."
                    : avatarUrl
                      ? "Change Photo"
                      : "Add Photo"}

                </button>


                {avatarUrl && (

                  <button
                    type="button"
                    className="professor-photo-remove"
                    onClick={
                      removeAvatar
                    }
                    disabled={
                      avatarUploading
                    }
                  >

                    <Trash2
                      size={14}
                    />

                    Remove

                  </button>

                )}

              </div>


              <small className="professor-photo-help">
                Optional • JPG, PNG or WEBP • Max 5 MB
              </small>

            </div>


            <div className="professor-profile-hero-info">

              <h2>
                {professorName}
              </h2>


              <p>

                <School
                  size={15}
                />

                {department}

              </p>


              <span className="professor-account-badge">

                <ShieldCheck
                  size={14}
                />

                Professor Account

              </span>

            </div>

          </section>


          {/* =================================================
              STATS
          ================================================== */}

          <section className="professor-profile-stats">

            <div className="professor-profile-stat-card">

              <span className="professor-profile-stat-icon blue">

                <Users
                  size={22}
                />

              </span>


              <div>

                <strong>
                  {assignedStudents}
                </strong>

                <span>
                  Assigned Students
                </span>

              </div>

            </div>


            <div className="professor-profile-stat-card">

              <span className="professor-profile-stat-icon purple">

                <FileText
                  size={22}
                />

              </span>


              <div>

                <strong>
                  {assignmentCount}
                </strong>

                <span>
                  Student Assignments
                </span>

              </div>

            </div>


            <div className="professor-profile-stat-card">

              <span className="professor-profile-stat-icon green">

                <FolderKanban
                  size={22}
                />

              </span>


              <div>

                <strong>
                  {projectCount}
                </strong>

                <span>
                  Group Projects
                </span>

              </div>

            </div>

          </section>


          {/* =================================================
              DETAILS GRID
          ================================================== */}

          <div className="professor-profile-grid">

            {/* ===============================================
                PERSONAL INFORMATION
            ================================================ */}

            <section className="professor-profile-card">

              <div className="professor-profile-card-header">

                <UserRound
                  size={20}
                />


                <div>

                  <h2>
                    Personal Information
                  </h2>

                  <p>
                    Update your professor profile.
                  </p>

                </div>

              </div>


              <form
                className="professor-profile-form"
                onSubmit={
                  saveProfile
                }
              >

                <div>

                  <label>
                    Full Name
                  </label>

                  <div className="professor-profile-input">

                    <UserRound
                      size={18}
                    />

                    <input
                      type="text"
                      value={
                        fullName
                      }
                      onChange={(event) =>
                        setFullName(
                          event.target.value
                        )
                      }
                      required
                    />

                  </div>

                </div>


                <div>

                  <label>
                    Department / Programme
                  </label>

                  <div className="professor-profile-input">

                    <GraduationCap
                      size={18}
                    />

                    <input
                      type="text"
                      value={
                        programme
                      }
                      onChange={(event) =>
                        setProgramme(
                          event.target.value
                        )
                      }
                      placeholder="Example: School of Computer Sciences"
                    />

                  </div>

                </div>


                <button
                  type="submit"
                  className="professor-profile-save"
                  disabled={
                    saving
                  }
                >

                  <Save
                    size={16}
                  />

                  {saving
                    ? "Saving..."
                    : "Save Changes"}

                </button>

              </form>

            </section>


            {/* ===============================================
                ACCOUNT INFORMATION
            ================================================ */}

            <section className="professor-profile-card">

              <div className="professor-profile-card-header">

                <ShieldCheck
                  size={20}
                />


                <div>

                  <h2>
                    Account Information
                  </h2>

                  <p>
                    Your CampusMate professor account.
                  </p>

                </div>

              </div>


              <div className="professor-account-list">

                <div>

                  <span>

                    <Mail
                      size={16}
                    />

                    Email

                  </span>

                  <strong>
                    {email}
                  </strong>

                </div>


                <div>

                  <span>

                    <ShieldCheck
                      size={16}
                    />

                    Account Role

                  </span>

                  <strong className="professor-role-pill">
                    Professor
                  </strong>

                </div>


                <div>

                  <span>

                    <School
                      size={16}
                    />

                    Department

                  </span>

                  <strong>
                    {department}
                  </strong>

                </div>


                <div>

                  <span>

                    <UserRound
                      size={16}
                    />

                    CampusMate ID

                  </span>

                  <strong>
                    {campusId}
                  </strong>

                </div>

              </div>


              <div className="professor-role-protected">

                <ShieldCheck
                  size={19}
                />


                <div>

                  <strong>
                    Role Protected
                  </strong>

                  <p>
                    Your Professor role cannot be changed from this profile page.
                  </p>

                </div>

              </div>

            </section>

          </div>

        </div>

      </main>

    </div>
  );
}


export default ProfessorProfile;