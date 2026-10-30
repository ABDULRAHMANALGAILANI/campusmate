import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Fingerprint,
  Laptop,
  ScanFace,
  Smartphone,
  Trash2,
} from "lucide-react";

import { supabase } from "../lib/supabase";

import {
  biometricErrorMessage,
  biometricSupported,
  deviceHasBiometrics,
  deviceLabel,
  deviceMethods,
  nameWithMethods,
  rememberThisDevice,
  thisDevicePasskeyId,
} from "../lib/biometric";

import BlinkCheck from "./BlinkCheck";

import "./BiometricSettings.css";


// =========================================================
// FINGERPRINT & FACE SIGN-IN (Settings)
// Fingerprint and face are turned on separately, per device.
//   Fingerprint: the device's fingerprint reader confirms it's you.
//   Face: blink twice at the camera, then the device's face
//         unlock (or fingerprint/PIN) confirms it's you.
// Both use a passkey: CampusMate never sees or stores any
// fingerprint or face data.
// A computer without a fingerprint reader or face unlock can
// still use the person's phone (scan a QR code at sign-in).
// =========================================================

// A readable name for this device, shown in the list.
function deviceName() {
  const agent =
    navigator.userAgent;

  if (/iPhone/i.test(agent)) return "iPhone";
  if (/iPad/i.test(agent)) return "iPad";
  if (/Android/i.test(agent)) return "Android phone";
  if (/Windows/i.test(agent)) return "Windows computer";
  if (/Macintosh|Mac OS/i.test(agent)) return "Mac";

  return "This device";
}

function isPhone() {
  return /iPhone|iPad|Android/i.test(navigator.userAgent);
}


function formatDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}


function BiometricSettings() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [hasReader, setHasReader] = useState(null);
  const [blinking, setBlinking] = useState(false);
  const [localId, setLocalId] = useState(thisDevicePasskeyId());

  const supported =
    biometricSupported();


  const loadDevices = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;

      const list = data || [];
      setDevices(list);

      // The passkey for this device was removed somewhere else
      const savedId = thisDevicePasskeyId();
      if (savedId && !list.some((device) => device.id === savedId)) {
        rememberThisDevice("");
        setLocalId("");
      }
    } catch (error) {
      setErrorMessage(biometricErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    if (!supported) return;

    // Data loading when the card opens
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDevices();
    deviceHasBiometrics().then(setHasReader);
  }, [supported, loadDevices]);


  const thisDevice =
    devices.find((device) => device.id === localId) || null;

  const thisMethods =
    thisDevice ? deviceMethods(thisDevice) : { fingerprint: false, face: false };


  async function rename(device, methods) {
    const { error } =
      await supabase.auth.passkey.update({
        passkeyId: device.id,
        friendlyName: nameWithMethods(deviceLabel(device), methods),
      });

    if (error) throw error;
  }


  // Turn on fingerprint or face for THIS device
  async function turnOn(kind) {
    setMessage("");
    setErrorMessage("");
    setWorking(kind);

    try {
      if (thisDevice) {
        // Already has a passkey: just add the method
        await rename(thisDevice, { ...thisMethods, [kind]: true });
      } else {
        const { data, error } = await supabase.auth.registerPasskey();

        if (error) {
          // Set up earlier in this browser before the change (or the
          // saved id was cleared): use that passkey if there is one
          // obvious match.
          const sameName = devices.filter((device) => deviceLabel(device) === deviceName());

          if (/already|exists|InvalidState/i.test(`${error.name} ${error.message}`) && sameName.length === 1) {
            rememberThisDevice(sameName[0].id);
            setLocalId(sameName[0].id);
            await rename(sameName[0], { ...deviceMethods(sameName[0]), [kind]: true });
          } else {
            throw error;
          }
        } else if (data?.id) {
          rememberThisDevice(data.id);
          setLocalId(data.id);
          await rename({ id: data.id, friendly_name: deviceName() }, {
            fingerprint: kind === "fingerprint",
            face: kind === "face",
          });
        }
      }

      setMessage(
        kind === "face"
          ? "Face sign-in is on for this device."
          : "Fingerprint sign-in is on for this device."
      );
      await loadDevices();
    } catch (error) {
      setErrorMessage(biometricErrorMessage(error, kind));
    } finally {
      setWorking("");
    }
  }


  // Turn off fingerprint or face for THIS device
  async function turnOff(kind) {
    if (!thisDevice) return;

    setMessage("");
    setErrorMessage("");
    setWorking(kind);

    const next = { ...thisMethods, [kind]: false };

    try {
      if (!next.fingerprint && !next.face) {
        const { error } = await supabase.auth.passkey.delete({ passkeyId: thisDevice.id });
        if (error) throw error;
        rememberThisDevice("");
        setLocalId("");
      } else {
        await rename(thisDevice, next);
      }

      setMessage(
        kind === "face"
          ? "Face sign-in is off for this device."
          : "Fingerprint sign-in is off for this device."
      );
      await loadDevices();
    } catch (error) {
      setErrorMessage(biometricErrorMessage(error, kind));
    } finally {
      setWorking("");
    }
  }


  async function removeDevice(device) {
    if (!window.confirm("Turn off fingerprint and face sign-in for this device?")) return;

    setMessage("");
    setErrorMessage("");

    const { error } =
      await supabase.auth.passkey.delete({ passkeyId: device.id });

    if (error) {
      setErrorMessage(biometricErrorMessage(error));
      return;
    }

    if (device.id === localId) {
      rememberThisDevice("");
      setLocalId("");
    }

    setMessage("Removed. That device now needs your password to sign in.");
    loadDevices();
  }


  function renderOption(kind, Icon, title, text) {
    const on = thisMethods[kind];

    return (
      <div key={kind} className={`biometric-option ${on ? "on" : ""}`}>
        <span className="biometric-option-icon"><Icon size={20} aria-hidden="true" /></span>

        <div className="biometric-option-text">
          <strong>{title}</strong>
          <span>{text}</span>
          <em className={on ? "on" : ""}>{on ? "On for this device" : "Off"}</em>
        </div>

        {on ? (
          <button
            type="button"
            className="biometric-off"
            onClick={() => turnOff(kind)}
            disabled={Boolean(working)}
          >
            {working === kind ? "Saving..." : "Turn off"}
          </button>
        ) : (
          <button
            type="button"
            className="biometric-setup"
            onClick={() => (kind === "face" ? setBlinking(true) : turnOn("fingerprint"))}
            disabled={Boolean(working) || blinking}
          >
            {working === kind
              ? "Waiting for your device..."
              : kind === "face" ? "Set up face" : "Set up fingerprint"}
          </button>
        )}
      </div>
    );
  }


  return (
    <section className="biometric-card">

      <div className="biometric-header">
        <div className="biometric-icon">
          <Fingerprint size={22} aria-hidden="true" />
        </div>

        <div>
          <h2>Fingerprint &amp; face sign-in</h2>
          <p>
            Sign in without typing your password. Turn on fingerprint, face, or both,
            separately on each device.
          </p>
        </div>
      </div>


      <div className="biometric-body">

        {!supported ? (
          <p className="biometric-note">
            This browser can't use fingerprint or face sign-in. Open CampusMate on its
            secure (https) address in an up-to-date browser to set it up.
          </p>
        ) : (
          <>
            {message && <p className="biometric-message" role="status">{message}</p>}
            {errorMessage && <p className="biometric-error" role="alert">{errorMessage}</p>}

            {hasReader === false ? (
              <div className="biometric-noreader">
                <Laptop size={20} aria-hidden="true" />
                <div>
                  <strong>
                    {isPhone()
                      ? "This device has no fingerprint or face unlock turned on."
                      : "This computer has no fingerprint reader or face unlock."}
                  </strong>
                  <p>You can still sign in without a password:</p>
                  <ol>
                    <li>Open CampusMate on your phone, go to Settings and set up fingerprint or face there.</li>
                    <li>On this computer, click Fingerprint or Face on the sign-in page and choose "Use a phone or tablet". Scan the QR code with your phone and confirm.</li>
                  </ol>
                  {!isPhone() && (
                    <p className="biometric-note">
                      Have Windows Hello? Turn it on in Windows Settings → Accounts → Sign-in options, then
                      come back here.
                    </p>
                  )}
                </div>
              </div>
            ) : blinking ? (
              <div className="biometric-blink">
                <p className="biometric-note">
                  First, show you're a real person: blink 2 times at the camera.
                </p>
                <BlinkCheck
                  onPassed={() => {
                    setBlinking(false);
                    turnOn("face");
                  }}
                  onCancel={() => setBlinking(false)}
                />
              </div>
            ) : (
              <div className="biometric-options">
                {renderOption("fingerprint", Fingerprint, "Fingerprint", "Touch your fingerprint reader when asked.")}
                {renderOption("face", ScanFace, "Face", "Blink 2 times at the camera, then confirm with your face unlock.")}
              </div>
            )}

            <p className="biometric-note">
              Your fingerprint and face never leave your device. CampusMate doesn't store them.
            </p>

            <h3>Devices set up</h3>

            {loading ? (
              <p className="biometric-note">Loading...</p>
            ) : devices.length === 0 ? (
              <p className="biometric-note">None yet.</p>
            ) : (
              <ul className="biometric-devices">
                {devices.map((device) => {
                  const methods = deviceMethods(device);

                  return (
                    <li key={device.id}>
                      <Smartphone size={18} aria-hidden="true" />

                      <div>
                        <strong>
                          <span data-no-translate>{deviceLabel(device)}</span>
                          {device.id === localId && <small className="biometric-this"> (this device)</small>}
                        </strong>

                        <span className="biometric-chips">
                          {methods.fingerprint && <i><Fingerprint size={12} aria-hidden="true" /> Fingerprint</i>}
                          {methods.face && <i><ScanFace size={12} aria-hidden="true" /> Face</i>}
                        </span>

                        <span>
                          Added {formatDate(device.created_at)}
                          {device.last_used_at ? ` · last used ${formatDate(device.last_used_at)}` : ""}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeDevice(device)}
                        aria-label="Remove device"
                        title="Remove"
                      >
                        <Trash2 size={17} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

      </div>

    </section>
  );
}

export default BiometricSettings;
