import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  Eye,
  EyeOff,
  LockKeyhole,
} from "lucide-react";

import { supabase } from "../lib/supabase";

import Sidebar from "../components/Sidebar";
import NotificationBell from "../components/NotificationBell";
import UserAvatar from "../components/UserAvatar";
import BiometricSettings from "../components/BiometricSettings";
import InstallAppCard from "../components/InstallAppCard";
import LanguageCard from "../components/LanguageCard";
import YourDataCard from "../components/YourDataCard";
import EmailNotificationsCard from "../components/EmailNotificationsCard";
import PasswordRules from "../components/PasswordRules";

import { getPasswordProblem } from "../lib/passwordRules";

import "./Dashboard.css";
import "./Settings.css";


// =========================================================
// SETTINGS (students)
// Only things that actually do something:
//   - fingerprint & face sign-in
//   - change password
// Profile details live on the Profile page.
// =========================================================

function Settings() {
  const navigate =
    useNavigate();

  const [profile, setProfile] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);


  useEffect(() => {
    let active =
      true;

    async function load() {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        navigate("/");
        return;
      }

      const { data } =
        await supabase
          .from("profiles")
          .select("id, full_name, programme, role, avatar_path")
          .eq("id", user.id)
          .maybeSingle();

      if (!active) return;

      if (data?.role === "professor") {
        navigate("/professor/settings", { replace: true });
        return;
      }

      setProfile(data || null);
    }

    load();

    return () => {
      active =
        false;
    };
  }, [navigate]);


  async function updatePassword(event) {
    event.preventDefault();
    setMessage(null);

    const problem =
      getPasswordProblem(newPassword);

    if (problem) {
      setMessage({ ok: false, text: problem });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({
        ok: false,
        text: "The two passwords don't match. Type the same password in both boxes.",
      });
      return;
    }

    setSaving(true);

    const { error } =
      await supabase.auth.updateUser({
        password: newPassword,
      });

    setSaving(false);

    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setMessage({ ok: true, text: "Your password has been changed." });
  }


  const displayName =
    profile?.full_name || "Student";


  return (
    <div className="dashboard-page">

      <Sidebar />

      <main className="dashboard-main">

        <header className="topbar">

          <div aria-hidden="true" />

          <div className="topbar-right">

            <NotificationBell />

            <UserAvatar
              profile={profile}
              name={displayName}
              size={44}
            />

            <div className="profile-text">
              <strong>{displayName}</strong>
              <small>{profile?.programme || "Student"}</small>
            </div>

          </div>

        </header>


        <div className="settings-content">

          <div className="settings-page-header">
            <div>
              <h1>Settings</h1>
              <p>Sign-in options and your password.</p>
            </div>
          </div>


          <div className="settings-grid">

            <BiometricSettings />

            <LanguageCard />

            <InstallAppCard />

            <EmailNotificationsCard />

            <YourDataCard />


            <section className="settings-card">

              <div className="settings-card-header">

                <div className="settings-card-icon green">
                  <LockKeyhole size={21} />
                </div>

                <div>
                  <h2>Password</h2>
                  <p>Choose a new password for your account.</p>
                </div>

              </div>


              <form
                className="password-form"
                onSubmit={updatePassword}
                noValidate
              >

                {message && (
                  <p
                    className={`settings-inline-message ${message.ok ? "ok" : "error"}`}
                    role={message.ok ? "status" : "alert"}
                  >
                    {message.text}
                  </p>
                )}

                <div className="settings-field">

                  <label htmlFor="settings-new-password">
                    New password
                  </label>

                  <div className="settings-password-input">
                    <input
                      id="settings-new-password"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="New password"
                      autoComplete="new-password"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  <PasswordRules password={newPassword} />

                </div>


                <div className="settings-field">

                  <label htmlFor="settings-confirm-password">
                    Confirm new password
                  </label>

                  <input
                    id="settings-confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Type it again"
                    autoComplete="new-password"
                  />

                </div>


                <button
                  type="submit"
                  className="settings-password-btn"
                  disabled={saving}
                >
                  <LockKeyhole size={17} />
                  {saving ? "Saving..." : "Change password"}
                </button>

              </form>

            </section>

          </div>

        </div>

      </main>

    </div>
  );
}

export default Settings;
