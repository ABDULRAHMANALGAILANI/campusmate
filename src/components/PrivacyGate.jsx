import {
  useEffect,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  GraduationCap,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { PRIVACY_VERSION } from "../config/legal";

import SignInFooter from "./SignInFooter";

import "../pages/Login.css";


// =========================================================
// PRIVACY AGREEMENT (PDPA)
// Before using CampusMate, everyone agrees to the current
// Privacy Notice once. Accounts made by a school see this at
// their first sign-in. Changing PRIVACY_VERSION in
// src/config/legal.js asks everyone again.
// =========================================================

function cacheKey(userId) {
  return `campusmate-privacy-${userId}-${PRIVACY_VERSION}`;
}

function cached(userId) {
  try {
    return window.sessionStorage.getItem(cacheKey(userId)) === "1";
  } catch {
    return false;
  }
}

function remember(userId) {
  try {
    window.sessionStorage.setItem(cacheKey(userId), "1");
  } catch {
    // Private mode: we just check again next time
  }
}


function PrivacyGate({ user, children }) {
  const [state, setState] = useState(() => (cached(user.id) ? "ok" : "checking"));
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (state !== "checking") return undefined;

    let active = true;

    async function check() {
      const { data, error: loadError } =
        await supabase
          .from("profiles")
          .select("privacy_version")
          .eq("id", user.id)
          .maybeSingle();

      if (!active) return;

      // Database not updated yet (15-privacy-and-help.sql): don't lock anyone out
      if (loadError) {
        setState("ok");
        return;
      }

      if (data?.privacy_version === PRIVACY_VERSION) {
        remember(user.id);
        setState("ok");
        return;
      }

      // Agreed on the Create account page: record it now
      if (user.user_metadata?.privacy_version === PRIVACY_VERSION) {
        await supabase.rpc("accept_privacy", { input_version: PRIVACY_VERSION });
        remember(user.id);
        if (active) setState("ok");
        return;
      }

      setState("ask");
    }

    check();

    return () => {
      active = false;
    };
  }, [state, user]);


  async function accept() {
    setSaving(true);
    setError("");

    const { error: acceptError } =
      await supabase.rpc("accept_privacy", { input_version: PRIVACY_VERSION });

    setSaving(false);

    if (acceptError) {
      setError(acceptError.message);
      return;
    }

    remember(user.id);
    setState("ok");
  }


  async function logOut() {
    await supabase.auth.signOut();
    window.location.assign("/");
  }


  if (state === "ok") return children;

  if (state === "checking") {
    return <div className="privacy-gate-loading">Loading CampusMate...</div>;
  }

  return (
    <div className="signin-page">
      <main className="signin-card privacy-gate">
        <div className="signin-brand">
          <GraduationCap size={24} aria-hidden="true" />
          <span>CampusMate</span>
        </div>

        <h1 className="signin-title">
          <ShieldCheck size={24} aria-hidden="true" /> Before you continue
        </h1>

        <p className="signin-text">Please read how CampusMate uses your personal data.</p>

        <ul className="privacy-gate-points">
          <li>We use your details and class work only to run your classes: assignments, marks, attendance and messages.</li>
          <li>Your teachers see your work and marks. Classmates never see your marks, attendance or excuses.</li>
          <li>We never sell your data, and your fingerprint and face never leave your device.</li>
          <li>You can ask to see, correct or delete your data at any time.</li>
        </ul>

        <p className="signin-text">
          <Link to="/privacy" target="_blank" rel="noopener" className="signin-link">Read the full Privacy Notice</Link>
        </p>

        <label className="signin-agree">
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
          <span>I have read and agree to the Privacy Notice and rules of use.</span>
        </label>

        {error && <p className="signin-error" role="alert">{error}</p>}

        <div className="signin-actions">
          <button type="button" className="signin-button" onClick={logOut} disabled={saving}>
            Log out
          </button>
          <button type="button" className="signin-button primary" onClick={accept} disabled={!agreed || saving}>
            {saving ? "Saving..." : "Agree and continue"}
          </button>
        </div>
      </main>

      <SignInFooter />
    </div>
  );
}

export default PrivacyGate;
