import {
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

// Same Outlook-style look as the sign-in page.
import SignInFooter from "../components/SignInFooter";
import { PRIVACY_VERSION } from "../config/legal";

import "./Login.css";


// =========================================================
// CREATE ACCOUNT (independent students)
// School students and professors get their accounts from
// their school, so this page only creates students.
// =========================================================

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


function Register() {
  const navigate =
    useNavigate();

  const [
    firstName,
    setFirstName,
  ] = useState("");

  const [
    lastName,
    setLastName,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

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

  // true when Supabase wants the email confirmed first
  const [
    checkEmail,
    setCheckEmail,
  ] = useState(false);

  // PDPA: must agree to the Privacy Notice
  const [
    agreed,
    setAgreed,
  ] = useState(false);


  async function handleSubmit(event) {
    event.preventDefault();

    setErrorMessage("");

    const fullName =
      `${firstName.trim()} ${lastName.trim()}`.trim();

    const cleanEmail =
      email.trim().toLowerCase();


    // ---------------- VALIDATION ----------------

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage(
        "Enter your first and last name."
      );
      return;
    }

    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setErrorMessage(
        "Enter a valid email address, like name@example.com."
      );
      return;
    }

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

    if (!agreed) {
      setErrorMessage(
        "Please read and agree to the Privacy Notice to create an account."
      );
      return;
    }


    // ---------------- CREATE ACCOUNT ----------------

    setLoading(true);

    const {
      data,
      error,
    } =
      await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            // Recorded on the profile at first sign-in
            privacy_version: PRIVACY_VERSION,
            privacy_agreed_at: new Date().toISOString(),
          },
        },
      });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }


    // Email confirmation is OFF: the user is signed in now.
    // Make sure a profile exists (the database usually
    // creates it; campus_id and role are set there too).
    if (data?.user && data?.session) {
      const {
        data: existingProfile,
      } =
        await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .maybeSingle();

      if (!existingProfile) {
        const {
          error: profileError,
        } =
          await supabase
            .from("profiles")
            .insert({
              id: data.user.id,
              full_name: fullName,
            });

        if (profileError) {
          setErrorMessage(
            "Your account was created, but your profile could not be set up: " +
              profileError.message
          );
          setLoading(false);
          return;
        }
      }

      setLoading(false);
      navigate("/dashboard");
      return;
    }


    // Email confirmation is ON: ask them to check their inbox.
    setLoading(false);
    setCheckEmail(true);
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


        {checkEmail ? (

          // ============ CHECK YOUR EMAIL ============
          <div className="signin-step">
            <h1 className="signin-title">
              Check your email
            </h1>

            <p className="signin-text">
              We sent a confirmation link to{" "}
              <strong>{email.trim().toLowerCase()}</strong>.
              Open it to finish creating your account, then sign in.
              It can take a few minutes, so check your spam folder too.
            </p>

            <div className="signin-actions">
              <Link
                to="/login"
                className="signin-button primary signin-button-link"
              >
                Go to sign in
              </Link>
            </div>
          </div>

        ) : (

          // ============ FORM ============
          <form
            className="signin-step"
            onSubmit={handleSubmit}
            noValidate
          >
            <h1 className="signin-title">
              Create account
            </h1>

            <p className="signin-text signin-subtitle">
              A free account for independent students.
            </p>

            {errorMessage && (
              <p
                className="signin-error signin-error-spaced"
                role="alert"
              >
                {errorMessage}
              </p>
            )}

            <div className="signin-fields">

              <div className="signin-name-row">
                <div>
                  <label
                    className="signin-sr-only"
                    htmlFor="register-first-name"
                  >
                    First name
                  </label>
                  <input
                    id="register-first-name"
                    className="signin-input"
                    type="text"
                    placeholder="First name"
                    autoComplete="given-name"
                    autoFocus
                    value={firstName}
                    onChange={(event) =>
                      setFirstName(event.target.value)
                    }
                  />
                </div>

                <div>
                  <label
                    className="signin-sr-only"
                    htmlFor="register-last-name"
                  >
                    Last name
                  </label>
                  <input
                    id="register-last-name"
                    className="signin-input"
                    type="text"
                    placeholder="Last name"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) =>
                      setLastName(event.target.value)
                    }
                  />
                </div>
              </div>


              <div>
                <label
                  className="signin-sr-only"
                  htmlFor="register-email"
                >
                  Email address
                </label>
                <input
                  id="register-email"
                  className="signin-input"
                  type="email"
                  placeholder="Email address"
                  autoComplete="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                />
              </div>


              <div>
                <label
                  className="signin-sr-only"
                  htmlFor="register-password"
                >
                  Create password
                </label>

                <div className="signin-password">
                  <input
                    id="register-password"
                    className="signin-input"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create password"
                    autoComplete="new-password"
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
                        ? "Hide passwords"
                        : "Show passwords"
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
              </div>


              <div>
                <label
                  className="signin-sr-only"
                  htmlFor="register-confirm-password"
                >
                  Confirm password
                </label>
                <input
                  id="register-confirm-password"
                  className="signin-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                />
              </div>

            </div>


            <label className="signin-agree">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span>
                <span>I have read and agree to the Privacy Notice and rules of use.</span>{" "}
                <Link to="/privacy" target="_blank" rel="noopener">Read the Privacy Notice</Link>
              </span>
            </label>

            <div className="signin-actions">
              <button
                type="submit"
                className="signin-button primary"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create account"}
              </button>
            </div>

            <p className="signin-text signin-switch">
              Already have an account?{" "}
              <Link
                className="signin-link"
                to="/login"
              >
                Sign in
              </Link>
            </p>
          </form>

        )}

      </main>


      {!checkEmail && (
        <div className="signin-card signin-options">
          <p>
            <strong>Is your school on CampusMate?</strong>{" "}
            Your school creates your account. Look for an invite
            in your school email instead.
          </p>
        </div>
      )}


      <SignInFooter />

    </div>
  );
}

export default Register;
