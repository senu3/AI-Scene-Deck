import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Maximize2, SkipBack, SkipForward } from 'lucide-react';
import { createVideoObjectUrl } from '../utils/videoUtils';
import type { Asset } from '../types';
import './VideoPreviewModal.css';

interface VideoPreviewModalProps {
  asset: Asset;
  onClose: () => void;
  // Future: callbacks for timeline editing
  onInPointSet?: (time: number) => void;
  onOutPointSet?: (time: number) => void;
  onClipSave?: (inPoint: number, outPoint: number) => void;
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPreviewModal({
  asset,
  onClose,
  onInPointSet,
  onOutPointSet,
  onClipSave,
}: VideoPreviewModalProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);

  // Future: Timeline editing state
  const [inPoint, setInPoint] = useState<number | null>(null);
  const [outPoint, setOutPoint] = useState<number | null>(null);

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
        case 'ArrowUp':
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        case 'm':
          setIsMuted(prev => !prev);
          break;
        case 'i':
          // Set IN point
          handleSetInPoint();
          break;
        case 'o':
          // Set OUT point
          handleSetOutPoint();
          break;
        case '[':
          cycleSpeed(-1);
          break;
        case ']':
          cycleSpeed(1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, playbackSpeed]);

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

  const adjustVolume = useCallback((delta: number) => {
    setVolume(prev => Math.max(0, Math.min(1, prev + delta)));
  }, []);

  const cycleSpeed = useCallback((direction: number) => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const newIndex = Math.max(0, Math.min(PLAYBACK_SPEEDS.length - 1, currentIndex + direction));
    setPlaybackSpeed(PLAYBACK_SPEEDS[newIndex]);
  }, [playbackSpeed]);

  const handleSetInPoint = useCallback(() => {
    setInPoint(currentTime);
    onInPointSet?.(currentTime);
  }, [currentTime, onInPointSet]);

  const handleSetOutPoint = useCallback(() => {
    setOutPoint(currentTime);
    onOutPointSet?.(currentTime);
  }, [currentTime, onOutPointSet]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  // Apply playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Apply volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const inPointPercent = inPoint !== null && duration > 0 ? (inPoint / duration) * 100 : null;
  const outPointPercent = outPoint !== null && duration > 0 ? (outPoint / duration) * 100 : null;

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
              onEnded={() => setIsPlaying(false)}
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

        {/* Timeline / Progress */}
        <div className="video-timeline-section">
          {/* Progress bar */}
          <div
            className="video-progress-bar"
            ref={progressRef}
            onClick={handleProgressClick}
          >
            {/* IN/OUT point markers (future feature) */}
            {inPointPercent !== null && (
              <div
                className="timeline-marker in-marker"
                style={{ left: `${inPointPercent}%` }}
                title={`IN: ${formatTime(inPoint!)}`}
              />
            )}
            {outPointPercent !== null && (
              <div
                className="timeline-marker out-marker"
                style={{ left: `${outPointPercent}%` }}
                title={`OUT: ${formatTime(outPoint!)}`}
              />
            )}

            {/* Selected region (future feature) */}
            {inPointPercent !== null && outPointPercent !== null && (
              <div
                className="timeline-selection"
                style={{
                  left: `${Math.min(inPointPercent, outPointPercent)}%`,
                  width: `${Math.abs(outPointPercent - inPointPercent)}%`
                }}
              />
            )}

            {/* Progress fill */}
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />

            {/* Playhead */}
            <div
              className="progress-playhead"
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          {/* Time display */}
          <div className="video-time-display">
            <span className="current-time">{formatTime(currentTime)}</span>
            <span className="time-separator">/</span>
            <span className="total-time">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
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

            {/* Volume */}
            <button
              className="control-btn"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              className="volume-slider"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              title="Volume (↑/↓)"
            />
          </div>

          <div className="controls-center">
            {/* Future: IN/OUT point buttons */}
            <button
              className={`control-btn edit-btn ${inPoint !== null ? 'active' : ''}`}
              onClick={handleSetInPoint}
              title="Set IN point (I)"
            >
              IN
            </button>
            <button
              className={`control-btn edit-btn ${outPoint !== null ? 'active' : ''}`}
              onClick={handleSetOutPoint}
              title="Set OUT point (O)"
            >
              OUT
            </button>
            {inPoint !== null && outPoint !== null && (
              <span className="clip-duration">
                Clip: {formatTime(Math.abs(outPoint - inPoint))}
              </span>
            )}
          </div>

          <div className="controls-right">
            {/* Playback speed */}
            <button
              className="control-btn speed-btn"
              onClick={() => cycleSpeed(1)}
              title="Playback speed ([/])"
            >
              {playbackSpeed}x
            </button>
          </div>
        </div>

        {/* Future: Extended timeline editor section */}
        {/* <div className="video-editor-section">
          <VideoTimeline
            duration={duration}
            currentTime={currentTime}
            inPoint={inPoint}
            outPoint={outPoint}
            onSeek={(time) => { videoRef.current.currentTime = time; }}
            onInPointChange={setInPoint}
            onOutPointChange={setOutPoint}
          />
        </div> */}
      </div>
    </div>
  );
}
