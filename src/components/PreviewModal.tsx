import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { X, Play, Pause, SkipBack, SkipForward, Maximize2, Minimize2, Repeat, Download } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { Cut } from '../types';
import { generateVideoThumbnail, createVideoObjectUrl } from '../utils/videoUtils';
import './PreviewModal.css';

interface ResolutionPresetType {
  name: string;
  width: number;
  height: number;
}

interface PreviewModalProps {
  onClose: () => void;
  exportResolution?: ResolutionPresetType;
  onResolutionChange?: (resolution: ResolutionPresetType) => void;
}

interface PreviewItem {
  cut: Cut;
  sceneName: string;
  sceneIndex: number;
  cutIndex: number;
  thumbnail: string | null;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.5, 2];

// Resolution presets for simulation
interface ResolutionPreset {
  name: string;
  width: number;
  height: number;
}

const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { name: 'Free', width: 0, height: 0 },
  { name: 'FHD', width: 1920, height: 1080 },
  { name: 'HD', width: 1280, height: 720 },
  { name: '4K', width: 3840, height: 2160 },
  { name: 'SD', width: 640, height: 480 },
];

export default function PreviewModal({ onClose, exportResolution, onResolutionChange }: PreviewModalProps) {
  const { scenes, previewMode, selectedSceneId, getAsset } = useStore();
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<string | null>(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<ResolutionPreset>(
    exportResolution ? { ...exportResolution } : RESOLUTION_PRESETS[0]
  );
  const [isExporting, setIsExporting] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const displayContainerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  // Build preview items
  useEffect(() => {
    const buildItems = async () => {
      const newItems: PreviewItem[] = [];

      const scenesToPreview = previewMode === 'scene' && selectedSceneId
        ? scenes.filter(s => s.id === selectedSceneId)
        : scenes;

      for (let sIdx = 0; sIdx < scenesToPreview.length; sIdx++) {
        const scene = scenesToPreview[sIdx];
        for (let cIdx = 0; cIdx < scene.cuts.length; cIdx++) {
          const cut = scene.cuts[cIdx];
          const asset = cut.asset || getAsset(cut.assetId);

          let thumbnail: string | null = asset?.thumbnail || null;

          if (!thumbnail && asset?.path && window.electronAPI) {
            try {
              if (asset.type === 'video') {
                // Generate thumbnail for video
                thumbnail = await generateVideoThumbnail(asset.path);
              } else {
                // Load image as base64
                thumbnail = await window.electronAPI.readFileAsBase64(asset.path);
              }
            } catch {
              // Failed to load
            }
          }

          newItems.push({
            cut,
            sceneName: scene.name,
            sceneIndex: sIdx,
            cutIndex: cIdx,
            thumbnail,
          });
        }
      }

      setItems(newItems);
    };

    buildItems();
  }, [scenes, previewMode, selectedSceneId, getAsset]);

  // Create Object URL for video when current item changes
  useEffect(() => {
    const currentItem = items[currentIndex];

    // Clean up previous Object URL
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
      setVideoObjectUrl(null);
    }

    // Create new Object URL if current item is a video
    if (currentItem?.cut.asset?.type === 'video' && currentItem.cut.asset.path) {
      createVideoObjectUrl(currentItem.cut.asset.path).then(url => {
        setVideoObjectUrl(url);
      });
    }

    // Cleanup on unmount or when item changes
    return () => {
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl);
      }
    };
  }, [currentIndex, items]);

  // Calculate display size for resolution simulation
  // Use useLayoutEffect to get size after DOM updates but before paint
  useLayoutEffect(() => {
    const updateDisplaySize = () => {
      if (!displayContainerRef.current) return;

      const container = displayContainerRef.current;
      const rect = container.getBoundingClientRect();
      setDisplaySize({ width: rect.width, height: rect.height });
    };

    updateDisplaySize();
    window.addEventListener('resize', updateDisplaySize);
    return () => window.removeEventListener('resize', updateDisplaySize);
  }, [selectedResolution]); // Re-calculate when resolution changes

  // Calculate viewport frame for resolution simulation
  const getViewportStyle = useCallback(() => {
    // Free mode - no masking
    if (selectedResolution.width === 0) {
      return null;
    }

    const targetWidth = selectedResolution.width;
    const targetHeight = selectedResolution.height;

    // Use actual container size, or fallback to reasonable defaults
    const containerWidth = displaySize.width > 0 ? displaySize.width : 800;
    const containerHeight = displaySize.height > 0 ? displaySize.height : 600;

    // Calculate scale to fit the resolution frame within the container
    const scaleX = containerWidth / targetWidth;
    const scaleY = containerHeight / targetHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to leave some margin

    return {
      width: targetWidth * scale,
      height: targetHeight * scale,
      scale,
    };
  }, [selectedResolution, displaySize]);

  // Playback logic
  const goToNext = useCallback(() => {
    if (currentIndex >= items.length - 1) {
      if (isLooping) {
        // Loop: go back to the beginning and continue playing
        setCurrentIndex(0);
        setProgress(0);
      } else {
        // No loop: stop at the end (don't change index, let play button restart)
        setIsPlaying(false);
      }
      return;
    }
    setCurrentIndex(prev => prev + 1);
    setProgress(0);
  }, [currentIndex, items.length, isLooping]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
    setProgress(0);
  }, []);

  // Handle play/pause with restart from beginning when at end
  const handlePlayPause = useCallback(() => {
    if (!isPlaying && currentIndex >= items.length - 1 && progress >= 99) {
      // At the end, restart from beginning
      setCurrentIndex(0);
      setProgress(0);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, currentIndex, items.length, progress]);

  // Video clip handlers
  const handleVideoLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    const currentItem = items[currentIndex];
    if (!video || !currentItem) return;

    const cut = currentItem.cut;
    // If this is a clip with inPoint, seek to it
    if (cut.isClip && cut.inPoint !== undefined) {
      video.currentTime = cut.inPoint;
    }
  }, [items, currentIndex]);

  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    const currentItem = items[currentIndex];
    if (!video || !currentItem) return;

    const cut = currentItem.cut;
    // If this is a clip with outPoint, check if we've reached it
    if (cut.isClip && cut.outPoint !== undefined) {
      if (video.currentTime >= cut.outPoint) {
        video.pause();
        goToNext();
      }
    }
  }, [items, currentIndex, goToNext]);

  const handleVideoEnded = useCallback(() => {
    goToNext();
  }, [goToNext]);

  useEffect(() => {
    if (!isPlaying || items.length === 0 || isDragging) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const currentItem = items[currentIndex];
    if (!currentItem) return;

    const duration = (currentItem.cut.displayTime * 1000) / playbackSpeed;
    const remainingDuration = duration * (1 - progress / 100);
    startTimeRef.current = Date.now();
    elapsedRef.current = (progress / 100) * duration;

    // Update progress
    const progressInterval = setInterval(() => {
      const elapsed = elapsedRef.current + (Date.now() - startTimeRef.current);
      setProgress(Math.min(100, (elapsed / duration) * 100));
    }, 50);

    // Advance to next
    timerRef.current = setTimeout(() => {
      clearInterval(progressInterval);
      goToNext();
    }, remainingDuration);

    return () => {
      clearInterval(progressInterval);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, currentIndex, items, goToNext, playbackSpeed, isDragging]);

  // Cycle playback speed
  const cycleSpeed = useCallback((direction: 'up' | 'down') => {
    setPlaybackSpeed(current => {
      const currentIdx = PLAYBACK_SPEEDS.indexOf(current);
      if (direction === 'up') {
        return PLAYBACK_SPEEDS[Math.min(currentIdx + 1, PLAYBACK_SPEEDS.length - 1)];
      } else {
        return PLAYBACK_SPEEDS[Math.max(currentIdx - 1, 0)];
      }
    });
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'ArrowUp':
        case '.':
          e.preventDefault();
          goToNext();
          break;
        case 'ArrowDown':
        case ',':
          e.preventDefault();
          goToPrev();
          break;
        case '[':
          e.preventDefault();
          cycleSpeed('down');
          break;
        case ']':
          e.preventDefault();
          cycleSpeed('up');
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'l':
          setIsLooping(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToNext, goToPrev, cycleSpeed, handlePlayPause]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && modalRef.current) {
      modalRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Export sequence to MP4
  const handleExport = useCallback(async () => {
    if (!window.electronAPI || items.length === 0) return;

    setIsExporting(true);
    setIsPlaying(false);

    try {
      // Determine export resolution
      const exportWidth = selectedResolution.width > 0 ? selectedResolution.width : 1920;
      const exportHeight = selectedResolution.height > 0 ? selectedResolution.height : 1080;

      // Show save dialog
      const outputPath = await window.electronAPI.showSaveSequenceDialog('sequence_export.mp4');
      if (!outputPath) {
        setIsExporting(false);
        return;
      }

      // Build sequence items for export
      const sequenceItems = items.map(item => {
        const asset = item.cut.asset;
        return {
          type: asset?.type || 'image' as const,
          path: asset?.path || '',
          duration: item.cut.displayTime,
          inPoint: item.cut.isClip ? item.cut.inPoint : undefined,
          outPoint: item.cut.isClip ? item.cut.outPoint : undefined,
        };
      }).filter(item => item.path);

      // Export using ffmpeg
      const result = await window.electronAPI.exportSequence({
        items: sequenceItems,
        outputPath,
        width: exportWidth,
        height: exportHeight,
        fps: 30,
      });

      if (result.success) {
        alert(`Export complete!\nFile: ${result.outputPath}\nSize: ${(result.fileSize! / 1024 / 1024).toFixed(2)} MB`);
      } else {
        alert(`Export failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Export error: ${String(error)}`);
    } finally {
      setIsExporting(false);
    }
  }, [items, selectedResolution]);

  // Calculate global position from progress percentage
  const calculateGlobalPositionFromProgress = useCallback((progressPercent: number) => {
    const totalDuration = items.reduce((acc, item) => acc + item.cut.displayTime, 0);
    const targetTime = (progressPercent / 100) * totalDuration;

    let accumulatedTime = 0;
    for (let i = 0; i < items.length; i++) {
      const itemDuration = items[i].cut.displayTime;
      if (accumulatedTime + itemDuration > targetTime) {
        const localProgress = ((targetTime - accumulatedTime) / itemDuration) * 100;
        return { index: i, localProgress };
      }
      accumulatedTime += itemDuration;
    }

    return { index: items.length - 1, localProgress: 100 };
  }, [items]);

  // Calculate global progress percentage
  const calculateGlobalProgress = useCallback(() => {
    if (items.length === 0) return 0;
    const totalDuration = items.reduce((acc, item) => acc + item.cut.displayTime, 0);
    let elapsedDuration = 0;
    for (let i = 0; i < currentIndex; i++) {
      elapsedDuration += items[i].cut.displayTime;
    }
    elapsedDuration += (progress / 100) * items[currentIndex].cut.displayTime;
    return (elapsedDuration / totalDuration) * 100;
  }, [items, currentIndex, progress]);

  // Progress bar click handler
  const handleProgressBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || items.length === 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressPercent = (clickX / rect.width) * 100;

    const { index, localProgress } = calculateGlobalPositionFromProgress(progressPercent);
    setCurrentIndex(index);
    setProgress(localProgress);
    elapsedRef.current = (localProgress / 100) * items[index].cut.displayTime * 1000;
  }, [items, calculateGlobalPositionFromProgress]);

  // Mouse drag handlers for scrubbing
  const handleProgressBarMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setIsPlaying(false);
    handleProgressBarClick(e);
  }, [handleProgressBarClick]);

  const handleProgressBarMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !progressBarRef.current || items.length === 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const progressPercent = (clickX / rect.width) * 100;

    const { index, localProgress } = calculateGlobalPositionFromProgress(progressPercent);
    setCurrentIndex(index);
    setProgress(localProgress);
    elapsedRef.current = (localProgress / 100) * items[index].cut.displayTime * 1000;
  }, [isDragging, items, calculateGlobalPositionFromProgress]);

  const handleProgressBarMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress bar hover handler
  const handleProgressBarHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || items.length === 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const progressPercent = (hoverX / rect.width) * 100;

    const totalDuration = items.reduce((acc, item) => acc + item.cut.displayTime, 0);
    const hoverTimeSeconds = (progressPercent / 100) * totalDuration;
    setHoverTime(formatTime(hoverTimeSeconds));
  }, [items]);

  const handleProgressBarLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  // Global mouse event handlers for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleProgressBarMouseMove);
      window.addEventListener('mouseup', handleProgressBarMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleProgressBarMouseMove);
        window.removeEventListener('mouseup', handleProgressBarMouseUp);
      };
    }
  }, [isDragging, handleProgressBarMouseMove, handleProgressBarMouseUp]);

  const currentItem = items[currentIndex];
  const globalProgress = calculateGlobalProgress();
  const totalDuration = items.reduce((acc, item) => acc + item.cut.displayTime, 0);
  const currentTime = (globalProgress / 100) * totalDuration;

  if (items.length === 0) {
    return (
      <div className="preview-modal" ref={modalRef}>
        <div className="preview-backdrop" onClick={onClose} />
        <div className="preview-container">
          <div className="preview-header">
            <span>Preview</span>
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <div className="preview-empty">
            <p>No cuts to preview</p>
            <p className="hint">Add some images or videos to your timeline first.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-modal" ref={modalRef}>
      <div className="preview-backdrop" onClick={onClose} />
      <div className="preview-container">
        <div className="preview-header">
          <div className="preview-info">
            <span className="scene-label">{currentItem?.sceneName}</span>
            <span className="cut-label">Cut {(currentItem?.cutIndex || 0) + 1}</span>
          </div>
          <div className="preview-actions">
            <select
              className="resolution-select"
              value={selectedResolution.name}
              onChange={(e) => {
                const preset = RESOLUTION_PRESETS.find(p => p.name === e.target.value);
                if (preset) {
                  setSelectedResolution(preset);
                  onResolutionChange?.(preset);
                }
              }}
              title="Resolution Simulation"
            >
              {RESOLUTION_PRESETS.map(preset => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}{preset.width > 0 ? ` (${preset.width}×${preset.height})` : ''}
                </option>
              ))}
            </select>
            <button
              className={`action-btn ${isLooping ? 'active' : ''}`}
              onClick={() => setIsLooping(!isLooping)}
              title={`Loop (L) - ${isLooping ? 'On' : 'Off'}`}
            >
              <Repeat size={18} />
            </button>
            <button
              className="action-btn"
              onClick={handleExport}
              disabled={isExporting || items.length === 0}
              title="Export to MP4"
            >
              <Download size={18} />
            </button>
            <button className="action-btn" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="preview-display" ref={displayContainerRef}>
          {(() => {
            const viewportStyle = getViewportStyle();
            const content = currentItem?.cut.asset?.type === 'video' && currentItem.cut.asset.path ? (
              videoObjectUrl ? (
                <video
                  ref={videoRef}
                  key={videoObjectUrl}
                  src={videoObjectUrl}
                  className="preview-media"
                  autoPlay
                  muted
                  loop={false}
                  onLoadedMetadata={handleVideoLoadedMetadata}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onEnded={handleVideoEnded}
                />
              ) : (
                <div className="preview-placeholder">
                  <p>Loading video...</p>
                </div>
              )
            ) : currentItem?.thumbnail ? (
              <img
                src={currentItem.thumbnail}
                alt={`${currentItem.sceneName} - Cut ${currentItem.cutIndex + 1}`}
                className="preview-media"
              />
            ) : (
              <div className="preview-placeholder">
                <p>No preview available</p>
              </div>
            );

            if (viewportStyle) {
              return (
                <div
                  className="resolution-viewport"
                  style={{
                    width: viewportStyle.width,
                    height: viewportStyle.height,
                  }}
                >
                  <div className="resolution-label">
                    {selectedResolution.name} ({selectedResolution.width}×{selectedResolution.height})
                  </div>
                  {content}
                </div>
              );
            }

            return content;
          })()}
        </div>

        <div className="preview-progress">
          <div
            className="progress-bar scrub-enabled"
            ref={progressBarRef}
            onMouseDown={handleProgressBarMouseDown}
            onMouseMove={handleProgressBarHover}
            onMouseLeave={handleProgressBarLeave}
          >
            <div className="progress-fill" style={{ width: `${globalProgress}%` }} />
            <div className="progress-handle" style={{ left: `${globalProgress}%` }} />
            {hoverTime && (
              <div className="progress-tooltip">
                {hoverTime}
              </div>
            )}
          </div>
          <div className="progress-info">
            <span className="time-display">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
            <span className="speed-display" onClick={() => cycleSpeed('up')} title="Click or press ] to increase, [ to decrease">
              {playbackSpeed}x
            </span>
          </div>
        </div>

        <div className="preview-controls">
          <div className="controls-left">
            <span className="index-info">
              {currentIndex + 1} / {items.length}
            </span>
          </div>
          <div className="controls-center">
            <button
              className="control-btn"
              onClick={goToPrev}
              disabled={currentIndex === 0}
              title="Previous (← , ↓)"
            >
              <SkipBack size={20} />
            </button>
            <button
              className="control-btn primary"
              onClick={handlePlayPause}
              title="Play/Pause (Space)"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button
              className="control-btn"
              onClick={goToNext}
              disabled={currentIndex >= items.length - 1}
              title="Next (→ . ↑)"
            >
              <SkipForward size={20} />
            </button>
          </div>
          <div className="controls-right">
            <span className="hint-text">Space: play · [ ]: speed · ←→: navigate</span>
          </div>
        </div>
      </div>
    </div>
  );
}
