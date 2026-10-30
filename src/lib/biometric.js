// =========================================================
// FINGERPRINT / FACE SIGN-IN HELPERS
// Both use passkeys: the phone or laptop checks the person's
// fingerprint or face itself, so CampusMate never sees or
// stores any fingerprint or face data.
// =========================================================

// Can this browser use fingerprint / face sign-in at all?
export function biometricSupported() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}


// Turns technical errors into something a student can act on.
export function biometricErrorMessage(error, method = "fingerprint") {
  const name =
    error?.name || "";

  const text =
    String(error?.message || error || "");

  if (name === "NotAllowedError" || /not allowed|cancel|timed out/i.test(text)) {
    return `${method === "face" ? "Face" : "Fingerprint"} sign-in was cancelled or isn't set up on this device. Sign in with your password, then turn it on in Settings.`;
  }

  if (name === "InvalidStateError" || /already registered|exists/i.test(text)) {
    return "This device is already set up for fingerprint or face sign-in.";
  }

  if (/disabled|not enabled|passkey.*not/i.test(text)) {
    return "Fingerprint and face sign-in aren't switched on for CampusMate yet.";
  }

  if (!window.isSecureContext) {
    return "Fingerprint and face sign-in only work on the secure (https) version of CampusMate.";
  }

  if (name === "SecurityError" || /relying party|rp ?id|origin/i.test(text)) {
    return `Fingerprint and face sign-in aren't set up for this address (${window.location.hostname}). In Supabase → Authentication → Passkeys, set the Relying Party ID to "${window.location.hostname}" and the Origin to "${window.location.origin}".`;
  }

  return text || "Something went wrong. Please sign in with your password.";
}
