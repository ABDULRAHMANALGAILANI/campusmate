import {
  useEffect,
  useState,
} from "react";

import {
  Fingerprint,
  ScanFace,
  Smartphone,
  Trash2,
} from "lucide-react";

import { supabase } from "../lib/supabase";

import {
  biometricErrorMessage,
  biometricSupported,
} from "../lib/biometric";

import "./BiometricSettings.css";


// =========================================================
// FINGERPRINT & FACE SIGN-IN (Settings)
// Turns on sign-in with this device's fingerprint reader or
// face unlock (Windows Hello, Face ID, Touch ID, Android).
// One setup covers both buttons on the sign-in page.
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


function formatDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}


function BiometricSettings() {
  const [
    devices,
    setDevices,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    working,
    setWorking,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    refresh,
    setRefresh,
  ] = useState(0);

  const supported =
    biometricSupported();


  useEffect(() => {
    if (!supported) {
      return undefined;
    }

    let active =
      true;

    supabase.auth.passkey
      .list()
      .then(({ data, error }) => {
        if (!active) return;

        if (error) {
          setErrorMessage(biometricErrorMessage(error));
        } else {
          setDevices(data || []);
        }

        setLoading(false);
      })
      .catch((error) => {
        if (!active) return;

        setErrorMessage(biometricErrorMessage(error));
        setLoading(false);
      });

    return () => {
      active =
        false;
    };
  }, [supported, refresh]);


  async function setUpDevice() {
    setMessage("");
    setErrorMessage("");
    setWorking(true);

    try {
      const {
        data,
        error,
      } =
        await supabase.auth.registerPasskey();

      if (error) {
        throw error;
      }

      if (data?.id) {
        await supabase.auth.passkey.update({
          passkeyId: data.id,
          friendlyName: deviceName(),
        });
      }

      setMessage(
        "Done. You can now sign in on this device with your fingerprint or face."
      );

      setRefresh((value) => value + 1);
    } catch (error) {
      setErrorMessage(biometricErrorMessage(error));
    } finally {
      setWorking(false);
    }
  }


  async function removeDevice(device) {
    const confirmed =
      window.confirm(
        `Turn off fingerprint and face sign-in for "${
          device.friendly_name || "this device"
        }"?`
      );

    if (!confirmed) return;

    setMessage("");
    setErrorMessage("");

    const {
      error,
    } =
      await supabase.auth.passkey.delete({
        passkeyId: device.id,
      });

    if (error) {
      setErrorMessage(biometricErrorMessage(error));
      return;
    }

    setMessage("Removed. That device now needs your password to sign in.");
    setRefresh((value) => value + 1);
  }


  return (
    <section className="biometric-card">

      <div className="biometric-header">
        <div className="biometric-icon">
          <Fingerprint size={22} aria-hidden="true" />
        </div>

        <div>
          <h2>
            Fingerprint &amp; face sign-in
          </h2>

          <p>
            Sign in with your device's fingerprint reader or face
            unlock instead of typing your password.
          </p>
        </div>
      </div>


      <div className="biometric-body">

        {!supported ? (
          <p className="biometric-note">
            This browser can't use fingerprint or face sign-in.
            Open CampusMate on its secure (https) address in an
            up-to-date browser to set it up.
          </p>
        ) : (
          <>
            <ul className="biometric-how">
              <li>
                <Fingerprint size={18} aria-hidden="true" />
                <span>
                  <strong>Fingerprint:</strong> touch your
                  fingerprint reader when asked.
                </span>
              </li>

              <li>
                <ScanFace size={18} aria-hidden="true" />
                <span>
                  <strong>Face:</strong> blink 2 times at the
                  camera, then confirm with your face unlock.
                </span>
              </li>
            </ul>

            <p className="biometric-note">
              Your fingerprint and face never leave your device.
              CampusMate doesn't store them.
            </p>

            {message && (
              <p className="biometric-message" role="status">
                {message}
              </p>
            )}

            {errorMessage && (
              <p className="biometric-error" role="alert">
                {errorMessage}
              </p>
            )}

            <h3>
              Devices set up
            </h3>

            {loading ? (
              <p className="biometric-note">
                Loading...
              </p>
            ) : devices.length === 0 ? (
              <p className="biometric-note">
                None yet.
              </p>
            ) : (
              <ul className="biometric-devices">
                {devices.map((device) => (
                  <li key={device.id}>
                    <Smartphone size={18} aria-hidden="true" />

                    <div>
                      <strong>
                        {device.friendly_name || "Device"}
                      </strong>

                      <span>
                        Added {formatDate(device.created_at)}
                        {device.last_used_at
                          ? ` · last used ${formatDate(device.last_used_at)}`
                          : ""}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeDevice(device)}
                      aria-label={`Remove ${device.friendly_name || "device"}`}
                      title="Remove"
                    >
                      <Trash2 size={17} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              className="biometric-setup"
              onClick={setUpDevice}
              disabled={working}
            >
              <Fingerprint size={18} aria-hidden="true" />
              {working ? "Waiting for your device..." : "Set up this device"}
            </button>
          </>
        )}

      </div>

    </section>
  );
}

export default BiometricSettings;
