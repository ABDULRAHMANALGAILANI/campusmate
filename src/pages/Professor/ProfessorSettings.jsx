import {
  useEffect,
  useState,
} from "react";

import {
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  GraduationCap,
  Mail,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import ProfessorSidebar from "../../components/ProfessorSidebar";
import NotificationBell from "../../components/NotificationBell";
import UserAvatar
  from "../../components/UserAvatar";

import "./ProfessorDashboard.css";
import { getPasswordProblem } from "../../lib/passwordRules";

import BiometricSettings
  from "../../components/BiometricSettings";
import InstallAppCard
  from "../../components/InstallAppCard";
import LanguageCard
  from "../../components/LanguageCard";
import YourDataCard
  from "../../components/YourDataCard";
import EmailNotificationsCard
  from "../../components/EmailNotificationsCard";

import "./ProfessorSettings.css";


function ProfessorSettings() {
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
  // PASSWORD
  // =========================================================

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);


  // =========================================================
  // PAGE STATE
  // =========================================================

  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    changingPassword,
    setChangingPassword,
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
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadPage();
  }, []);


  async function loadPage() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");


    // ---------------------------------------------------------
    // CURRENT USER
    // ---------------------------------------------------------

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


    // ---------------------------------------------------------
    // PROFILE
    // ---------------------------------------------------------

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
        "Could not load profile: " +
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


    setLoading(false);
  }


  // =========================================================
  // PASSWORD
  // =========================================================

  async function changePassword(
    event
  ) {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");


    if (
      !newPassword ||
      !confirmPassword
    ) {
      setErrorMessage(
        "Please enter and confirm your new password."
      );

      return;
    }


    const passwordProblem =
      getPasswordProblem(newPassword);

    if (passwordProblem) {
      setErrorMessage(passwordProblem);
      return;
    }


    if (
      newPassword !==
      confirmPassword
    ) {
      setErrorMessage(
        "Passwords do not match."
      );

      return;
    }


    setChangingPassword(
      true
    );


    const {
      error,
    } =
      await supabase.auth.updateUser({
        password:
          newPassword,
      });


    if (error) {
      console.error(
        "Password change error:",
        error
      );

      setErrorMessage(
        "Could not change password: " +
          error.message
      );

      setChangingPassword(
        false
      );

      return;
    }


    setNewPassword("");
    setConfirmPassword("");


    setMessage(
      "Password changed successfully."
    );


    setChangingPassword(
      false
    );
  }


  // =========================================================
  // DISPLAY
  // =========================================================

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
            Loading settings...
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

        {/* ===================================================
            TOP BAR
        ==================================================== */}

        <header className="professor-topbar">

          <div aria-hidden="true" />


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

        <div className="professor-settings-content">

          {/* HEADER */}

          <div className="professor-settings-header">

            <div>

              <h1>
                Settings
              </h1>

              <p>
                Sign-in options and your password.
              </p>

            </div>

          </div>


          {/* SUCCESS */}

          {message && (

            <div className="professor-settings-message">

              {message}

            </div>

          )}


          {/* ERROR */}

          {errorMessage && (

            <div className="professor-error">

              {errorMessage}

            </div>

          )}


          <div className="professor-settings-grid">

            {/* =================================================
                SECURITY
            ================================================== */}

            {/* Fingerprint & face sign-in */}
            <BiometricSettings />

            <LanguageCard />

            <InstallAppCard />

            <EmailNotificationsCard />

            <YourDataCard />

            <section className="professor-settings-card">

              <div className="professor-settings-card-header">

                <ShieldCheck
                  size={20}
                />


                <div>

                  <h2>
                    Account & Security
                  </h2>

                  <p>
                    Review your account and update your password.
                  </p>

                </div>

              </div>


              {/* ACCOUNT */}

              <div className="professor-settings-account">

                <div>

                  <span>

                    <Mail
                      size={16}
                    />

                    Email

                  </span>

                  <strong>
                    {currentUser?.email ||
                      "-"}
                  </strong>

                </div>


                <div>

                  <span>

                    <GraduationCap
                      size={16}
                    />

                    Account Type

                  </span>

                  <strong className="professor-setting-role">
                    Professor
                  </strong>

                </div>


                <div>

                  <span>

                    <ShieldCheck
                      size={16}
                    />

                    Access

                  </span>

                  <strong>
                    Professor Portal
                  </strong>

                </div>

              </div>


              {/* PASSWORD */}

              <form
                className="professor-password-form"
                onSubmit={
                  changePassword
                }
              >

                <div className="professor-password-heading">

                  <KeyRound
                    size={18}
                  />

                  <div>

                    <h3>
                      Change Password
                    </h3>

                    <p>
                      At least 7 characters, with a letter and a number.
                    </p>

                  </div>

                </div>


                <div className="professor-settings-field">

                  <label>
                    New Password
                  </label>


                  <div>

                    <KeyRound
                      size={17}
                    />


                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      value={
                        newPassword
                      }
                      onChange={(event) =>
                        setNewPassword(
                          event.target.value
                        )
                      }
                      placeholder="Enter new password"
                      autoComplete="new-password"
                    />


                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (current) =>
                            !current
                        )
                      }
                    >

                      {showPassword ? (

                        <EyeOff
                          size={17}
                        />

                      ) : (

                        <Eye
                          size={17}
                        />

                      )}

                    </button>

                  </div>

                </div>


                <div className="professor-settings-field">

                  <label>
                    Confirm Password
                  </label>


                  <div>

                    <KeyRound
                      size={17}
                    />


                    <input
                      type={
                        showConfirmPassword
                          ? "text"
                          : "password"
                      }
                      value={
                        confirmPassword
                      }
                      onChange={(event) =>
                        setConfirmPassword(
                          event.target.value
                        )
                      }
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                    />


                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          (current) =>
                            !current
                        )
                      }
                    >

                      {showConfirmPassword ? (

                        <EyeOff
                          size={17}
                        />

                      ) : (

                        <Eye
                          size={17}
                        />

                      )}

                    </button>

                  </div>

                </div>


                <button
                  type="submit"
                  className="professor-password-save"
                  disabled={
                    changingPassword
                  }
                >

                  <KeyRound
                    size={16}
                  />

                  {changingPassword
                    ? "Updating..."
                    : "Update Password"}

                </button>

              </form>

            </section>

          </div>

        </div>

      </main>

    </div>
  );
}


export default ProfessorSettings;