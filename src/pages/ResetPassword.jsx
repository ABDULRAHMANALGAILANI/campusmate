import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  Eye,
  EyeOff,
  GraduationCap,
} from "lucide-react";

import { supabase } from "../lib/supabase";

import PasswordRules
  from "../components/PasswordRules";

import {
  getPasswordProblem,
} from "../lib/passwordRules";

import SignInFooter from "../components/SignInFooter";

import "./Login.css";


// =========================================================
// RESET PASSWORD
// Opened from the link in the "reset your password" email.
// Supabase signs the user in from that link, then they
// choose a new password here.
// =========================================================

function ResetPassword() {
  const navigate =
    useNavigate();

  // checking -> ready (link worked) | invalid (expired/used)
  const [
    linkState,
    setLinkState,
  ] = useState("checking");

  const [
    password,
    setPassword,
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
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  useEffect(() => {
    let active =
      true;

    // The link signs the user in a moment after the page opens.
    const {
      data: listener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (active && session) {
            setLinkState("ready");
          }
        }
      );

    // Give Supabase a moment to read the link, then decide.
    const timer =
      setTimeout(async () => {
        const {
          data,
        } =
          await supabase.auth.getSession();

        if (active) {
          setLinkState(
            data.session ? "ready" : "invalid"
          );
        }
      }, 800);

    return () => {
      active =
        false;

      clearTimeout(timer);

      listener?.subscription?.unsubscribe();
    };
  }, []);


  async function handleSave(event) {
    event.preventDefault();

    const passwordProblem =
      getPasswordProblem(password);

    if (passwordProblem) {
      setErrorMessage(passwordProblem);
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

    const {
      error,
    } =
      await supabase.auth.updateUser({
        password,
      });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    navigate("/dashboard");
  }


  return (
    <div className="signin-page">

      <main className="signin-card">

        <div className="signin-brand">
          <GraduationCap
            size={24}
            aria-hidden="true"
          />
          <span>CampusMate</span>
        </div>


        {linkState === "checking" && (
          <p className="signin-text">
            Checking your reset link...
          </p>
        )}


        {linkState === "invalid" && (
          <div className="signin-step">
            <h1 className="signin-title">
              This link has expired
            </h1>

            <p className="signin-text">
              Reset links work once and only for a short time.
              Go back to sign in and choose "Forgot password?"
              to get a new one.
            </p>

            <div className="signin-actions">
              <Link
                to="/login"
                className="signin-button primary signin-button-link"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        )}


        {linkState === "ready" && (
          <form
            className="signin-step"
            onSubmit={handleSave}
            noValidate
          >
            <h1 className="signin-title">
              Choose a new password
            </h1>

            {errorMessage && (
              <p
                className="signin-error"
                role="alert"
              >
                {errorMessage}
              </p>
            )}

            <label
              className="signin-sr-only"
              htmlFor="reset-password"
            >
              New password
            </label>

            <div className="signin-password">
              <input
                id="reset-password"
                className="signin-input"
                type={showPassword ? "text" : "password"}
                placeholder="New password"
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
              />

              <button
                type="button"
                className="signin-eye"
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>

            <PasswordRules
              password={password}
            />

            <label
              className="signin-sr-only"
              htmlFor="reset-password-confirm"
            >
              Confirm new password
            </label>

            <input
              id="reset-password-confirm"
              className="signin-input signin-input-spaced"
              type={showPassword ? "text" : "password"}
              placeholder="Confirm new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
            />

            <div className="signin-actions">
              <button
                type="submit"
                className="signin-button primary"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save password"}
              </button>
            </div>
          </form>
        )}

      </main>


      <SignInFooter />

    </div>
  );
}

export default ResetPassword;
