import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useStore } from '../store/useStore';
import { createVideoObjectUrl } from '../utils/videoUtils';
import { cyclePlaybackSpeed } from '../utils/timeUtils';
import {
  TimelineMarkers,
  ClipRangeControls,
  VolumeControl,
  PlaybackSpeedControl,
  TimeDisplay,
  LoopToggle,
  FullscreenToggle,
} from './shared';
import type { Asset } from '../types';
import './VideoPreviewModal.css';
import './shared/timeline-common.css';

interface VideoPreviewModalProps {
  asset: Asset;
  onClose: () => void;
  // Initial clip points (for editing existing clips)
  initialInPoint?: number;
  initialOutPoint?: number;
  // Callbacks for clip editing
  onInPointSet?: (time: number) => void;
  onOutPointSet?: (time: number) => void;
  onClipSave?: (inPoint: number, outPoint: number) => void;
  // Callback for frame capture (IN only + Save triggers this)
  onFrameCapture?: (timestamp: number) => void;
}

export default function VideoPreviewModal({
  asset,
  onClose,
  initialInPoint,
  initialOutPoint,
  onInPointSet,
  onOutPointSet,
  onClipSave,
  onFrameCapture,
}: VideoPreviewModalProps) {
  const {
    globalVolume,
    globalMuted,
    setGlobalVolume,
    toggleGlobalMute,
  } = useStore();

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Timeline editing state - initialize from props if available
  const [inPoint, setInPoint] = useState<number | null>(initialInPoint ?? null);
  const [outPoint, setOutPoint] = useState<number | null>(initialOutPoint ?? null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Load video URL
  useEffect(() => {
    let isMounted = true;

    const loadVideo = async () => {
      if (!asset.path) return;

      setIsLoading(true);
      const url = await createVideoObjectUrl(asset.path);

      if (isMounted && url) {
        setVideoUrl(url);
      }
      setIsLoading(false);
    };

    loadVideo();

    return () => {
      isMounted = false;
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [asset.path]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(5);
          break;
        case 'm':
          toggleGlobalMute();
          break;
        case 'i':
          handleSetInPoint();
          break;
        case 'o':
          handleSetOutPoint();
          break;
        case '[':
          cycleSpeed(-1);
          break;
        case ']':
          cycleSpeed(1);
          break;
        case 'l':
          setIsLooping(prev => !prev);
          break;
        case 'f':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, playbackSpeed, toggleGlobalMute]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const skip = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
  }, [duration]);

  const cycleSpeed = useCallback((direction: number) => {
    setPlaybackSpeed(current => cyclePlaybackSpeed(current, direction));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && modalRef.current) {
      modalRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleSetInPoint = useCallback(() => {
    setInPoint(currentTime);
    onInPointSet?.(currentTime);
  }, [currentTime, onInPointSet]);

  const handleSetOutPoint = useCallback(() => {
    setOutPoint(currentTime);
    onOutPointSet?.(currentTime);
  }, [currentTime, onOutPointSet]);

  // Save handler: if both IN and OUT are set, save clip; if only IN is set, capture frame
  const handleSave = useCallback(() => {
    if (inPoint !== null && outPoint !== null) {
      // Both points set - save as clip
      const start = Math.min(inPoint, outPoint);
      const end = Math.max(inPoint, outPoint);
      onClipSave?.(start, end);
      onClose();
    } else if (inPoint !== null && outPoint === null) {
      // Only IN point set - capture frame at IN point
      onFrameCapture?.(inPoint);
    }
  }, [inPoint, outPoint, onClipSave, onFrameCapture, onClose]);

  const handleClearPoints = useCallback(() => {
    setInPoint(null);
    setOutPoint(null);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);

      // If this is an existing clip (both initialInPoint and initialOutPoint set),
      // stop playback at the OUT point
      if (initialInPoint !== undefined && initialOutPoint !== undefined) {
        if (videoRef.current.currentTime >= initialOutPoint) {
          if (isLooping) {
            videoRef.current.currentTime = initialInPoint;
          } else {
            videoRef.current.pause();
            setIsPlaying(false);
            videoRef.current.currentTime = initialInPoint;
          }
        }
      }
    }
  }, [initialInPoint, initialOutPoint, isLooping]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);

      if (initialInPoint !== undefined) {
        videoRef.current.currentTime = initialInPoint;
        setCurrentTime(initialInPoint);
      }
    }
  }, [initialInPoint]);

  const handleVideoEnded = useCallback(() => {
    if (isLooping && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    } else {
      setIsPlaying(false);
    }
  }, [isLooping]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  // Apply playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Apply global volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = globalVolume;
      videoRef.current.muted = globalMuted;
    }
  }, [globalVolume, globalMuted]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Determine if Save button should show and its behavior
  const hasInPoint = inPoint !== null;
  const showSaveButton = hasInPoint && (onClipSave || onFrameCapture);

  return (
    <div className="video-preview-overlay" onClick={onClose}>
      <div
        className="video-preview-modal"
        ref={modalRef}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="video-preview-header">
          <div className="video-preview-title">
            <span className="video-name">{asset.name}</span>
            {asset.metadata?.width && asset.metadata?.height && (
              <span className="video-resolution">
                {asset.metadata.width}×{asset.metadata.height}
              </span>
            )}
          </div>
          <button className="close-btn" onClick={onClose} title="Close (Esc)">
            <X size={20} />
          </button>
        </div>

        {/* Video Container */}
        <div className="video-preview-container">
          {isLoading ? (
            <div className="video-loading">
              <div className="loading-spinner" />
              <span>Loading video...</span>
            </div>
          ) : videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="video-player"
              onClick={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={handleVideoEnded}
            />
          ) : (
            <div className="video-error">
              <span>Failed to load video</span>
            </div>
          )}

          {/* Play overlay */}
          {!isPlaying && !isLoading && videoUrl && (
            <div className="play-overlay" onClick={togglePlay}>
              <Play size={64} />
            </div>
          )}
        </div>

        {/* Timeline / Progress - matching PreviewModal layout */}
        <div className="video-timeline-section">
          <div
            className="video-progress-bar"
            ref={progressRef}
            onClick={handleProgressClick}
          >
            <TimelineMarkers
              inPoint={inPoint}
              outPoint={outPoint}
              duration={duration}
              showMilliseconds={true}
            />
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="progress-playhead"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
          {/* Time display and speed on the right, matching PreviewModal */}
          <div className="progress-info">
            <TimeDisplay currentTime={currentTime} totalDuration={duration} showMilliseconds={true} />
            <PlaybackSpeedControl speed={playbackSpeed} onSpeedChange={setPlaybackSpeed} />
          </div>
        </div>

        {/* Controls - matching PreviewModal layout */}
        <div className="video-controls">
          <div className="controls-left">
            {/* Play/Pause */}
            <button
              className="control-btn"
              onClick={togglePlay}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>

            {/* Skip buttons */}
            <button
              className="control-btn"
              onClick={() => skip(-5)}
              title="Rewind 5s (←)"
            >
              <SkipBack size={18} />
            </button>
            <button
              className="control-btn"
              onClick={() => skip(5)}
              title="Forward 5s (→)"
            >
              <SkipForward size={18} />
            </button>

            {/* Volume - using global store */}
            <VolumeControl
              volume={globalVolume}
              isMuted={globalMuted}
              onVolumeChange={setGlobalVolume}
              onMuteToggle={toggleGlobalMute}
            />
          </div>

          <div className="controls-center">
            {/* Navigation placeholder for alignment */}
          </div>

          <div className="controls-right">
            {/* IN/OUT controls with conditional Save button */}
            <ClipRangeControls
              inPoint={inPoint}
              outPoint={outPoint}
              onSetInPoint={handleSetInPoint}
              onSetOutPoint={handleSetOutPoint}
              onClear={handleClearPoints}
              onSave={showSaveButton ? handleSave : undefined}
              showSaveButton={!!showSaveButton}
              showMilliseconds={true}
            />
            <LoopToggle isLooping={isLooping} onToggle={() => setIsLooping(!isLooping)} />
            <FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
          </div>
        </div>
      </div>
    </div>
  );
}
