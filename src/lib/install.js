import {
  useEffect,
  useState,
} from "react";


// =========================================================
// "INSTALL CAMPUSMATE" (Add to Home screen)
// Android / Chrome / Edge: the browser offers an install
// prompt (saved in main.jsx). iPhone / iPad Safari has no
// prompt, so we show how to do it by hand.
// =========================================================

const DISMISS_KEY = "campusmate-install-dismissed";


export function isInstalled() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}


export function isIos() {
  const ua = window.navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
}


export function wasDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}


export function rememberDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Private mode: the banner may show again next time
  }
}


// mode: "prompt" (browser can install), "ios" (show steps), or "" (nothing to offer)
export function useInstall() {
  const [mode, setMode] = useState(() => {
    if (typeof window === "undefined" || isInstalled()) return "";
    if (window.__campusmateInstall) return "prompt";
    if (isIos()) return "ios";
    return "";
  });

  useEffect(() => {
    function ready() {
      if (!isInstalled()) setMode("prompt");
    }

    function installed() {
      setMode("");
    }

    window.addEventListener("campusmate-installable", ready);
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("campusmate-installable", ready);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  async function install() {
    const offer = window.__campusmateInstall;
    if (!offer) return false;

    offer.prompt();
    const choice = await offer.userChoice.catch(() => null);
    window.__campusmateInstall = null;

    if (choice?.outcome === "accepted") {
      setMode("");
      return true;
    }

    return false;
  }

  return { mode, install };
}
