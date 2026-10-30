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


// Does this device have its own fingerprint reader / face
// unlock (Windows Hello, Touch ID, Face ID, Android)?
// false = e.g. a laptop without them; the person can still use
// their phone by scanning a QR code.
export async function deviceHasBiometrics() {
  try {
    if (!biometricSupported()) return false;
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}


// ---------------------------------------------------------
// Fingerprint and face are turned on separately. Which ones a
// device has is kept in its name, e.g.
//   "Android phone · Fingerprint & Face"
// Devices set up before this change (no " · ") count as both.
// ---------------------------------------------------------

const SEPARATOR = " · ";

export function deviceMethods(device) {
  const name = device?.friendly_name || "";
  const index = name.lastIndexOf(SEPARATOR);

  if (index === -1) return { fingerprint: true, face: true };

  const part = name.slice(index + SEPARATOR.length);
  return {
    fingerprint: /fingerprint/i.test(part),
    face: /face/i.test(part),
  };
}

export function deviceLabel(device) {
  const name = device?.friendly_name || "Device";
  const index = name.lastIndexOf(SEPARATOR);
  return index === -1 ? name : name.slice(0, index);
}

export function nameWithMethods(label, methods) {
  const parts = [
    methods.fingerprint ? "Fingerprint" : "",
    methods.face ? "Face" : "",
  ].filter(Boolean);

  return `${label}${SEPARATOR}${parts.join(" & ")}`.slice(0, 120);
}


// The passkey made on THIS device (so we know which one to change)
const DEVICE_KEY = "campusmate-passkey-id";

export function thisDevicePasskeyId() {
  try {
    return window.localStorage.getItem(DEVICE_KEY) || "";
  } catch {
    return "";
  }
}

export function rememberThisDevice(id) {
  try {
    if (id) window.localStorage.setItem(DEVICE_KEY, id);
    else window.localStorage.removeItem(DEVICE_KEY);
  } catch {
    // private mode: nothing to remember
  }
}
