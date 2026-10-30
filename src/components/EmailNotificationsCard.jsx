import {
  useEffect,
  useState,
} from "react";

import {
  Mail,
  Send,
} from "lucide-react";

import { supabase } from "../lib/supabase";

import "./BiometricSettings.css";
import "./YourDataCard.css";


// =========================================================
// EMAIL NOTIFICATIONS (Settings)
// One email a day with your unread notifications
// (supabase/20-email-notifications.sql + the
// send-daily-email Edge Function). On by default.
// =========================================================

function EmailNotificationsCard() {
  const [on, setOn] = useState(true);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");


  useEffect(() => {
    let active = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;

      const { data, error: loadError } =
        await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

      if (!active) return;

      if (loadError || !data || !("email_notifications" in data)) {
        setMissing(true);
      } else {
        setOn(data.email_notifications !== false);
      }

      setReady(true);
    })();

    return () => {
      active = false;
    };
  }, []);


  async function toggle(next) {
    // Show the change straight away; undo it if saving fails
    setOn(next);
    setBusy("save");
    setError("");
    setMessage("");

    const { error: saveError } =
      await supabase.rpc("set_email_notifications", { input_on: next });

    setBusy("");

    if (saveError) {
      setOn(!next);
      setError(saveError.message);
      return;
    }

    setMessage(next ? "Daily emails are on." : "Daily emails are off.");
  }


  async function sendTest() {
    setBusy("test");
    setError("");
    setMessage("");

    const { data, error: sendError } =
      await supabase.functions.invoke("send-daily-email", { body: { action: "test" } });

    setBusy("");

    if (sendError) {
      let text = "Couldn't send the email.";
      try {
        const body = await sendError.context?.json();
        if (body?.error) text = body.error;
      } catch {
        // keep the general message
      }
      if (sendError.context?.status === 404) {
        text = "The send-daily-email server function isn't set up yet. Deploy it in Supabase → Edge Functions.";
      }
      setError(text);
      return;
    }

    setMessage(
      data?.sent
        ? "Sent! Check your inbox (and the spam folder)."
        : data?.message || "Nothing new to email right now."
    );
  }


  return (
    <section className="biometric-card">
      <div className="biometric-header">
        <div className="biometric-icon">
          <Mail size={22} aria-hidden="true" />
        </div>
        <div>
          <h2>Email notifications</h2>
          <p>
            Get one email each morning with anything new: assignments, marks, deadlines due soon
            and replies. Nothing is sent on days with nothing new.
          </p>
        </div>
      </div>

      <div className="biometric-body">
        {message && <p className="biometric-message">{message}</p>}
        {error && <p className="biometric-error" role="alert">{error}</p>}

        {missing ? (
          <p className="biometric-error">
            Email notifications aren't set up yet. Run supabase/20-email-notifications.sql in Supabase.
          </p>
        ) : (
          <div className="data-actions">
            <label className="email-toggle">
              <input
                type="checkbox"
                checked={on}
                disabled={!ready || Boolean(busy)}
                onChange={(event) => toggle(event.target.checked)}
              />
              <span>Send me a daily email</span>
            </label>

            <button
              type="button"
              className="data-cancel"
              onClick={sendTest}
              disabled={!ready || Boolean(busy)}
            >
              <Send size={15} aria-hidden="true" />
              {busy === "test" ? "Sending..." : "Email me my unread notifications now"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default EmailNotificationsCard;
