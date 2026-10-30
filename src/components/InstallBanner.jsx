import { useState } from "react";

import {
  Download,
  Share,
  X,
} from "lucide-react";

import {
  rememberDismissed,
  useInstall,
  wasDismissed,
} from "../lib/install";

import "./InstallBanner.css";


// Small card on phones: "Install CampusMate" so it opens like an
// app from the home screen. Shown until installed or dismissed.
function InstallBanner() {
  const { mode, install } = useInstall();
  const [hidden, setHidden] = useState(wasDismissed);
  const [showSteps, setShowSteps] = useState(false);

  if (!mode || hidden) return null;

  function close() {
    rememberDismissed();
    setHidden(true);
  }

  return (
    <div className="install-banner" role="region" aria-label="Install CampusMate">
      <img src="/icons/icon-192.png" alt="" width="40" height="40" />

      <div className="install-banner-text">
        <strong>Install CampusMate</strong>
        {mode === "ios" && showSteps ? (
          <small>
            Tap <Share size={13} aria-label="Share" /> Share, then <b>Add to Home Screen</b>.
          </small>
        ) : (
          <small>Open it from your home screen like an app.</small>
        )}
      </div>

      {mode === "prompt" ? (
        <button type="button" className="install-banner-button" onClick={install}>
          <Download size={15} aria-hidden="true" />
          Install
        </button>
      ) : !showSteps ? (
        <button type="button" className="install-banner-button" onClick={() => setShowSteps(true)}>
          How?
        </button>
      ) : null}

      <button type="button" className="install-banner-close" onClick={close} aria-label="Not now">
        <X size={17} />
      </button>
    </div>
  );
}

export default InstallBanner;
