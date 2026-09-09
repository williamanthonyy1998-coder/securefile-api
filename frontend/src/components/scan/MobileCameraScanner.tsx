import { useEffect, useRef, useState } from "react";
import { Camera, Flashlight, FlashlightOff } from "lucide-react";

type CameraScannerState = "idle" | "starting" | "ready" | "capturing";

export default function MobileCameraScanner({ onPage, onError, busy }: any) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraScannerState>("idle");
  const [cameraError, setCameraError] = useState("");
  const [torch, setTorch] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function startCamera() {
    try {
      setCameraError("");
      setState("starting");
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera scanning is not supported by this browser. Please use the latest Chrome, Safari, or Edge over HTTPS.",
        );
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() || {}) as any;
      setTorchSupported(Boolean(caps.torch));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("ready");
    } catch (e: any) {
      setState("idle");
      setCameraError(
        e?.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access for SecureFile and try again."
          : e?.message || "Unable to start the camera.",
      );
    }
  }
  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorch(false);
    setState("idle");
  }
  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupported) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch }] } as any);
      setTorch((v) => !v);
    } catch {
      setCameraError(
        "This phone camera does not allow the flashlight to be controlled from the browser.",
      );
    }
  }
  async function capture() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    try {
      setState("capturing");
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 1920;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Camera capture is unavailable.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b
              ? resolve(b)
              : reject(new Error("Could not capture the camera frame.")),
          "image/jpeg",
          0.94,
        ),
      );
      const reader = new FileReader();
      const data = await new Promise<string>((resolve, reject) => {
        reader.onload = () =>
          resolve(String(reader.result || "").split(",")[1] || "");
        reader.onerror = () =>
          reject(new Error("Could not read the captured page."));
        reader.readAsDataURL(blob);
      });
      if (!data) throw new Error("Camera returned an empty image.");
      onPage({
        id: crypto.randomUUID(),
        name: `camera-page-${Date.now()}.jpg`,
        mimeType: "image/jpeg",
        data,
      });
      setState("ready");
    } catch (e: any) {
      setCameraError(e?.message || "Could not capture this page.");
      setState("ready");
    }
  }
  return (
    <div className="mobile-camera-card">
      <div className="mobile-scan-heading">
        <div>
          <h3>Scan with phone camera</h3>
          <p className="muted">
            Use the rear camera to capture one or more document pages directly
            in SecureFile.
          </p>
        </div>
        <Camera size={20} />
      </div>
      {cameraError && <div className="camera-error">{cameraError}</div>}
      {state === "idle" ? (
        <button
          className="btn mobile-primary-action"
          disabled={busy}
          onClick={startCamera}
        >
          <Camera size={17} /> Open Camera Scanner
        </button>
      ) : (
        <>
          <div className="camera-viewfinder">
            <video ref={videoRef} playsInline muted autoPlay />
            <div className="camera-corners" />
            <span className="camera-guide-label">
              Fit the full page inside the guide
            </span>
          </div>
          <div className="camera-toolbar">
            <button
              className="btn"
              disabled={state !== "ready" || busy}
              onClick={capture}
            >
              <Camera size={17} /> Capture Page
            </button>
            {torchSupported && (
              <button
                className="btn secondary"
                disabled={state !== "ready"}
                onClick={toggleTorch}
              >
                {torch ? <FlashlightOff size={16} /> : <Flashlight size={16} />}{" "}
                {torch ? "Flash off" : "Flash"}
              </button>
            )}
            <button className="btn secondary" onClick={stopCamera}>
              Close
            </button>
          </div>
          <p className="camera-hint">
            Capture each page, review the thumbnails below, then create one PDF.
          </p>
        </>
      )}
    </div>
  );
}
