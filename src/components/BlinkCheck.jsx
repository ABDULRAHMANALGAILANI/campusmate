import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ScanFace,
} from "lucide-react";

import "./BlinkCheck.css";


// =========================================================
// BLINK CHECK
// Shows the camera and asks the person to blink twice before
// face sign-in continues. Everything runs in the browser:
// no camera image is saved or sent anywhere.
//
// onPassed  -> called after 2 blinks
// onCancel  -> called when the person goes back
// =========================================================

const BLINKS_NEEDED =
  2;

const TIME_LIMIT_MS =
  30000;

// Eye "closed" / "open" thresholds from MediaPipe's blink score
const CLOSED_ABOVE =
  0.45;

const OPEN_BELOW =
  0.2;

// Pinned to the installed version so the files always match.
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";


function blinkScore(result) {
  const categories =
    result?.faceBlendshapes?.[0]?.categories || [];

  const left =
    categories.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0;

  const right =
    categories.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0;

  return (left + right) / 2;
}


function BlinkCheck({
  onPassed,
  onCancel,
}) {
  const videoRef =
    useRef(null);

  // loading | no-camera | looking | ready | passed | timeout | error
  const [
    status,
    setStatus,
  ] = useState("loading");

  const [
    blinks,
    setBlinks,
  ] = useState(0);

  const [
    hint,
    setHint,
  ] = useState("");

  const [
    attempt,
    setAttempt,
  ] = useState(0);


  useEffect(() => {
    let active =
      true;

    let stream =
      null;

    let landmarker =
      null;

    let frame =
      0;

    let timer =
      0;

    async function start() {
      setStatus("loading");
      setBlinks(0);
      setHint("");

      // 1. Camera
      try {
        stream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          });
      } catch {
        if (active) setStatus("no-camera");
        return;
      }

      if (!active) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video =
        videoRef.current;

      video.srcObject =
        stream;

      await video.play().catch(() => {});

      // 2. Face model (loaded only when someone uses face sign-in)
      try {
        const {
          FaceLandmarker,
          FilesetResolver,
        } =
          await import("@mediapipe/tasks-vision");

        const files =
          await FilesetResolver.forVisionTasks(WASM_URL);

        landmarker =
          await FaceLandmarker.createFromOptions(files, {
            baseOptions: {
              modelAssetPath: MODEL_URL,
            },
            runningMode: "VIDEO",
            numFaces: 2,
            outputFaceBlendshapes: true,
          });
      } catch {
        if (active) setStatus("error");
        return;
      }

      if (!active) return;

      setStatus("looking");

      // 3. Count blinks
      let eyesClosed =
        false;

      let count =
        0;

      let lastTime =
        -1;

      timer =
        window.setTimeout(() => {
          if (active && count < BLINKS_NEEDED) {
            setStatus("timeout");
            cancelAnimationFrame(frame);
          }
        }, TIME_LIMIT_MS);

      function tick() {
        if (!active) return;

        const now =
          performance.now();

        if (video.readyState >= 2 && now !== lastTime) {
          lastTime =
            now;

          const result =
            landmarker.detectForVideo(video, now);

          const faces =
            result.faceLandmarks?.length || 0;

          if (faces === 0) {
            setStatus("looking");
            setHint("Look straight at the camera.");
          } else if (faces > 1) {
            setStatus("looking");
            setHint("Only one person in view, please.");
          } else {
            setStatus("ready");
            setHint("");

            const score =
              blinkScore(result);

            if (!eyesClosed && score > CLOSED_ABOVE) {
              eyesClosed = true;
            } else if (eyesClosed && score < OPEN_BELOW) {
              eyesClosed = false;
              count += 1;
              setBlinks(count);

              if (count >= BLINKS_NEEDED) {
                setStatus("passed");
                window.clearTimeout(timer);
                window.setTimeout(() => {
                  if (active) onPassed();
                }, 600);
                return;
              }
            }
          }
        }

        frame =
          requestAnimationFrame(tick);
      }

      frame =
        requestAnimationFrame(tick);
    }

    start();

    return () => {
      active =
        false;

      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      landmarker?.close();
      stream?.getTracks().forEach((track) => track.stop());
    };
    // onPassed is intentionally left out: restarting the camera
    // whenever the parent re-renders would reset the count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);


  const headline = {
    loading: "Starting camera...",
    "no-camera": "Camera not available",
    looking: "Blink 2 times",
    ready: "Blink 2 times",
    passed: "Done",
    timeout: "We didn't see 2 blinks",
    error: "Face check couldn't start",
  }[status];

  const message = {
    loading: "Allow camera access if your browser asks.",
    "no-camera":
      "Allow camera access in your browser settings, or sign in with your fingerprint or password instead.",
    looking: hint || "Look at the camera, then blink twice slowly.",
    ready: "Blink twice slowly.",
    passed: "Now confirm with your device's face unlock.",
    timeout: "Make sure your face is well lit, then try again.",
    error: "Check your internet connection and try again.",
  }[status];

  const canRetry =
    status === "timeout" || status === "error";


  return (
    <div className="blink-check">

      <div
        className={`blink-camera ${status}`}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Your camera"
        />

        {(status === "loading" ||
          status === "no-camera" ||
          status === "error") && (
          <div className="blink-camera-placeholder">
            <ScanFace
              size={48}
              aria-hidden="true"
            />
          </div>
        )}

        <div
          className="blink-oval"
          aria-hidden="true"
        />
      </div>


      <div
        className="blink-status"
        role="status"
        aria-live="polite"
      >
        <strong>
          {headline}
        </strong>

        <p>
          {message}
        </p>

        <div
          className="blink-dots"
          aria-label={`${blinks} of ${BLINKS_NEEDED} blinks`}
        >
          {Array.from({ length: BLINKS_NEEDED }, (_, index) => (
            <span
              key={index}
              className={index < blinks ? "done" : ""}
            />
          ))}
        </div>
      </div>


      <div className="signin-actions">
        <button
          type="button"
          className="signin-button"
          onClick={onCancel}
        >
          Back
        </button>

        {canRetry && (
          <button
            type="button"
            className="signin-button primary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        )}
      </div>

    </div>
  );
}

export default BlinkCheck;
