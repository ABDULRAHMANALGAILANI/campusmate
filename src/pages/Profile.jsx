import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  BookOpen,
  Camera,
  CheckCircle2,
  Edit3,
  GraduationCap,
  IdCard,
  ImagePlus,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  supabase,
} from "../lib/supabase";

import Sidebar
  from "../components/Sidebar";

import NotificationBell
  from "../components/NotificationBell";


import "./Profile.css";


function Profile() {
  const navigate =
    useNavigate();


  // =========================================================
  // REFS
  // =========================================================

  const pageRef =
    useRef(null);

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
  // STATS
  // =========================================================

  const [
    totalAssignments,
    setTotalAssignments,
  ] = useState(0);

  const [
    completedAssignments,
    setCompletedAssignments,
  ] = useState(0);

  const [
    projectCount,
    setProjectCount,
  ] = useState(0);

  const [
    classCount,
    setClassCount,
  ] = useState(0);


  // =========================================================
  // EDIT PROFILE
  // =========================================================

  const [
    editing,
    setEditing,
  ] = useState(false);

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
    loadProfile();
  }, []);


  // =========================================================
  // SIDEBAR WIDTH
  // =========================================================

  useEffect(() => {
    const page =
      pageRef.current;

    if (!page) {
      return;
    }


    const sidebar =
      page.firstElementChild;

    if (!sidebar) {
      return;
    }


    function updateSidebarWidth() {
      const width =
        sidebar
          .getBoundingClientRect()
          .width;


      page.style.setProperty(
        "--profile-sidebar-width",
        `${width}px`
      );
    }


    updateSidebarWidth();


    const observer =
      new ResizeObserver(
        updateSidebarWidth
      );


    observer.observe(
      sidebar
    );


    return () => {
      observer.disconnect();
    };
  }, []);


  // =========================================================
  // LOAD PROFILE
  // =========================================================

  async function loadProfile() {
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
    // PROFILE DATA
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
        "Could not load profile: " +
          profileError.message
      );

      setLoading(false);

      return;
    }


    // Professor should use professor profile page.

    if (
      profileData?.role ===
      "professor"
    ) {
      navigate(
        "/professor/profile",
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
    // ASSIGNMENTS
    // =======================================================

    const {
      data: assignmentData,
      error: assignmentError,
    } =
      await supabase
        .from("assignments")
        .select(
          "id, status"
        )
        .eq(
          "user_id",
          user.id
        );


    if (!assignmentError) {
      const assignmentList =
        assignmentData ||
        [];


      setTotalAssignments(
        assignmentList.length
      );


      setCompletedAssignments(
        assignmentList.filter(
          (assignment) =>
            assignment.status ===
            "completed"
        ).length
      );

    } else {
      console.error(
        "Assignment profile error:",
        assignmentError
      );
    }


    // =======================================================
    // PROJECT TEAMS
    // =======================================================

    const {
      data: projectMembershipData,
      error: projectMembershipError,
    } =
      await supabase
        .from(
          "project_team_members"
        )
        .select(
          "project_id"
        )
        .eq(
          "student_id",
          user.id
        );


    if (
      !projectMembershipError
    ) {
      const uniqueProjects =
        new Set(
          (
            projectMembershipData ||
            []
          ).map(
            (item) =>
              item.project_id
          )
        );


      setProjectCount(
        uniqueProjects.size
      );

    } else {
      console.error(
        "Project profile error:",
        projectMembershipError
      );
    }


    // =======================================================
    // CLASSES
    // =======================================================

    const {
      data: classMembershipData,
      error: classMembershipError,
    } =
      await supabase
        .from(
          "course_group_members"
        )
        .select(
          "group_id"
        )
        .eq(
          "student_id",
          user.id
        )
        .eq(
          "status",
          "active"
        );


    if (
      !classMembershipError
    ) {
      const uniqueClasses =
        new Set(
          (
            classMembershipData ||
            []
          ).map(
            (item) =>
              item.group_id
          )
        );


      setClassCount(
        uniqueClasses.size
      );

    } else {
      console.error(
        "Class profile error:",
        classMembershipError
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
        .from("avatars")
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
  // UPLOAD PROFILE PHOTO
  // =========================================================

  async function handleAvatarSelect(
    event
  ) {
    const file =
      event.target
        .files?.[0];


    // Allow the same file to be
    // selected again later.
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


    // =======================================================
    // FILE TYPE
    // =======================================================

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


    // =======================================================
    // SIZE
    // =======================================================

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


    // One photo per user.
    const avatarPath =
      `${currentUser.id}/profile`;


    // =======================================================
    // UPLOAD
    // =======================================================

    const {
      error: uploadError,
    } =
      await supabase.storage
        .from("avatars")
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
    // SAVE PATH
    // =======================================================

    const {
      error: updateError,
    } =
      await supabase
        .from("profiles")
        .update({
          avatar_path:
            avatarPath,
        })
        .eq(
          "id",
          currentUser.id
        );


    if (updateError) {
      setErrorMessage(
        "The photo uploaded, but CampusMate could not save it to your profile: " +
          updateError.message
      );

      setAvatarUploading(
        false
      );

      return;
    }


    // =======================================================
    // UPDATE UI
    // =======================================================

    setProfile(
      (current) => ({
        ...current,

        avatar_path:
          avatarPath,
      })
    );


    // Refresh cached browser image.
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
  // REMOVE PROFILE PHOTO
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
    // DELETE FROM STORAGE
    // =======================================================

    const {
      error: deleteError,
    } =
      await supabase.storage
        .from("avatars")
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
    // REMOVE PATH FROM PROFILE
    // =======================================================

    const {
      error: updateError,
    } =
      await supabase
        .from("profiles")
        .update({
          avatar_path:
            null,
        })
        .eq(
          "id",
          currentUser.id
        );


    if (updateError) {
      setErrorMessage(
        "Could not update profile: " +
          updateError.message
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
    // FULL NAME VALIDATION
    // =======================================================

    if (!cleanName) {
      setErrorMessage(
        "Full name cannot be empty."
      );

      return;
    }


    const nameParts =
      cleanName
        .split(" ")
        .filter(Boolean);


    if (
      nameParts.length <
      2
    ) {
      setErrorMessage(
        "Please enter your full name, including first and last name."
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
        "Please enter a real full name, not an email address."
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


    setSaving(true);

    setMessage("");
    setErrorMessage("");


    // =======================================================
    // UPDATE
    // =======================================================

    const {
      error,
    } =
      await supabase
        .from("profiles")
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
        "Could not update profile: " +
          error.message
      );

      setSaving(false);

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


    setEditing(false);


    setMessage(
      "Profile updated successfully."
    );


    setSaving(false);
  }


  // =========================================================
  // FORMAT DATE
  // =========================================================

  function formatDate(
    value
  ) {
    if (!value) {
      return "Not available";
    }


    return new Date(
      value
    ).toLocaleDateString(
      "en-GB",
      {
        day:
          "2-digit",

        month:
          "long",

        year:
          "numeric",
      }
    );
  }


  // =========================================================
  // DISPLAY VALUES
  // =========================================================

  const displayName =
    profile?.full_name ||
    "Student";


  const firstName =
    displayName
      .trim()
      .split(" ")[0] ||
    "Student";


  const initial =
    firstName
      .charAt(0)
      .toUpperCase();


  const email =
    currentUser?.email ||
    "No email";


  const campusId =
    profile?.campus_id ||
    "Not assigned";


  const displayProgramme =
    profile?.programme ||
    "Not added";


  const memberSince =
    formatDate(
      profile?.created_at ||
      currentUser?.created_at
    );


  const avatarUrl =
    getAvatarUrl(
      profile?.avatar_path
    );


  const completionRate =
    totalAssignments ===
    0
      ? 0
      : Math.round(
          (
            completedAssignments /
            totalAssignments
          ) *
          100
        );


  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="profile-loading">

        <User
          size={44}
        />

        <p>
          Loading profile...
        </p>

      </div>
    );
  }


  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div
      ref={pageRef}
      className="student-profile-page"
    >

      <Sidebar />


      <main className="student-profile-main">

        {/* ===================================================
            TOP BAR
        ==================================================== */}

        <header className="student-profile-topbar">

          <div>

            <h1>
              Profile
            </h1>

            <p>
              Manage your personal and academic information.
            </p>

          </div>


          <div className="student-profile-topbar-right">

            <NotificationBell />


            <div className="profile-top-avatar">

              {avatarUrl ? (

                <img
                  src={avatarUrl}
                  alt={`${displayName} profile`}
                  className="profile-avatar-image"
                />

              ) : (

                initial

              )}

            </div>


            <div className="profile-top-user">

              <strong>
                {displayName}
              </strong>

              <span>
                Student
              </span>

            </div>

          </div>

        </header>


        {/* ===================================================
            CONTENT
        ==================================================== */}

        <div className="student-profile-content">

          {/* =================================================
              MESSAGE
          ================================================== */}

          {message && (

            <div className="profile-success-message">

              <CheckCircle2
                size={18}
              />

              {message}

            </div>

          )}


          {errorMessage && (

            <div className="profile-error-message">

              {errorMessage}

            </div>

          )}


          {/* =================================================
              PROFILE HERO
          ================================================== */}

          <section className="profile-hero-card">

            <div className="profile-hero-left">

              {/* =============================================
                  OPTIONAL PROFILE PHOTO
              ============================================== */}

              <div className="profile-photo-area">

                <div className="profile-large-avatar">

                  {avatarUrl ? (

                    <img
                      src={avatarUrl}
                      alt={`${displayName} profile`}
                      className="profile-avatar-image"
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


                <div className="profile-photo-actions">

                  <button
                    type="button"
                    className="profile-photo-upload"
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
                      className="profile-photo-remove"
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


                <small className="profile-photo-help">
                  Optional • JPG, PNG or WEBP • Max 5 MB
                </small>

              </div>


              {/* =============================================
                  PROFILE INFO
              ============================================== */}

              <div className="profile-hero-info">

                <div className="profile-name-row">

                  <h2>
                    {displayName}
                  </h2>


                  <span className="profile-student-badge">

                    <GraduationCap
                      size={14}
                    />

                    Student

                  </span>

                </div>


                <p className="profile-programme">
                  {displayProgramme}
                </p>


                <div className="profile-meta-row">

                  <span>

                    <IdCard
                      size={15}
                    />

                    CampusMate ID:

                    <strong>
                      {campusId}
                    </strong>

                  </span>


                  <span>

                    <Mail
                      size={15}
                    />

                    {email}

                  </span>

                </div>


                <div className="profile-member-since">

                  <ShieldCheck
                    size={15}
                  />

                  Member since{" "}

                  <strong>
                    {memberSince}
                  </strong>

                </div>

              </div>

            </div>


            <button
              type="button"
              className="profile-edit-button"
              onClick={() => {
                setEditing(
                  true
                );

                setMessage("");
                setErrorMessage("");
              }}
            >

              <Edit3
                size={17}
              />

              Edit Profile

            </button>

          </section>


          {/* =================================================
              STATS
          ================================================== */}

          <section className="profile-stats-grid">

            <div className="profile-stat-card">

              <div className="profile-stat-icon blue">

                <BookOpen
                  size={23}
                />

              </div>


              <div>

                <strong>
                  {totalAssignments}
                </strong>

                <span>
                  Total Assignments
                </span>

              </div>

            </div>


            <div className="profile-stat-card">

              <div className="profile-stat-icon green">

                <CheckCircle2
                  size={23}
                />

              </div>


              <div>

                <strong>
                  {completedAssignments}
                </strong>

                <span>
                  Completed
                </span>

              </div>

            </div>


            <div className="profile-stat-card">

              <div className="profile-stat-icon purple">

                <Users
                  size={23}
                />

              </div>


              <div>

                <strong>
                  {projectCount}
                </strong>

                <span>
                  Group Projects
                </span>

              </div>

            </div>


            <div className="profile-stat-card">

              <div className="profile-stat-icon orange">

                <GraduationCap
                  size={23}
                />

              </div>


              <div>

                <strong>
                  {classCount}
                </strong>

                <span>
                  Active Classes
                </span>

              </div>

            </div>

          </section>


          {/* =================================================
              DETAILS
          ================================================== */}

          <div className="profile-details-grid">

            {/* ===============================================
                PERSONAL INFORMATION
            ================================================ */}

            <section className="profile-info-card">

              <div className="profile-section-header">

                <div>

                  <h2>
                    Personal Information
                  </h2>

                  <p>
                    Your registered CampusMate account details.
                  </p>

                </div>


                <User
                  size={21}
                />

              </div>


              <div className="profile-information-list">

                <div className="profile-information-row">

                  <span>
                    Full Name
                  </span>

                  <strong>
                    {displayName}
                  </strong>

                </div>


                <div className="profile-information-row">

                  <span>
                    Email Address
                  </span>

                  <strong>
                    {email}
                  </strong>

                </div>


                <div className="profile-information-row">

                  <span>
                    CampusMate ID
                  </span>

                  <strong className="profile-campus-id">
                    {campusId}
                  </strong>

                </div>


                <div className="profile-information-row">

                  <span>
                    Programme
                  </span>

                  <strong>
                    {displayProgramme}
                  </strong>

                </div>


                <div className="profile-information-row">

                  <span>
                    Account Type
                  </span>

                  <strong>
                    Student
                  </strong>

                </div>

              </div>

            </section>


            {/* ===============================================
                ACADEMIC SUMMARY
            ================================================ */}

            <section className="profile-summary-card">

              <div className="profile-section-header">

                <div>

                  <h2>
                    Academic Summary
                  </h2>

                  <p>
                    A quick overview of your CampusMate activity.
                  </p>

                </div>


                <GraduationCap
                  size={21}
                />

              </div>


              <div className="profile-summary-progress">

                <div className="profile-summary-progress-top">

                  <span>
                    Assignment Completion
                  </span>

                  <strong>
                    {completionRate}%
                  </strong>

                </div>


                <div className="profile-progress-track">

                  <div
                    style={{
                      width:
                        `${completionRate}%`,
                    }}
                  />

                </div>

              </div>


              <div className="profile-summary-list">

                <div>

                  <span>
                    Assignments
                  </span>

                  <strong>

                    {completedAssignments}

                    {" / "}

                    {totalAssignments}

                  </strong>

                </div>


                <div>

                  <span>
                    Project Teams
                  </span>

                  <strong>
                    {projectCount}
                  </strong>

                </div>


                <div>

                  <span>
                    Joined Classes
                  </span>

                  <strong>
                    {classCount}
                  </strong>

                </div>


                <div>

                  <span>
                    Account Status
                  </span>

                  <strong className="profile-active-status">
                    Active
                  </strong>

                </div>

              </div>

            </section>

          </div>

        </div>

      </main>


      {/* =====================================================
          EDIT PROFILE MODAL
      ====================================================== */}

      {editing && (

        <div className="profile-modal-overlay">

          <div className="profile-edit-modal">

            <div className="profile-edit-modal-header">

              <div>

                <h2>
                  Edit Profile
                </h2>

                <p>
                  Update your name and programme.
                </p>

              </div>


              <button
                type="button"
                onClick={() =>
                  setEditing(
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
              className="profile-edit-form"
              onSubmit={
                saveProfile
              }
            >

              <div>

                <label>
                  Full Name
                </label>

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

                <small>
                  Enter your first and last name.
                </small>

              </div>


              <div>

                <label>
                  Programme
                </label>

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
                  placeholder="Example: Computer Engineering"
                />

              </div>


              <div>

                <label>
                  Email Address
                </label>

                <input
                  type="email"
                  value={
                    email
                  }
                  disabled
                />

                <small>
                  Email cannot be changed here.
                </small>

              </div>


              <div>

                <label>
                  CampusMate ID
                </label>

                <input
                  type="text"
                  value={
                    campusId
                  }
                  disabled
                />

                <small>
                  CampusMate ID is generated automatically.
                </small>

              </div>


              <div className="profile-edit-actions">

                <button
                  type="button"
                  className="profile-cancel-button"
                  onClick={() => {
                    setEditing(
                      false
                    );

                    setErrorMessage(
                      ""
                    );
                  }}
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="profile-save-button"
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

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}


export default Profile;