import {
  useEffect,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  Eye,
  EyeOff,
  GraduationCap,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { callSchoolAdmin } from "../lib/schoolAdmin";

import PasswordRules
  from "../components/PasswordRules";

import {
  getPasswordProblem,
} from "../lib/passwordRules";

import SignInFooter from "../components/SignInFooter";

import "./Login.css";


// =========================================================
// CHOOSE YOUR OWN PASSWORD
// Shown the first time someone signs in with a temporary
// password their school gave them (and after a reset by
// the school). They can't use CampusMate until they do this.
// =========================================================

function ChangePassword() {
  const navigate =
    useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");


  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user =
        data?.user;

      if (!user) return;

      setEmail(user.email || "");

      // Already done (e.g. opened this page by hand)
      if (!user.app_metadata?.must_change_password) {
        navigate("/dashboard", { replace: true });
      }
    });
  }, [navigate]);


  async function handleSave(event) {
    event.preventDefault();

    const problem =
      getPasswordProblem(password);

    if (problem) {
      setErrorMessage(problem);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        "The two passwords don't match. Type the same password in both boxes."
      );
      return;
    }

    setErrorMessage("");
    setLoading(true);

    try {
      await callSchoolAdmin("set_my_password", { password });

      // Get a fresh sign-in that knows the password was changed.
      await supabase.auth.refreshSession();

      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrorMessage(error.message);
      setLoading(false);
    }
  }


  async function handleLogOut() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }


  return (
    <div className="signin-page">

      <main className="signin-card">

        <div className="signin-brand">
          <GraduationCap size={24} aria-hidden="true" />
          <span>CampusMate</span>
        </div>

        {email && (
          <div className="signin-identity">
            {email}
          </div>
        )}

        <form
          className="signin-step"
          onSubmit={handleSave}
          noValidate
        >
          <h1 className="signin-title">
            Choose your own password
          </h1>

          <p className="signin-text">
            Your school gave you a temporary password. Choose a new one
            that only you know before you continue.
          </p>

          {errorMessage && (
            <p className="signin-error" role="alert">
              {errorMessage}
            </p>
          )}

          <label className="signin-sr-only" htmlFor="change-password">
            New password
          </label>

          <div className="signin-password">
            <input
              id="change-password"
              className="signin-input"
              type={showPassword ? "text" : "password"}
              placeholder="New password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <button
              type="button"
              className="signin-eye"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <PasswordRules password={password} />

          <label className="signin-sr-only" htmlFor="change-password-confirm">
            Confirm new password
          </label>

          <input
            id="change-password-confirm"
            className="signin-input signin-input-spaced"
            type={showPassword ? "text" : "password"}
            placeholder="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />

          <div className="signin-actions">
            <button
              type="button"
              className="signin-button"
              onClick={handleLogOut}
            >
              Log out
            </button>

            <button
              type="submit"
              className="signin-button primary"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save password"}
            </button>
          </div>
        </form>

      </main>


      <SignInFooter />

    </div>
  );
}

export default ChangePassword;
