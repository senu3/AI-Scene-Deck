/**
 * LipSyncModal - Side Panel Layout (Based on Preview Mockup v3)
 *
 * Left: Video preview with playback controls and capture button
 * Right: Frame grid, threshold settings, and action buttons
 */

import { useState, useRef, useEffect } from "react";
import { X, Camera, Play, Pause, Mic, Volume2, Film, Check, Brush } from "lucide-react";
import type { Asset } from "../types";
import MaskPaintModal from "./MaskPaintModal";
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
  { id: "half1", label: "Half 1", desc: "Quiet / T1 ≤ RMS < T2" },
  { id: "half2", label: "Half 2", desc: "Normal / T2 ≤ RMS < T3" },
  { id: "open", label: "Open", desc: "Loud / RMS ≥ T3" },
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

  const [thresholds, setThresholds] = useState({
    t1: 0.05,
    t2: 0.15,
    t3: 0.30,
  });

  // Mask state
  const [showMaskEditor, setShowMaskEditor] = useState(false);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [baseImageSize, setBaseImageSize] = useState({ width: 0, height: 0 });

  const isVideo = asset.type === "video";

  // Captured frame count
  const capturedCount = Object.values(frames).filter(Boolean).length;
  const allFramesCaptured = capturedCount === 4;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      // Space for capture
      if (e.key === " " && activeFrameSlot && isVideo) {
        e.preventDefault();
        captureFrame(activeFrameSlot);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, activeFrameSlot, isVideo]);

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

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
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
        return;
      }
    }
    // Check earlier slots if later ones are filled
    for (let i = 0; i < currentIndex; i++) {
      if (!frames[slots[i]]) {
        setActiveFrameSlot(slots[i]);
        return;
      }
    }
    // All filled
    setActiveFrameSlot(null);
  };

  const handleCaptureClick = () => {
    if (activeFrameSlot) {
      captureFrame(activeFrameSlot);
    }
  };

  const handleThresholdChange = (key: "t1" | "t2" | "t3", value: number) => {
    setThresholds((prev) => ({ ...prev, [key]: value }));
  };

  const handleRegister = () => {
    console.log("Register lip sync with:", { frames, thresholds, sceneId, maskDataUrl });
    alert("Lip Sync registration (UI mock only)");
    onClose();
  };

  // Open mask editor - requires a base image (closed frame or thumbnail for testing)
  const handleOpenMaskEditor = () => {
    // Use the closed frame as base image, or fall back to thumbnail for testing
    const baseFrame = frames.closed || asset.thumbnail;
    if (!baseFrame) {
      alert("No base image available. Please capture the 'Closed' frame or ensure asset has a thumbnail.");
      return;
    }

    // Get image dimensions from the captured frame
    const img = new Image();
    img.onload = () => {
      setBaseImageSize({ width: img.width, height: img.height });
      setShowMaskEditor(true);
    };
    img.onerror = () => {
      // Fallback dimensions if image fails to load
      setBaseImageSize({ width: 1920, height: 1080 });
      setShowMaskEditor(true);
    };
    img.src = baseFrame;
  };

  const handleSaveMask = (dataUrl: string) => {
    setMaskDataUrl(dataUrl);
    setShowMaskEditor(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="lipsync-modal-overlay" onClick={onClose}>
      <div className="lipsync-modal" onClick={(e) => e.stopPropagation()}>
        {/* Left: Preview Section */}
        <div className="lipsync-preview-section">
          <button className="lipsync-close-btn" onClick={onClose}>
            <X size={20} />
          </button>

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
            ) : asset.thumbnail ? (
              <img src={asset.thumbnail} alt={asset.name} className="lipsync-image" />
            ) : (
              <div className="lipsync-preview-placeholder">
                <Film size={64} />
                <span>No preview available</span>
              </div>
            )}
          </div>

          {isVideo && (
            <div className="lipsync-controls-bar">
              <div
                className="lipsync-progress-bar"
                onClick={handleProgressClick}
              >
                <div
                  className="lipsync-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="lipsync-playback-row">
                <button className="lipsync-play-btn" onClick={handlePlayPause}>
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>

                <span className="lipsync-time">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                <button
                  className="lipsync-capture-btn"
                  onClick={handleCaptureClick}
                  disabled={!activeFrameSlot}
                >
                  <Camera size={16} />
                  {activeFrameSlot
                    ? `Capture "${FRAME_PHASES.find((p) => p.id === activeFrameSlot)?.label}"`
                    : "All Captured"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Detail Panel */}
        <div className="lipsync-detail-panel">
          <div className="lipsync-panel-header">
            <div className="lipsync-panel-icon">
              <Mic size={18} />
            </div>
            <h3 className="lipsync-panel-title">Lip Sync Setup</h3>
          </div>

          <div className="lipsync-panel-content">
            {/* Progress indicator */}
            <div className="lipsync-progress-indicator">
              <div className="progress-dots">
                {FRAME_PHASES.map((phase) => (
                  <div
                    key={phase.id}
                    className={`progress-dot ${
                      frames[phase.id] ? "filled" : ""
                    } ${activeFrameSlot === phase.id ? "current" : ""}`}
                  />
                ))}
              </div>
              <span className="progress-text">
                <strong>{capturedCount}</strong> / 4 frames
              </span>
            </div>

            {/* Frame Grid */}
            <div className="lipsync-section">
              <h4 className="lipsync-section-title">
                <Camera size={12} />
                Frame Capture
              </h4>
              <div className="lipsync-frame-grid">
                {FRAME_PHASES.map((phase) => (
                  <div
                    key={phase.id}
                    className={`lipsync-frame-slot ${
                      activeFrameSlot === phase.id ? "active" : ""
                    } ${frames[phase.id] ? "captured" : ""}`}
                    onClick={() => setActiveFrameSlot(phase.id as keyof FrameData)}
                  >
                    <div className="frame-preview">
                      {frames[phase.id] ? (
                        <img src={frames[phase.id]!} alt={phase.label} />
                      ) : (
                        <Camera size={20} className="frame-preview-icon" />
                      )}
                    </div>
                    <div className="frame-info">
                      <span className="frame-label">{phase.label}</span>
                      <span className="frame-desc">{phase.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mask Editor */}
            <div className="lipsync-section">
              <h4 className="lipsync-section-title">
                <Brush size={12} />
                Mouth Mask
              </h4>
              <div className="lipsync-mask-area">
                {maskDataUrl ? (
                  <div className="lipsync-mask-preview">
                    <img src={maskDataUrl} alt="Mask" className="mask-thumbnail" />
                    <div className="mask-info">
                      <span className="mask-status">Mask created</span>
                      <button
                        className="mask-edit-btn"
                        onClick={handleOpenMaskEditor}
                        disabled={!frames.closed && !asset.thumbnail}
                      >
                        Edit Mask
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="lipsync-create-mask-btn"
                    onClick={handleOpenMaskEditor}
                    disabled={!frames.closed && !asset.thumbnail}
                  >
                    <Brush size={16} />
                    Create Mouth Mask
                  </button>
                )}
                {!frames.closed && !asset.thumbnail && (
                  <p className="mask-hint">Capture "Closed" frame first</p>
                )}
                {!frames.closed && asset.thumbnail && (
                  <p className="mask-hint">Using thumbnail as base (dev mode)</p>
                )}
              </div>
            </div>

            {/* Thresholds */}
            <div className="lipsync-section">
              <h4 className="lipsync-section-title">
                <Volume2 size={12} />
                RMS Thresholds
              </h4>
              <div className="lipsync-thresholds">
                <div className="threshold-row">
                  <span className="threshold-label">T1 (Half1)</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={thresholds.t1}
                    onChange={(e) => handleThresholdChange("t1", parseFloat(e.target.value))}
                    className="threshold-slider"
                  />
                  <span className="threshold-value">{thresholds.t1.toFixed(2)}</span>
                </div>
                <div className="threshold-row">
                  <span className="threshold-label">T2 (Half2)</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={thresholds.t2}
                    onChange={(e) => handleThresholdChange("t2", parseFloat(e.target.value))}
                    className="threshold-slider"
                  />
                  <span className="threshold-value">{thresholds.t2.toFixed(2)}</span>
                </div>
                <div className="threshold-row">
                  <span className="threshold-label">T3 (Open)</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={thresholds.t3}
                    onChange={(e) => handleThresholdChange("t3", parseFloat(e.target.value))}
                    className="threshold-slider"
                  />
                  <span className="threshold-value">{thresholds.t3.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lipsync-panel-footer">
            <button className="lipsync-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="lipsync-register-btn"
              onClick={handleRegister}
              disabled={!allFramesCaptured}
            >
              <Check size={16} />
              Register
            </button>
          </div>
        </div>
      </div>

      {/* Mask Paint Modal */}
      {showMaskEditor && (frames.closed || asset.thumbnail) && (
        <MaskPaintModal
          baseImage={frames.closed || asset.thumbnail!}
          imageWidth={baseImageSize.width}
          imageHeight={baseImageSize.height}
          existingMask={maskDataUrl || undefined}
          onSave={handleSaveMask}
          onClose={() => setShowMaskEditor(false)}
        />
      )}
    </div>
  );
}
