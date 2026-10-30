import {
  CheckCircle2,
  Download,
  Share,
  Smartphone,
} from "lucide-react";

import {
  isInstalled,
  useInstall,
} from "../lib/install";

import "./BiometricSettings.css";


// Settings card: install CampusMate on this phone or computer.
function InstallAppCard() {
  const { mode, install } = useInstall();
  const installed = isInstalled();

  return (
    <section className="biometric-card">
      <div className="biometric-header">
        <div className="biometric-icon">
          <Smartphone size={22} aria-hidden="true" />
        </div>
        <div>
          <h2>Install the app</h2>
          <p>Put CampusMate on your home screen so it opens like an app, full screen, with its own icon.</p>
        </div>
      </div>

      <div className="biometric-body">
        {installed ? (
          <p className="biometric-note">
            <CheckCircle2 size={16} aria-hidden="true" /> You're using the installed app.
          </p>
        ) : mode === "prompt" ? (
          <button type="button" className="biometric-setup" onClick={install}>
            <Download size={17} aria-hidden="true" />
            Install CampusMate
          </button>
        ) : mode === "ios" ? (
          <p className="biometric-note">
            In Safari, tap <Share size={14} aria-label="Share" /> <strong>Share</strong>, then{" "}
            <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <p className="biometric-note">
            On Android, open the browser menu (⋮) and tap <strong>Install app</strong> or{" "}
            <strong>Add to Home screen</strong>. On a computer, use the install icon in Chrome or
            Edge's address bar.
          </p>
        )}
      </div>
    </section>
  );
}

export default InstallAppCard;
