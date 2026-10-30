import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  ArrowLeft,
  Eye,
  EyeOff,
  Fingerprint,
  GraduationCap,
  ScanFace,
} from "lucide-react";

import { supabase } from "../lib/supabase";

import BlinkCheck
  from "../components/BlinkCheck";

import {
  biometricErrorMessage,
  biometricSupported,
  deviceHasBiometrics,
} from "../lib/biometric";

import SignInFooter from "../components/SignInFooter";

import "./Login.css";


// =========================================================
// SIGN-IN FLOW (works like Outlook)
//
//   email    -> enter email, press Next
//   password -> enter password, press Sign in
//   forgot   -> send a password reset link
//   sent     -> confirmation that the link was sent
// =========================================================

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


function Login() {
  const navigate =
    useNavigate();

  const [
    step,
    setStep,
  ] = useState("email");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
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

  // false = no fingerprint reader / face unlock on this device
  // (e.g. a laptop): show how to use a phone instead
  const [
    hasReader,
    setHasReader,
  ] = useState(true);

  useEffect(() => {
    deviceHasBiometrics().then(setHasReader);
  }, []);


  // Already signed in? Skip the sign-in page and go straight
  // to the dashboard (it sends professors to their own one).
  useEffect(() => {
    let active =
      true;

    supabase.auth.getSession().then(({ data }) => {
      if (active && data?.session) {
        navigate("/dashboard", { replace: true });
      }
    });

    return () => {
      active =
        false;
    };
  }, [navigate]);


  function goTo(nextStep) {
    setErrorMessage("");
    setStep(nextStep);
  }


  // -------------------------------------------------------
  // STEP 1: EMAIL
  // -------------------------------------------------------

  function handleEmailNext(event) {
    event.preventDefault();

    const cleanEmail =
      email.trim();

    if (!cleanEmail) {
      setErrorMessage(
        "Enter your email address."
      );
      return;
    }

    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setErrorMessage(
        "Enter a valid email address, like name@example.com."
      );
      return;
    }

    setEmail(cleanEmail);
    setPassword("");
    goTo("password");
  }


  // -------------------------------------------------------
  // STEP 2: PASSWORD
  // -------------------------------------------------------

  async function handleSignIn(event) {
    event.preventDefault();

    if (!password) {
      setErrorMessage(
        "Enter your password."
      );
      return;
    }

    setErrorMessage("");
    setLoading(true);

    const {
      error,
    } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    setLoading(false);

    if (error) {
      setErrorMessage(
        error.message === "Invalid login credentials"
          ? "Your email or password is incorrect. Check them and try again, or reset your password."
          : error.message
      );
      return;
    }

    navigate("/dashboard");
  }


  // -------------------------------------------------------
  // FORGOT PASSWORD
  // -------------------------------------------------------

  async function handleSendReset(event) {
    event.preventDefault();

    setErrorMessage("");
    setLoading(true);

    const {
      error,
    } =
      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            `${window.location.origin}/reset-password`,
        }
      );

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    goTo("sent");
  }


  // -------------------------------------------------------
  // FINGERPRINT / FACE SIGN-IN (passkeys)
  // The device checks the fingerprint or face, then Supabase
  // signs the person in. No email or password needed.
  // -------------------------------------------------------

  async function handleBiometricSignIn(method) {
    setErrorMessage("");
    setLoading(true);

    try {
      const {
        error,
      } =
        await supabase.auth.signInWithPasskey();

      if (error) {
        throw error;
      }

      navigate("/dashboard");
    } catch (error) {
      setErrorMessage(
        biometricErrorMessage(error, method)
      );

      setStep("email");
    } finally {
      setLoading(false);
    }
  }


  // -------------------------------------------------------
  // PAGE
  // -------------------------------------------------------

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

        {new URLSearchParams(window.location.search).get("deleted") === "1" && (
          <p className="signin-deleted" role="status">
            Your account and data were deleted. Thank you for using CampusMate.
          </p>
        )}


        {/* Changing the key re-runs the slide-in for each step */}
        <div
          key={step}
          className="signin-step"
        >

          {/* ============ STEP 1: EMAIL ============ */}
          {step === "email" && (
            <form
              onSubmit={handleEmailNext}
              noValidate
            >
              <h1 className="signin-title">
                Sign in
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
                htmlFor="signin-email"
              >
                Email address
              </label>

              <input
                id="signin-email"
                className={`signin-input ${
                  errorMessage ? "has-error" : ""
                }`}
                type="email"
                placeholder="Email address"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
              />

              <p className="signin-text">
                No account?{" "}
                <Link
                  className="signin-link"
                  to="/register"
                >
                  Create one!
                </Link>
              </p>

              <div className="signin-actions">
                <button
                  type="submit"
                  className="signin-button primary"
                >
                  Next
                </button>
              </div>

              {biometricSupported() && (
                <>
                  <div className="signin-divider">
                    <span>or sign in with</span>
                  </div>

                  <div className="signin-biometric">
                    <button
                      type="button"
                      className="signin-biometric-button"
                      onClick={() =>
                        handleBiometricSignIn("fingerprint")
                      }
                      disabled={loading}
                    >
                      <Fingerprint
                        size={22}
                        aria-hidden="true"
                      />
                      Fingerprint
                    </button>

                    <button
                      type="button"
                      className="signin-biometric-button"
                      onClick={() => goTo("face")}
                      disabled={loading}
                    >
                      <ScanFace
                        size={22}
                        aria-hidden="true"
                      />
                      Face
                    </button>
                  </div>

                  {!hasReader && (
                    <p className="signin-biometric-hint">
                      No fingerprint reader or face unlock on this computer? Click Fingerprint or Face,
                      choose "iPhone, iPad, or Android device", then scan the QR code with your phone.
                    </p>
                  )}
                </>
              )}
            </form>
          )}


          {/* ============ FACE: BLINK TWICE ============ */}
          {step === "face" && (
            <div>
              <h1 className="signin-title">
                Sign in with your face
              </h1>

              <BlinkCheck
                onPassed={() =>
                  handleBiometricSignIn("face")
                }
                onCancel={() => goTo("email")}
              />
            </div>
          )}


          {/* ============ STEP 2: PASSWORD ============ */}
          {step === "password" && (
            <form
              onSubmit={handleSignIn}
              noValidate
            >
              <button
                type="button"
                className="signin-identity"
                onClick={() => goTo("email")}
                aria-label={`Back. Signing in as ${email}`}
              >
                <ArrowLeft
                  size={18}
                  aria-hidden="true"
                />
                <span>{email}</span>
              </button>

              <h1 className="signin-title">
                Enter password
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
                htmlFor="signin-password"
              >
                Password
              </label>

              <div className="signin-password">
                <input
                  id="signin-password"
                  className={`signin-input ${
                    errorMessage ? "has-error" : ""
                  }`}
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  autoComplete="current-password"
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

              <p className="signin-text">
                <button
                  type="button"
                  className="signin-link"
                  onClick={() => goTo("forgot")}
                >
                  Forgot password?
                </button>
              </p>

              <div className="signin-actions">
                <button
                  type="submit"
                  className="signin-button primary"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </div>
            </form>
          )}


          {/* ============ FORGOT PASSWORD ============ */}
          {step === "forgot" && (
            <form onSubmit={handleSendReset}>
              <button
                type="button"
                className="signin-identity"
                onClick={() => goTo("password")}
                aria-label={`Back. Signing in as ${email}`}
              >
                <ArrowLeft
                  size={18}
                  aria-hidden="true"
                />
                <span>{email}</span>
              </button>

              <h1 className="signin-title">
                Reset your password
              </h1>

              {errorMessage && (
                <p
                  className="signin-error"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}

              <p className="signin-text">
                We'll email a link to <strong>{email}</strong>.
                Open it to choose a new password.
              </p>

              <div className="signin-actions">
                <button
                  type="button"
                  className="signin-button"
                  onClick={() => goTo("password")}
                >
                  Back
                </button>

                <button
                  type="submit"
                  className="signin-button primary"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send link"}
                </button>
              </div>
            </form>
          )}


          {/* ============ LINK SENT ============ */}
          {step === "sent" && (
            <div>
              <h1 className="signin-title">
                Check your email
              </h1>

              <p className="signin-text">
                If an account exists for <strong>{email}</strong>,
                a password reset link is on its way. It can take a
                few minutes, so check your spam folder too.
              </p>

              <div className="signin-actions">
                <button
                  type="button"
                  className="signin-button primary"
                  onClick={() => goTo("password")}
                >
                  Back to sign in
                </button>
              </div>
            </div>
          )}

        </div>
      </main>


      {step === "email" && (
        <div className="signin-card signin-options">
          <p>
            <strong>Is your school on CampusMate?</strong>{" "}
            Sign in with the email your school used to invite you.
          </p>
        </div>
      )}


      <SignInFooter />

    </div>
  );
}

export default Login;
