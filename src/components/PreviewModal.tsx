import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Play, Pause, SkipBack, SkipForward, Maximize2, Minimize2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { Cut } from '../types';
import './PreviewModal.css';

interface PreviewModalProps {
  onClose: () => void;
}

interface PreviewItem {
  cut: Cut;
  sceneName: string;
  sceneIndex: number;
  cutIndex: number;
  thumbnail: string | null;
}

export default function PreviewModal({ onClose }: PreviewModalProps) {
  const { scenes, previewMode, selectedSceneId, getAsset } = useStore();
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const modalRef = useRef<HTMLDivElement>(null);

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
              thumbnail = await window.electronAPI.readFileAsBase64(asset.path);
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

  // Playback logic
  const goToNext = useCallback(() => {
    setCurrentIndex(prev => {
      if (prev >= items.length - 1) {
        setIsPlaying(false);
        return prev;
      }
      return prev + 1;
    });
    setProgress(0);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
    setProgress(0);
  }, []);

  useEffect(() => {
    if (!isPlaying || items.length === 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const currentItem = items[currentIndex];
    if (!currentItem) return;

    const duration = currentItem.cut.displayTime * 1000;
    startTimeRef.current = Date.now();

    // Update progress
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setProgress(Math.min(100, (elapsed / duration) * 100));
    }, 50);

    // Advance to next
    timerRef.current = setTimeout(() => {
      clearInterval(progressInterval);
      goToNext();
    }, duration);

    return () => {
      clearInterval(progressInterval);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, currentIndex, items, goToNext]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'f':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToNext, goToPrev]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && modalRef.current) {
      modalRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const currentItem = items[currentIndex];

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
            <button className="action-btn" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="preview-display">
          {currentItem?.thumbnail ? (
            <img
              src={currentItem.thumbnail}
              alt={`${currentItem.sceneName} - Cut ${currentItem.cutIndex + 1}`}
              className="preview-image"
            />
          ) : (
            <div className="preview-placeholder">
              <p>No preview available</p>
            </div>
          )}
        </div>

        <div className="preview-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-info">
            <span>{currentItem?.cut.displayTime.toFixed(1)}s</span>
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
            >
              <SkipBack size={20} />
            </button>
            <button
              className="control-btn primary"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button
              className="control-btn"
              onClick={goToNext}
              disabled={currentIndex >= items.length - 1}
            >
              <SkipForward size={20} />
            </button>
          </div>
          <div className="controls-right">
            <span className="hint-text">Press Space to play/pause</span>
          </div>
        </div>
      </div>
    </div>
  );
}
