import { useState } from "react";

import {
  Database,
  Download,
  Trash2,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { callSchoolAdmin } from "../lib/schoolAdmin";

import "./BiometricSettings.css";
import "./YourDataCard.css";


// =========================================================
// YOUR DATA (PDPA rights from the Privacy Notice)
//   Download my data  -> one JSON file with everything
//   Delete my account -> independent accounts delete it here;
//                        school accounts ask their school
// =========================================================

function saveFile(name, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}


function YourDataCard() {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [account, setAccount] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");


  async function download() {
    setBusy("download");
    setError("");
    setMessage("");

    const { data, error: exportError } = await supabase.rpc("export_my_data");

    setBusy("");

    if (exportError) {
      setError(
        /export_my_data|schema cache/i.test(exportError.message)
          ? "This isn't set up yet. Run supabase/16-my-data.sql in Supabase."
          : exportError.message
      );
      return;
    }

    saveFile(`campusmate-my-data-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
    setMessage("Your data was downloaded. Open the file with any text editor.");
  }


  async function openDelete() {
    setError("");
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: profile }, block] = await Promise.all([
      supabase.from("profiles").select("role, school_id").eq("id", user.id).maybeSingle(),
      supabase.rpc("account_delete_block"),
    ]);

    setAccount({
      email: user.email,
      school: Boolean(profile?.school_id),
      ownsClasses: typeof block.data === "string" && block.data.startsWith("owns_classes")
        ? Number(block.data.split(":")[1] || 0)
        : 0,
    });
    setDeleting(true);
  }


  async function askSchool() {
    setBusy("ask");
    setError("");

    const { error: reportError } =
      await supabase.from("problem_reports").insert({
        category: "privacy",
        message: "Please delete my CampusMate account and all my data.",
        page: "Settings",
      });

    setBusy("");

    if (reportError) {
      setError(reportError.message);
      return;
    }

    setDeleting(false);
    setMessage("Your request was sent to your school admin. You can follow it on the Help page.");
  }


  async function deleteForever(event) {
    event.preventDefault();
    setError("");

    if (confirmText.trim() !== "DELETE") {
      setError("Type DELETE in capital letters to confirm.");
      return;
    }

    setBusy("delete");

    // Make sure it's really you
    const { error: passwordError } =
      await supabase.auth.signInWithPassword({ email: account.email, password });

    if (passwordError) {
      setBusy("");
      setError("That password isn't right.");
      return;
    }

    try {
      await callSchoolAdmin("delete_my_account", { confirm: "DELETE" });
    } catch (deleteError) {
      setBusy("");
      setError(deleteError.message);
      return;
    }

    await supabase.auth.signOut().catch(() => null);
    window.location.assign("/?deleted=1");
  }


  return (
    <section className="biometric-card">
      <div className="biometric-header">
        <div className="biometric-icon">
          <Database size={22} aria-hidden="true" />
        </div>
        <div>
          <h2>Your data</h2>
          <p>Download a copy of everything CampusMate stores about you, or delete your account.</p>
        </div>
      </div>

      <div className="biometric-body">
        {message && <p className="biometric-message">{message}</p>}
        {error && <p className="biometric-error" role="alert">{error}</p>}

        <div className="data-actions">
          <button type="button" className="biometric-setup" onClick={download} disabled={Boolean(busy)}>
            <Download size={17} aria-hidden="true" />
            {busy === "download" ? "Preparing..." : "Download my data"}
          </button>

          {!deleting && (
            <button type="button" className="data-delete-link" onClick={openDelete} disabled={Boolean(busy)}>
              <Trash2 size={16} aria-hidden="true" />
              Delete my account
            </button>
          )}
        </div>

        {deleting && account && (
          <div className="data-delete-box">
            {account.school ? (
              <>
                <p>
                  Your school created your account, so your school admin deletes it. We'll send them
                  your request.
                </p>
                <div className="data-actions">
                  <button type="button" className="data-danger" onClick={askSchool} disabled={Boolean(busy)}>
                    {busy === "ask" ? "Sending..." : "Ask my school to delete my account"}
                  </button>
                  <button type="button" className="data-cancel" onClick={() => setDeleting(false)}>Cancel</button>
                </div>
              </>
            ) : account.ownsClasses ? (
              <>
                <p>You still own classes. Delete them on My Classes first, then come back here.</p>
                <button type="button" className="data-cancel" onClick={() => setDeleting(false)}>Close</button>
              </>
            ) : (
              <form onSubmit={deleteForever}>
                <p>
                  <strong>This can't be undone.</strong> Your account, hand-ins, marks, attendance,
                  messages and files are deleted for good. Download your data first if you want a copy.
                </p>

                <label className="data-field">
                  <span>Your password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>

                <label className="data-field">
                  <span>Type DELETE to confirm</span>
                  <input
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    autoComplete="off"
                    data-no-translate
                  />
                </label>

                <div className="data-actions">
                  <button type="submit" className="data-danger" disabled={Boolean(busy)}>
                    <Trash2 size={16} aria-hidden="true" />
                    {busy === "delete" ? "Deleting..." : "Delete my account forever"}
                  </button>
                  <button type="button" className="data-cancel" onClick={() => setDeleting(false)} disabled={Boolean(busy)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default YourDataCard;
