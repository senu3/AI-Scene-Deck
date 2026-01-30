import { useState, useRef, useEffect } from "react";
import { X, Camera, Play, Pause, Volume2 } from "lucide-react";
import type { Asset } from "../types";
import "./LipSyncModal.css";

interface LipSyncModalProps {
  asset: Asset;
  sceneId: string;
  onClose: () => void;
}

interface FrameData {
  closed: string | null;
  half1: string | null;
  half2: string | null;
  open: string | null;
}

const FRAME_PHASES = [
  { id: "closed", label: "Closed", desc: "Silent / RMS < T1" },
  { id: "half1", label: "Half 1", desc: "Quiet / T1 <= RMS < T2" },
  { id: "half2", label: "Half 2", desc: "Normal / T2 <= RMS < T3" },
  { id: "open", label: "Open", desc: "Loud / RMS >= T3" },
] as const;

export default function LipSyncModal({ asset, sceneId, onClose }: LipSyncModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [frames, setFrames] = useState<FrameData>({
    closed: null,
    half1: null,
    half2: null,
    open: null,
  });
  const [activeFrameSlot, setActiveFrameSlot] = useState<keyof FrameData | null>("closed");

  // Thresholds (normalized 0-1)
  const [thresholds, setThresholds] = useState({
    t1: 0.05,
    t2: 0.15,
    t3: 0.30,
  });

  const isVideo = asset.type === "video";

  useEffect(() => {
    // Close on escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const captureFrame = (phaseId: keyof FrameData) => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");

    setFrames((prev) => ({ ...prev, [phaseId]: dataUrl }));

    // Auto-advance to next empty slot
    const slots: (keyof FrameData)[] = ["closed", "half1", "half2", "open"];
    const currentIndex = slots.indexOf(phaseId);
    for (let i = currentIndex + 1; i < slots.length; i++) {
      if (!frames[slots[i]]) {
        setActiveFrameSlot(slots[i]);
        break;
      }
    }
  };

  const handleCaptureForActiveSlot = () => {
    if (activeFrameSlot) {
      captureFrame(activeFrameSlot);
    }
  };

  const handleThresholdChange = (key: "t1" | "t2" | "t3", value: number) => {
    setThresholds((prev) => ({ ...prev, [key]: value }));
  };

  const handleRegister = () => {
    // TODO: Implement lip sync cut creation
    console.log("Register lip sync with:", { frames, thresholds, sceneId });
    alert("Lip Sync registration (UI mock only)");
    onClose();
  };

  const allFramesCaptured = frames.closed && frames.half1 && frames.half2 && frames.open;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  return (
    <div className="lipsync-modal-overlay" onClick={onClose}>
      <div className="lipsync-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lipsync-modal-header">
          <h2>Lip Sync Setup</h2>
          <button className="lipsync-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="lipsync-modal-body">
          {/* Left: Video Preview & Controls */}
          <div className="lipsync-preview-section">
            <div className="lipsync-video-container">
              {isVideo ? (
                <video
                  ref={videoRef}
                  src={`media://${encodeURIComponent(asset.path)}`}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onLoadedMetadata={handleVideoLoadedMetadata}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="lipsync-video"
                />
              ) : (
                <img
                  src={asset.thumbnail || ""}
                  alt={asset.name}
                  className="lipsync-image"
                />
              )}
            </div>

            {isVideo && (
              <div className="lipsync-video-controls">
                <button className="lipsync-play-btn" onClick={handlePlayPause}>
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.01}
                  value={currentTime}
                  onChange={handleSeek}
                  className="lipsync-seekbar"
                />
                <span className="lipsync-time">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
            )}

            {isVideo && (
              <button
                className="lipsync-capture-btn"
                onClick={handleCaptureForActiveSlot}
                disabled={!activeFrameSlot}
              >
                <Camera size={16} />
                Capture Frame for "{activeFrameSlot ? FRAME_PHASES.find(p => p.id === activeFrameSlot)?.label : "..."}"
              </button>
            )}
          </div>

          {/* Right: Frame Slots & Thresholds */}
          <div className="lipsync-settings-section">
            {/* Frame Grid */}
            <div className="lipsync-frames-section">
              <h3>Frame Capture (4 Phases)</h3>
              <div className="lipsync-frame-grid">
                {FRAME_PHASES.map((phase) => (
                  <div
                    key={phase.id}
                    className={`lipsync-frame-slot ${activeFrameSlot === phase.id ? "active" : ""} ${frames[phase.id] ? "captured" : ""}`}
                    onClick={() => setActiveFrameSlot(phase.id as keyof FrameData)}
                  >
                    <div className="frame-slot-preview">
                      {frames[phase.id] ? (
                        <img src={frames[phase.id]!} alt={phase.label} />
                      ) : (
                        <Camera size={24} className="frame-slot-icon" />
                      )}
                    </div>
                    <div className="frame-slot-info">
                      <span className="frame-slot-label">{phase.label}</span>
                      <span className="frame-slot-desc">{phase.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Thresholds */}
            <div className="lipsync-thresholds-section">
              <h3>
                <Volume2 size={16} />
                RMS Thresholds
              </h3>
              <div className="threshold-sliders">
                <div className="threshold-item">
                  <label>T1 (Half1)</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={thresholds.t1}
                    onChange={(e) => handleThresholdChange("t1", parseFloat(e.target.value))}
                  />
                  <span>{thresholds.t1.toFixed(2)}</span>
                </div>
                <div className="threshold-item">
                  <label>T2 (Half2)</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={thresholds.t2}
                    onChange={(e) => handleThresholdChange("t2", parseFloat(e.target.value))}
                  />
                  <span>{thresholds.t2.toFixed(2)}</span>
                </div>
                <div className="threshold-item">
                  <label>T3 (Open)</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={thresholds.t3}
                    onChange={(e) => handleThresholdChange("t3", parseFloat(e.target.value))}
                  />
                  <span>{thresholds.t3.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="lipsync-modal-footer">
          <button className="lipsync-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="lipsync-register-btn"
            onClick={handleRegister}
            disabled={!allFramesCaptured}
          >
            Register Lip Sync Cut
          </button>
        </div>
      </div>
    </div>
  );
}
