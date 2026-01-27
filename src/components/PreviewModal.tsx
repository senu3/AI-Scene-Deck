import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { X, Play, Pause, SkipBack, SkipForward, Download, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { Asset, Cut } from '../types';
import { generateVideoThumbnail, createVideoObjectUrl } from '../utils/videoUtils';
import { formatTime, cyclePlaybackSpeed } from '../utils/timeUtils';
import { getGlobalAudioManager } from '../utils/audioUtils';
import {
  TimelineMarkers,
  ClipRangeControls,
  VolumeControl,
  TimeDisplay,
  LoopToggle,
  FullscreenToggle,
} from './shared';
import type { FocusedMarker } from './shared';
import './PreviewModal.css';
import './shared/timeline-common.css';

// 再生保証付き LazyLoad constants
const PLAY_SAFE_AHEAD = 2.0; // seconds - minimum buffer required for playback
const PRELOAD_AHEAD = 30.0; // seconds - preload this much ahead for smoother playback
const INITIAL_PRELOAD_ITEMS = 5; // number of items to preload initially

function revokeIfBlob(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

interface ResolutionPresetType {
  name: string;
  width: number;
  height: number;
}

// Single Mode props (for previewing a single asset)
interface SingleModeProps {
  asset: Asset;
  initialInPoint?: number;
  initialOutPoint?: number;
  onInPointSet?: (time: number) => void;
  onOutPointSet?: (time: number) => void;
  onClipSave?: (inPoint: number, outPoint: number) => void;
  onFrameCapture?: (timestamp: number) => void;
}

// Base props shared by both modes
interface BasePreviewModalProps {
  onClose: () => void;
  exportResolution?: ResolutionPresetType;
  onResolutionChange?: (resolution: ResolutionPresetType) => void;
}

// PreviewModal can be called in Single Mode (with asset) or Sequence Mode (without asset)
type PreviewModalProps = BasePreviewModalProps & Partial<SingleModeProps>;

interface PreviewItem {
  cut: Cut;
  sceneName: string;
  sceneIndex: number;
  cutIndex: number;
  thumbnail: string | null;
}

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

export default function PreviewModal({
  onClose,
  exportResolution,
  onResolutionChange,
  // Single Mode props
  asset,
  initialInPoint,
  initialOutPoint,
  onInPointSet,
  onOutPointSet,
  onClipSave,
  onFrameCapture,
}: PreviewModalProps) {
  const {
    scenes,
    previewMode,
    selectedSceneId,
    getAsset,
    globalVolume,
    globalMuted,
    setGlobalVolume,
    toggleGlobalMute,
    metadataStore,
  } = useStore();

  // Mode detection: Single Mode if asset prop is provided
  const isSingleMode = !!asset;

  const [items, setItems] = useState<PreviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(!isSingleMode); // Single mode starts paused
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

  // Buffer management state (Sequence Mode)
  const [isBuffering, setIsBuffering] = useState(false);
  const videoUrlCacheRef = useRef<Map<number, string>>(new Map()); // index -> Object URL
  const readyItemsRef = useRef<Set<number>>(new Set()); // indices of ready items
  const preloadingRef = useRef<Set<number>>(new Set()); // indices currently being preloaded

  // Single Mode specific state
  const [isLoading, setIsLoading] = useState(isSingleMode);
  const [singleModeDuration, setSingleModeDuration] = useState(0);
  const [singleModeCurrentTime, setSingleModeCurrentTime] = useState(0);

  // IN/OUT point state - initialize from props for Single Mode
  const [inPoint, setInPoint] = useState<number | null>(initialInPoint ?? null);
  const [outPoint, setOutPoint] = useState<number | null>(initialOutPoint ?? null);

  // Focused marker state for draggable markers
  const [focusedMarker, setFocusedMarker] = useState<FocusedMarker>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const displayContainerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  // Ref to prevent repeated stops when reaching OUT point
  const stoppedAtOutPointRef = useRef(false);

  // Frame stepping constant (assuming 30fps)
  const FRAME_DURATION = 1 / 30;

  // ===== ATTACHED AUDIO HELPER =====

  // Get attached audio for an asset from metadata store
  const getAttachedAudioForAsset = useCallback((assetId: string): Asset | undefined => {
    if (!metadataStore) return undefined;
    const metadata = metadataStore.metadata[assetId];
    if (!metadata?.attachedAudioId) return undefined;
    return getAsset(metadata.attachedAudioId);
  }, [metadataStore, getAsset]);

  // Get audio offset for an asset
  const getAudioOffsetForAsset = useCallback((assetId: string): number => {
    if (!metadataStore) return 0;
    const metadata = metadataStore.metadata[assetId];
    return metadata?.attachedAudioOffset ?? 0;
  }, [metadataStore]);

  // ===== SINGLE MODE LOGIC =====

  // Detect if Single Mode asset is video or image
  const isSingleModeVideo = isSingleMode && asset?.type === 'video';
  const isSingleModeImage = isSingleMode && asset?.type === 'image';

  // State for image data in Single Mode
  const [singleModeImageData, setSingleModeImageData] = useState<string | null>(null);

  // Attached audio state (both modes)
  // Use global AudioManager singleton - never dispose on component unmount
  // TODO: 音声紐づけ後にプレビューを開くとクラッシュする問題あり（原因調査中）
  // ガイドライン（AudioGuideline.md）には沿っているが、他の要因の可能性
  const audioManagerRef = useRef(getGlobalAudioManager());
  const [audioLoaded, setAudioLoaded] = useState(false);

  // Unload audio on unmount (but do NOT dispose the AudioManager)
  useEffect(() => {
    return () => {
      // Only unload, never dispose - AudioManager is app-scoped singleton
      audioManagerRef.current.unload();
    };
  }, []);

  // Load video URL or image data for Single Mode
  useEffect(() => {
    if (!isSingleMode || !asset?.path) return;

    let isMounted = true;

    const loadAsset = async () => {
      setIsLoading(true);

      if (asset.type === 'video') {
        const url = await createVideoObjectUrl(asset.path);
        if (isMounted && url) {
          setVideoObjectUrl(url);
        }
      } else if (asset.type === 'image') {
        // Load image as base64
        if (asset.thumbnail) {
          setSingleModeImageData(asset.thumbnail);
        } else if (window.electronAPI) {
          try {
            const base64 = await window.electronAPI.readFileAsBase64(asset.path);
            if (isMounted && base64) {
              setSingleModeImageData(base64);
            }
          } catch {
            // Failed to load image
          }
        }
      }

      setIsLoading(false);
    };

    loadAsset();

    return () => {
      isMounted = false;
    };
  }, [isSingleMode, asset?.path, asset?.type, asset?.thumbnail]);

  // Cleanup Object URL on unmount (Single Mode)
  useEffect(() => {
    if (!isSingleMode) return;

    return () => {
      if (videoObjectUrl) {
        revokeIfBlob(videoObjectUrl);
      }
    };
  }, [isSingleMode, videoObjectUrl]);

  // Frame stepping (Single Mode)
  const stepFrame = useCallback((direction: number) => {
    if (!videoRef.current) return;

    // Pause video when stepping frames
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }

    const duration = isSingleMode ? singleModeDuration : videoRef.current.duration;
    const newTime = videoRef.current.currentTime + (direction * FRAME_DURATION);
    videoRef.current.currentTime = Math.max(0, Math.min(duration, newTime));

    if (isSingleMode) {
      setSingleModeCurrentTime(videoRef.current.currentTime);
    }
  }, [isSingleMode, singleModeDuration, isPlaying, FRAME_DURATION]);

  // Step focused marker by one frame
  const stepFocusedMarker = useCallback((direction: number) => {
    if (!focusedMarker) return;

    const duration = isSingleMode ? singleModeDuration : items.reduce((acc, item) => acc + item.cut.displayTime, 0);
    const stepAmount = direction * FRAME_DURATION;

    if (focusedMarker === 'in' && inPoint !== null) {
      // Constrain IN marker to not go past OUT point
      const maxTime = outPoint !== null ? outPoint : duration;
      const newTime = Math.max(0, Math.min(maxTime, inPoint + stepAmount));
      setInPoint(newTime);
      // Also move playback position
      if (isSingleMode && videoRef.current) {
        videoRef.current.currentTime = newTime;
        setSingleModeCurrentTime(newTime);
      }
    } else if (focusedMarker === 'out' && outPoint !== null) {
      // Constrain OUT marker to not go before IN point
      const minTime = inPoint !== null ? inPoint : 0;
      const newTime = Math.max(minTime, Math.min(duration, outPoint + stepAmount));
      setOutPoint(newTime);
      // Also move playback position
      if (isSingleMode && videoRef.current) {
        videoRef.current.currentTime = newTime;
        setSingleModeCurrentTime(newTime);
      }
    }
  }, [focusedMarker, inPoint, outPoint, isSingleMode, singleModeDuration, items, FRAME_DURATION]);

  // Handle marker focus
  const handleMarkerFocus = useCallback((marker: FocusedMarker) => {
    setFocusedMarker(marker);
  }, []);

  // Handle marker drag (both modes)
  const handleMarkerDrag = useCallback((marker: 'in' | 'out', newTime: number) => {
    const duration = isSingleMode ? singleModeDuration : items.reduce((acc, item) => acc + item.cut.displayTime, 0);
    let clampedTime = Math.max(0, Math.min(duration, newTime));

    // Constrain IN marker to not go past OUT point
    if (marker === 'in' && outPoint !== null) {
      clampedTime = Math.min(clampedTime, outPoint);
    }
    // Constrain OUT marker to not go before IN point
    if (marker === 'out' && inPoint !== null) {
      clampedTime = Math.max(clampedTime, inPoint);
    }

    if (marker === 'in') {
      setInPoint(clampedTime);
    } else {
      setOutPoint(clampedTime);
    }

    // Also update playback position
    if (isSingleMode && videoRef.current) {
      videoRef.current.currentTime = clampedTime;
      setSingleModeCurrentTime(clampedTime);
    } else if (!isSingleMode && items.length > 0) {
      // Sequence mode: calculate current index and progress from time
      let accumulatedTime = 0;
      for (let i = 0; i < items.length; i++) {
        const itemDuration = items[i].cut.displayTime;
        if (accumulatedTime + itemDuration > clampedTime) {
          const localProgress = ((clampedTime - accumulatedTime) / itemDuration) * 100;
          setCurrentIndex(i);
          setProgress(Math.max(0, Math.min(100, localProgress)));
          break;
        }
        accumulatedTime += itemDuration;
      }
    }
  }, [isSingleMode, singleModeDuration, items, inPoint, outPoint]);

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback(() => {
    // Focus will be cleared when clicking outside progress bar
  }, []);

  // Clear focused marker when clicking outside progress bar
  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (!focusedMarker) return;

    // Check if click was inside the progress bar
    const target = e.target as HTMLElement;
    const progressBar = target.closest('.progress-bar');

    // If clicked outside progress bar, clear focus
    if (!progressBar) {
      setFocusedMarker(null);
    }
  }, [focusedMarker]);

  // Skip seconds (Both modes)
  const skip = useCallback((seconds: number) => {
    if (isSingleMode) {
      // Single Mode: direct video seeking
      if (!videoRef.current) return;
      const newTime = Math.max(0, Math.min(singleModeDuration, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = newTime;
      setSingleModeCurrentTime(newTime);
    } else {
      // Sequence Mode: calculate position across all cuts
      const totalDuration = items.reduce((acc, item) => acc + item.cut.displayTime, 0);
      if (totalDuration === 0) return;

      // Calculate current absolute time
      let currentAbsoluteTime = 0;
      for (let i = 0; i < currentIndex; i++) {
        currentAbsoluteTime += items[i].cut.displayTime;
      }
      currentAbsoluteTime += (progress / 100) * items[currentIndex].cut.displayTime;

      // Calculate new absolute time
      const newAbsoluteTime = Math.max(0, Math.min(totalDuration, currentAbsoluteTime + seconds));

      // Find the new index and local progress
      let accumulated = 0;
      for (let i = 0; i < items.length; i++) {
        const itemDuration = items[i].cut.displayTime;
        if (accumulated + itemDuration > newAbsoluteTime) {
          const localTime = newAbsoluteTime - accumulated;
          const newProgress = (localTime / itemDuration) * 100;
          setCurrentIndex(i);
          setProgress(newProgress);
          elapsedRef.current = (newProgress / 100) * itemDuration * 1000;

          // If video, seek to correct position
          if (items[i].cut.asset?.type === 'video' && videoRef.current) {
            const cut = items[i].cut;
            const videoStartTime = cut.isClip && cut.inPoint !== undefined ? cut.inPoint : 0;
            videoRef.current.currentTime = videoStartTime + localTime;
          }
          return;
        }
        accumulated += itemDuration;
      }

      // If we reach here, go to the end
      setCurrentIndex(items.length - 1);
      setProgress(100);
    }
  }, [isSingleMode, singleModeDuration, items, currentIndex, progress]);

  // Single Mode video event handlers
  const handleSingleModeTimeUpdate = useCallback(() => {
    if (!videoRef.current || !isSingleMode) return;

    setSingleModeCurrentTime(videoRef.current.currentTime);

    // If both IN and OUT points are set, constrain playback
    if (inPoint !== null && outPoint !== null) {
      const clipStart = Math.min(inPoint, outPoint);
      const clipEnd = Math.max(inPoint, outPoint);
      if (videoRef.current.currentTime >= clipEnd) {
        if (isLooping) {
          videoRef.current.currentTime = clipStart;
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
          videoRef.current.currentTime = clipStart;
        }
      }
    }
  }, [isSingleMode, inPoint, outPoint, isLooping]);

  const handleSingleModeLoadedMetadata = useCallback(() => {
    if (!videoRef.current || !isSingleMode) return;

    setSingleModeDuration(videoRef.current.duration);

    if (initialInPoint !== undefined) {
      videoRef.current.currentTime = initialInPoint;
      setSingleModeCurrentTime(initialInPoint);
    }
  }, [isSingleMode, initialInPoint]);

  const handleSingleModeVideoEnded = useCallback(() => {
    if (!isSingleMode) return;

    if (isLooping && videoRef.current) {
      // If IN/OUT are set, loop from IN point
      const loopStart = inPoint !== null ? Math.min(inPoint, outPoint ?? inPoint) : 0;
      videoRef.current.currentTime = loopStart;
      videoRef.current.play();
    } else {
      setIsPlaying(false);
    }
  }, [isSingleMode, isLooping, inPoint, outPoint]);

  // Single Mode progress bar click
  const handleSingleModeProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current || !isSingleMode) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    let newTime = Math.max(0, Math.min(singleModeDuration, percent * singleModeDuration));

    // If a marker is focused, move that marker with constraints
    if (focusedMarker === 'in') {
      // Constrain IN marker to not go past OUT point
      if (outPoint !== null) {
        newTime = Math.min(newTime, outPoint);
      }
      setInPoint(newTime);
    } else if (focusedMarker === 'out') {
      // Constrain OUT marker to not go before IN point
      if (inPoint !== null) {
        newTime = Math.max(newTime, inPoint);
      }
      setOutPoint(newTime);
    }

    // Always update playback position
    videoRef.current.currentTime = newTime;
    setSingleModeCurrentTime(newTime);
  }, [isSingleMode, singleModeDuration, focusedMarker, inPoint, outPoint]);

  // Single Mode IN/OUT handlers
  const handleSingleModeSetInPoint = useCallback(() => {
    if (!isSingleMode) return;
    setInPoint(singleModeCurrentTime);
    onInPointSet?.(singleModeCurrentTime);
  }, [isSingleMode, singleModeCurrentTime, onInPointSet]);

  const handleSingleModeSetOutPoint = useCallback(() => {
    if (!isSingleMode) return;
    setOutPoint(singleModeCurrentTime);
    onOutPointSet?.(singleModeCurrentTime);
  }, [isSingleMode, singleModeCurrentTime, onOutPointSet]);

  // Single Mode Save handler: if both IN and OUT are set, save clip; if only IN is set, capture frame
  const handleSingleModeSave = useCallback(() => {
    if (!isSingleMode) return;

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
  }, [isSingleMode, inPoint, outPoint, onClipSave, onFrameCapture, onClose]);

  // Single Mode play/pause
  const toggleSingleModePlay = useCallback(() => {
    if (!videoRef.current || !isSingleMode) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isSingleMode, isPlaying]);

  // Apply playback speed (Single Mode)
  useEffect(() => {
    if (isSingleMode && videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [isSingleMode, playbackSpeed]);

  // Apply global volume (Single Mode)
  useEffect(() => {
    if (isSingleMode && videoRef.current) {
      videoRef.current.volume = globalVolume;
      videoRef.current.muted = globalMuted;
    }
  }, [isSingleMode, globalVolume, globalMuted]);

  // ===== SINGLE MODE ATTACHED AUDIO =====

  // Load attached audio for Single Mode (only when asset changes)
  useEffect(() => {
    if (!isSingleMode || !asset?.id) {
      // Unload audio if not in single mode or no asset
      if (audioManagerRef.current) {
        audioManagerRef.current.unload();
      }
      setAudioLoaded(false);
      return;
    }

    const attachedAudio = getAttachedAudioForAsset(asset.id);

    // Unload previous audio (reuse same AudioManager)
    if (audioManagerRef.current) {
      audioManagerRef.current.unload();
    }
    setAudioLoaded(false);

    if (!attachedAudio?.path || !audioManagerRef.current) return;

    let cancelled = false;
    const manager = audioManagerRef.current;

    // Check if manager is disposed before starting
    if (manager.isDisposed()) return;

    const loadAudio = async () => {
      // Set offset
      const offset = getAudioOffsetForAsset(asset.id);
      manager.setOffset(offset);

      // Check again before async operation
      if (cancelled || manager.isDisposed()) return;

      const loaded = await manager.load(attachedAudio.path);
      if (cancelled) return;

      if (loaded) {
        setAudioLoaded(true);
      }
    };

    loadAudio();

    return () => {
      cancelled = true;
    };
  }, [isSingleMode, asset?.id, getAttachedAudioForAsset, getAudioOffsetForAsset]);

  // Sync Single Mode audio with video playback (only on play/pause change)
  useEffect(() => {
    if (!isSingleMode || !audioManagerRef.current || !audioLoaded) return;

    if (isPlaying) {
      // Get current video time for sync
      const currentTime = videoRef.current?.currentTime ?? 0;
      audioManagerRef.current.play(currentTime);
    } else {
      audioManagerRef.current.pause();
    }
  }, [isSingleMode, isPlaying, audioLoaded]);

  // Apply volume to attached audio
  useEffect(() => {
    if (!audioManagerRef.current) return;
    audioManagerRef.current.setVolume(globalMuted ? 0 : globalVolume);
  }, [globalVolume, globalMuted]);

  // ===== SEQUENCE MODE LOGIC =====

  // Helper: Get items that fall within a time window from given index
  const getItemsInTimeWindow = useCallback((startIndex: number, windowSeconds: number): number[] => {
    const indices: number[] = [];
    let accumulatedTime = 0;

    for (let i = startIndex; i < items.length && accumulatedTime < windowSeconds; i++) {
      indices.push(i);
      accumulatedTime += items[i].cut.displayTime;
    }

    return indices;
  }, [items]);

  // Helper: Check if an item is ready for playback
  const isItemReady = useCallback((index: number): boolean => {
    const item = items[index];
    if (!item) return false;

    if (item.cut.asset?.type === 'video') {
      return videoUrlCacheRef.current.has(index);
    } else {
      // Images are ready if thumbnail is available
      return !!item.thumbnail;
    }
  }, [items]);

  // Helper: Preload items (video URLs or image data)
  const preloadItems = useCallback(async (indices: number[]): Promise<void> => {
    const preloadPromises: Promise<void>[] = [];

    for (const index of indices) {
      // Skip if already ready or currently being preloaded
      if (readyItemsRef.current.has(index) || preloadingRef.current.has(index)) continue;

      const item = items[index];
      if (!item) continue;

      if (item.cut.asset?.type === 'video' && item.cut.asset.path) {
        if (!videoUrlCacheRef.current.has(index)) {
          preloadingRef.current.add(index);
          preloadPromises.push(
            createVideoObjectUrl(item.cut.asset.path).then(url => {
              if (url) {
                videoUrlCacheRef.current.set(index, url);
                readyItemsRef.current.add(index);
              }
              preloadingRef.current.delete(index);
            })
          );
        } else {
          readyItemsRef.current.add(index);
        }
      } else {
        // Images - consider ready immediately (thumbnail already loaded in buildItems)
        readyItemsRef.current.add(index);
      }
    }

    await Promise.all(preloadPromises);
  }, [items]);

  // Helper: Check if buffer is sufficient for playback
  const checkBufferStatus = useCallback((): { ready: boolean; neededItems: number[] } => {
    if (items.length === 0) return { ready: true, neededItems: [] };

    const neededItems = getItemsInTimeWindow(currentIndex, PLAY_SAFE_AHEAD);
    const allReady = neededItems.every(idx => isItemReady(idx));

    return { ready: allReady, neededItems };
  }, [items, currentIndex, getItemsInTimeWindow, isItemReady]);

  // Helper: Cleanup old video URLs to prevent memory leaks
  const cleanupOldUrls = useCallback((keepFromIndex: number) => {
    const keepBackWindow = 5; // Keep 5 items back for rewind
    const keepStart = Math.max(0, keepFromIndex - keepBackWindow);

    for (const [index, url] of videoUrlCacheRef.current) {
      if (index < keepStart) {
        revokeIfBlob(url);
        videoUrlCacheRef.current.delete(index);
        readyItemsRef.current.delete(index);
      }
    }
  }, []);

  // Build preview items (Sequence Mode only)
  useEffect(() => {
    if (isSingleMode) return;

    const buildItems = async () => {
      const newItems: PreviewItem[] = [];

      const scenesToPreview = previewMode === 'scene' && selectedSceneId
        ? scenes.filter(s => s.id === selectedSceneId)
        : scenes;

      for (let sIdx = 0; sIdx < scenesToPreview.length; sIdx++) {
        const scene = scenesToPreview[sIdx];
        for (let cIdx = 0; cIdx < scene.cuts.length; cIdx++) {
          const cut = scene.cuts[cIdx];
          const cutAsset = cut.asset || getAsset(cut.assetId);

          let thumbnail: string | null = cutAsset?.thumbnail || null;

          if (!thumbnail && cutAsset?.path && window.electronAPI) {
            try {
              if (cutAsset.type === 'video') {
                thumbnail = await generateVideoThumbnail(cutAsset.path);
              } else {
                thumbnail = await window.electronAPI.readFileAsBase64(cutAsset.path);
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
  }, [isSingleMode, scenes, previewMode, selectedSceneId, getAsset]);

  // Reset cache when items change (Sequence Mode only)
  useEffect(() => {
    if (isSingleMode) return;

    // Clear all cached URLs when items rebuild
    for (const url of videoUrlCacheRef.current.values()) {
      revokeIfBlob(url);
    }
    videoUrlCacheRef.current.clear();
    readyItemsRef.current.clear();
    preloadingRef.current.clear();
  }, [isSingleMode, items.length]);

  // Initial preload when items are loaded (Sequence Mode only)
  useEffect(() => {
    if (isSingleMode || items.length === 0) return;

    const initialPreload = async () => {
      // Preload first N items immediately for instant playback start
      const initialItems: number[] = [];
      for (let i = 0; i < Math.min(INITIAL_PRELOAD_ITEMS, items.length); i++) {
        initialItems.push(i);
      }
      await preloadItems(initialItems);

      // Also preload items within PRELOAD_AHEAD time window
      const timeWindowItems = getItemsInTimeWindow(0, PRELOAD_AHEAD);
      await preloadItems(timeWindowItems);
    };

    initialPreload();
  }, [isSingleMode, items, preloadItems, getItemsInTimeWindow]);

  // Preload and buffer management (Sequence Mode only)
  useEffect(() => {
    if (isSingleMode || items.length === 0) return;

    const manageBuffer = async () => {
      // Preload items well ahead for smoother playback
      const itemsToPreload = getItemsInTimeWindow(currentIndex, PRELOAD_AHEAD);
      // Start preloading in background (don't await)
      preloadItems(itemsToPreload);

      // Update videoObjectUrl from cache
      const cachedUrl = videoUrlCacheRef.current.get(currentIndex);
      const currentItem = items[currentIndex];

      if (currentItem?.cut.asset?.type === 'video') {
        if (cachedUrl && cachedUrl !== videoObjectUrl) {
          setVideoObjectUrl(cachedUrl);
        } else if (!cachedUrl) {
          // Fallback: create URL if not in cache (shouldn't happen normally)
          const url = await createVideoObjectUrl(currentItem.cut.asset.path!);
          if (url) {
            videoUrlCacheRef.current.set(currentIndex, url);
            readyItemsRef.current.add(currentIndex);
            setVideoObjectUrl(url);
          }
        }
      } else {
        // Not a video - clear video URL
        setVideoObjectUrl(null);
      }

      // Check buffer status and update buffering state
      const { ready } = checkBufferStatus();
      if (isPlaying && !ready) {
        setIsBuffering(true);
      } else if (ready) {
        setIsBuffering(false);
      }

      // Cleanup old URLs (keep more items for rewinding)
      cleanupOldUrls(currentIndex);
    };

    manageBuffer();
  }, [isSingleMode, items, currentIndex, isPlaying, videoObjectUrl, getItemsInTimeWindow, preloadItems, checkBufferStatus, cleanupOldUrls]);

  // Cleanup all URLs on unmount (Sequence Mode)
  useEffect(() => {
    if (isSingleMode) return;

    return () => {
      for (const url of videoUrlCacheRef.current.values()) {
        revokeIfBlob(url);
      }
      videoUrlCacheRef.current.clear();
    };
  }, [isSingleMode]);

  // ===== SEQUENCE MODE ATTACHED AUDIO =====

  // Load attached audio when cut changes (Sequence Mode)
  useEffect(() => {
    if (isSingleMode || items.length === 0) {
      // Unload audio if in single mode or no items
      if (audioManagerRef.current) {
        audioManagerRef.current.unload();
      }
      setAudioLoaded(false);
      return;
    }

    const currentItem = items[currentIndex];
    const assetId = currentItem?.cut?.asset?.id;
    if (!assetId) {
      // No asset - unload audio (reuse AudioManager)
      if (audioManagerRef.current) {
        audioManagerRef.current.unload();
      }
      setAudioLoaded(false);
      return;
    }

    const attachedAudio = getAttachedAudioForAsset(assetId);

    // Unload previous audio (reuse same AudioManager)
    if (audioManagerRef.current) {
      audioManagerRef.current.unload();
    }
    setAudioLoaded(false);

    if (!attachedAudio?.path || !audioManagerRef.current) return;

    let cancelled = false;
    const manager = audioManagerRef.current;

    // Check if manager is disposed before starting
    if (manager.isDisposed()) return;

    const loadAudio = async () => {
      // Set offset
      const offset = getAudioOffsetForAsset(assetId);
      manager.setOffset(offset);

      // Check again before async operation
      if (cancelled || manager.isDisposed()) return;

      const loaded = await manager.load(attachedAudio.path);
      if (cancelled) return;

      if (loaded) {
        setAudioLoaded(true);
      }
    };

    loadAudio();

    return () => {
      cancelled = true;
    };
  }, [isSingleMode, currentIndex, items, getAttachedAudioForAsset, getAudioOffsetForAsset]);

  // Sync Sequence Mode audio with playback state (separate effect)
  useEffect(() => {
    if (isSingleMode || !audioManagerRef.current || !audioLoaded) return;

    if (isPlaying && !isBuffering) {
      audioManagerRef.current.play();
    } else {
      audioManagerRef.current.pause();
    }
  }, [isSingleMode, isPlaying, isBuffering, audioLoaded]);

  // Calculate display size for resolution simulation
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
  }, [selectedResolution]);

  // Calculate viewport frame for resolution simulation
  const getViewportStyle = useCallback(() => {
    if (selectedResolution.width === 0) return null;

    const targetWidth = selectedResolution.width;
    const targetHeight = selectedResolution.height;
    const containerWidth = displaySize.width > 0 ? displaySize.width : 800;
    const containerHeight = displaySize.height > 0 ? displaySize.height : 600;

    const scaleX = containerWidth / targetWidth;
    const scaleY = containerHeight / targetHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    return {
      width: targetWidth * scale,
      height: targetHeight * scale,
      scale,
    };
  }, [selectedResolution, displaySize]);

  // Helper: Calculate absolute time from index and progress
  const calculateAbsoluteTime = useCallback((itemIndex: number, itemProgress: number) => {
    let absoluteTime = 0;
    for (let i = 0; i < itemIndex && i < items.length; i++) {
      absoluteTime += items[i].cut.displayTime;
    }
    if (itemIndex < items.length) {
      absoluteTime += (itemProgress / 100) * items[itemIndex].cut.displayTime;
    }
    return absoluteTime;
  }, [items]);

  // Helper: Find position (index + progress) from absolute time
  const findPositionFromTime = useCallback((targetTime: number) => {
    let accumulated = 0;
    for (let i = 0; i < items.length; i++) {
      const itemDuration = items[i].cut.displayTime;
      if (accumulated + itemDuration > targetTime) {
        const localProgress = ((targetTime - accumulated) / itemDuration) * 100;
        return { index: i, progress: Math.max(0, Math.min(100, localProgress)) };
      }
      accumulated += itemDuration;
    }
    return { index: items.length - 1, progress: 100 };
  }, [items]);

  // Playback logic
  const goToNext = useCallback(() => {
    // Calculate total duration
    const totalDuration = items.reduce((acc, item) => acc + item.cut.displayTime, 0);

    // Determine the effective OUT point
    const effectiveOutPoint = (inPoint !== null && outPoint !== null)
      ? Math.max(inPoint, outPoint)
      : totalDuration;

    // Determine the effective IN point
    const effectiveInPoint = (inPoint !== null && outPoint !== null)
      ? Math.min(inPoint, outPoint)
      : 0;

    if (currentIndex >= items.length - 1) {
      // At the last item
      if (isLooping) {
        // Loop back to IN point (or beginning if no IN/OUT set)
        stoppedAtOutPointRef.current = false;
        const loopPosition = findPositionFromTime(effectiveInPoint);
        setCurrentIndex(loopPosition.index);
        setProgress(loopPosition.progress);

        // If the target item is a video, seek to correct position
        if (items[loopPosition.index]?.cut.asset?.type === 'video' && videoRef.current) {
          const cut = items[loopPosition.index].cut;
          const videoStartTime = cut.isClip && cut.inPoint !== undefined ? cut.inPoint : 0;
          const localTime = (loopPosition.progress / 100) * cut.displayTime;
          videoRef.current.currentTime = videoStartTime + localTime;
        }
      } else {
        setIsPlaying(false);
      }
      return;
    }

    // Check if next item would exceed OUT point
    const nextItemStartTime = calculateAbsoluteTime(currentIndex + 1, 0);
    if (inPoint !== null && outPoint !== null && nextItemStartTime >= effectiveOutPoint) {
      // Would exceed OUT point
      if (isLooping) {
        stoppedAtOutPointRef.current = false;
        const loopPosition = findPositionFromTime(effectiveInPoint);
        setCurrentIndex(loopPosition.index);
        setProgress(loopPosition.progress);

        if (items[loopPosition.index]?.cut.asset?.type === 'video' && videoRef.current) {
          const cut = items[loopPosition.index].cut;
          const videoStartTime = cut.isClip && cut.inPoint !== undefined ? cut.inPoint : 0;
          const localTime = (loopPosition.progress / 100) * cut.displayTime;
          videoRef.current.currentTime = videoStartTime + localTime;
        }
      } else {
        setIsPlaying(false);
      }
      return;
    }

    stoppedAtOutPointRef.current = false;
    setCurrentIndex(prev => prev + 1);
    setProgress(0);
  }, [currentIndex, items, isLooping, inPoint, outPoint, calculateAbsoluteTime, findPositionFromTime]);

  const goToPrev = useCallback(() => {
    stoppedAtOutPointRef.current = false;
    setCurrentIndex(prev => Math.max(0, prev - 1));
    setProgress(0);
  }, []);

  // Handle play/pause with restart from beginning when at end
  // Also pause/play video element
  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;

    // When starting playback
    if (!isPlaying) {
      stoppedAtOutPointRef.current = false;

      // If IN/OUT range is set, check if we need to seek to IN point
      if (inPoint !== null && outPoint !== null) {
        const currentAbsTime = calculateAbsoluteTime(currentIndex, progress);
        const effectiveOutPoint = Math.max(inPoint, outPoint);
        const effectiveInPoint = Math.min(inPoint, outPoint);

        // If at or past OUT point, seek to IN point
        if (currentAbsTime >= effectiveOutPoint - 0.1) { // Small tolerance
          const loopPosition = findPositionFromTime(effectiveInPoint);
          setCurrentIndex(loopPosition.index);
          setProgress(loopPosition.progress);
          initialProgressRef.current = loopPosition.progress;

          // Seek video if needed
          if (items[loopPosition.index]?.cut.asset?.type === 'video' && video) {
            const cut = items[loopPosition.index].cut;
            const videoStartTime = cut.isClip && cut.inPoint !== undefined ? cut.inPoint : 0;
            const localTime = (loopPosition.progress / 100) * cut.displayTime;
            video.currentTime = videoStartTime + localTime;
          }
        }
      }

      // Restart from beginning if at end (without IN/OUT range)
      if (inPoint === null && outPoint === null && currentIndex >= items.length - 1 && progress >= 99) {
        setCurrentIndex(0);
        setProgress(0);
      }
    }

    // Control video playback
    if (video && items[currentIndex]?.cut.asset?.type === 'video') {
      if (isPlaying) {
        video.pause();
      } else {
        video.play().catch(() => {});
      }
    }

    setIsPlaying(!isPlaying);
  }, [isPlaying, currentIndex, items, progress, inPoint, outPoint, calculateAbsoluteTime, findPositionFromTime]);

  // Video clip handlers
  const handleVideoLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    const currentItem = items[currentIndex];
    if (!video || !currentItem) return;

    const cut = currentItem.cut;
    if (cut.isClip && cut.inPoint !== undefined) {
      video.currentTime = cut.inPoint;
    }

    // Apply playback state
    if (isPlaying) {
      video.play().catch(() => {});
    }
  }, [items, currentIndex, isPlaying]);

  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    const currentItem = items[currentIndex];
    if (!video || !currentItem) return;

    // Skip if already stopped at OUT point
    if (stoppedAtOutPointRef.current) return;

    const cut = currentItem.cut;

    // Calculate progress within this cut
    const cutInPoint = cut.isClip && cut.inPoint !== undefined ? cut.inPoint : 0;
    const cutOutPoint = cut.isClip && cut.outPoint !== undefined ? cut.outPoint : video.duration;
    const clipDuration = cutOutPoint - cutInPoint;

    if (clipDuration > 0) {
      const elapsed = video.currentTime - cutInPoint;
      const newProgress = Math.min(100, Math.max(0, (elapsed / clipDuration) * 100));
      setProgress(newProgress);

      // Check against global IN/OUT range
      if (inPoint !== null && outPoint !== null) {
        const currentAbsTime = calculateAbsoluteTime(currentIndex, newProgress);
        const effectiveOutPoint = Math.max(inPoint, outPoint);
        const effectiveInPoint = Math.min(inPoint, outPoint);

        if (currentAbsTime >= effectiveOutPoint) {
          video.pause();
          if (isLooping) {
            const loopPosition = findPositionFromTime(effectiveInPoint);
            setCurrentIndex(loopPosition.index);
            setProgress(loopPosition.progress);

            // Seek video if looping back to a video item
            if (items[loopPosition.index]?.cut.asset?.type === 'video') {
              const loopCut = items[loopPosition.index].cut;
              const videoStartTime = loopCut.isClip && loopCut.inPoint !== undefined ? loopCut.inPoint : 0;
              const localTime = (loopPosition.progress / 100) * loopCut.displayTime;
              video.currentTime = videoStartTime + localTime;
              video.play().catch(() => {});
            }
          } else {
            stoppedAtOutPointRef.current = true;
            setIsPlaying(false);
          }
          return;
        }
      }
    }

    // Check if we've reached the cut's out point (clip trimming)
    if (cut.isClip && cut.outPoint !== undefined) {
      if (video.currentTime >= cut.outPoint) {
        video.pause();
        goToNext();
      }
    }
  }, [items, currentIndex, goToNext, inPoint, outPoint, isLooping, calculateAbsoluteTime, findPositionFromTime]);

  const handleVideoEnded = useCallback(() => {
    goToNext();
  }, [goToNext]);

  // Control video when isPlaying changes
  useEffect(() => {
    const video = videoRef.current;
    const currentItem = items[currentIndex];
    if (!video || currentItem?.cut.asset?.type !== 'video') return;

    // Don't play if buffering
    if (isPlaying && !isBuffering) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, isBuffering, currentIndex, items]);

  // Auto pause/resume based on buffer status (Sequence Mode)
  useEffect(() => {
    if (isSingleMode || items.length === 0) return;

    const video = videoRef.current;
    const { ready } = checkBufferStatus();

    if (isPlaying && !ready && !isBuffering) {
      // Buffer depleted - pause and show loading
      setIsBuffering(true);
      if (video) {
        video.pause();
      }
    } else if (isPlaying && ready && isBuffering) {
      // Buffer restored - resume playback
      setIsBuffering(false);
      if (video && items[currentIndex]?.cut.asset?.type === 'video') {
        video.play().catch(() => {});
      }
    }
  }, [isSingleMode, items, currentIndex, isPlaying, isBuffering, checkBufferStatus]);

  // Use ref to track initial progress to avoid re-running effect on every progress update
  const initialProgressRef = useRef(progress);
  useEffect(() => {
    initialProgressRef.current = progress;
  }, [currentIndex]); // Only update when changing items

  useEffect(() => {
    if (!isPlaying || items.length === 0 || isDragging || isBuffering) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const currentItem = items[currentIndex];
    if (!currentItem) return;

    // Skip timer for videos - they have their own playback
    if (currentItem.cut.asset?.type === 'video') {
      return;
    }

    const duration = (currentItem.cut.displayTime * 1000) / playbackSpeed;
    const initialProgress = initialProgressRef.current;
    const remainingDuration = duration * (1 - initialProgress / 100);
    startTimeRef.current = Date.now();
    elapsedRef.current = (initialProgress / 100) * duration;

    // Calculate effective OUT point for range checking
    const totalDuration = items.reduce((acc, item) => acc + item.cut.displayTime, 0);
    const effectiveOutPoint = (inPoint !== null && outPoint !== null)
      ? Math.max(inPoint, outPoint)
      : totalDuration;
    const effectiveInPoint = (inPoint !== null && outPoint !== null)
      ? Math.min(inPoint, outPoint)
      : 0;

    let stopped = false; // Prevent multiple stops

    const progressInterval = setInterval(() => {
      if (stopped) return;

      const elapsed = elapsedRef.current + (Date.now() - startTimeRef.current);
      const newProgress = Math.min(100, (elapsed / duration) * 100);
      setProgress(newProgress);

      // Check if we've exceeded OUT point
      if (inPoint !== null && outPoint !== null) {
        const currentAbsTime = calculateAbsoluteTime(currentIndex, newProgress);
        if (currentAbsTime >= effectiveOutPoint) {
          stopped = true;
          clearInterval(progressInterval);
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }

          if (isLooping) {
            const loopPosition = findPositionFromTime(effectiveInPoint);
            setCurrentIndex(loopPosition.index);
            setProgress(loopPosition.progress);
            initialProgressRef.current = loopPosition.progress;
            elapsedRef.current = (loopPosition.progress / 100) * items[loopPosition.index].cut.displayTime * 1000;
          } else {
            setIsPlaying(false);
          }
        }
      }
    }, 50);

    timerRef.current = setTimeout(() => {
      if (!stopped) {
        clearInterval(progressInterval);
        goToNext();
      }
    }, remainingDuration);

    return () => {
      clearInterval(progressInterval);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, currentIndex, items, goToNext, playbackSpeed, isDragging, isBuffering, inPoint, outPoint, isLooping, calculateAbsoluteTime, findPositionFromTime]);

  // Cycle playback speed
  const cycleSpeed = useCallback((direction: 'up' | 'down') => {
    setPlaybackSpeed(current => cyclePlaybackSpeed(current, direction));
  }, []);

  // IN/OUT point handlers
  const handleSetInPoint = useCallback(() => {
    if (items.length === 0) return;
    let elapsedDuration = 0;
    for (let i = 0; i < currentIndex; i++) {
      elapsedDuration += items[i].cut.displayTime;
    }
    elapsedDuration += (progress / 100) * items[currentIndex].cut.displayTime;
    setInPoint(elapsedDuration);
  }, [items, currentIndex, progress]);

  const handleSetOutPoint = useCallback(() => {
    if (items.length === 0) return;
    let elapsedDuration = 0;
    for (let i = 0; i < currentIndex; i++) {
      elapsedDuration += items[i].cut.displayTime;
    }
    elapsedDuration += (progress / 100) * items[currentIndex].cut.displayTime;
    setOutPoint(elapsedDuration);
  }, [items, currentIndex, progress]);

  const handleClearPoints = useCallback(() => {
    setInPoint(null);
    setOutPoint(null);
  }, []);

  // Keyboard controls - unified for both modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case ' ':
          e.preventDefault();
          if (isSingleMode) {
            toggleSingleModePlay();
          } else {
            handlePlayPause();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (isSingleMode) {
            skip(-5);
          } else {
            skip(-5);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (isSingleMode) {
            skip(5);
          } else {
            skip(5);
          }
          break;
        case ',':
          e.preventDefault();
          // If marker is focused, step the marker; otherwise step the frame
          if (focusedMarker) {
            stepFocusedMarker(-1);
          } else if (isSingleMode) {
            stepFrame(-1);
          } else {
            // In Sequence Mode, frame step only works during video clip playback
            const currentItem = items[currentIndex];
            if (currentItem?.cut.asset?.type === 'video') {
              stepFrame(-1);
            }
          }
          break;
        case '.':
          e.preventDefault();
          // If marker is focused, step the marker; otherwise step the frame
          if (focusedMarker) {
            stepFocusedMarker(1);
          } else if (isSingleMode) {
            stepFrame(1);
          } else {
            // In Sequence Mode, frame step only works during video clip playback
            const currentItem = items[currentIndex];
            if (currentItem?.cut.asset?.type === 'video') {
              stepFrame(1);
            }
          }
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
        case 'i':
          if (isSingleMode) {
            handleSingleModeSetInPoint();
          } else {
            handleSetInPoint();
          }
          break;
        case 'o':
          if (isSingleMode) {
            handleSingleModeSetOutPoint();
          } else {
            handleSetOutPoint();
          }
          break;
        case 'm':
          toggleGlobalMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onClose,
    isSingleMode,
    toggleSingleModePlay,
    handlePlayPause,
    skip,
    stepFrame,
    stepFocusedMarker,
    focusedMarker,
    items,
    currentIndex,
    cycleSpeed,
    handleSingleModeSetInPoint,
    handleSingleModeSetOutPoint,
    handleSetInPoint,
    handleSetOutPoint,
    toggleGlobalMute,
  ]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && modalRef.current) {
      modalRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Export full sequence (no range)
  const handleExportFull = useCallback(async () => {
    if (!window.electronAPI || items.length === 0) return;

    setIsExporting(true);
    setIsPlaying(false);

    try {
      const exportWidth = selectedResolution.width > 0 ? selectedResolution.width : 1920;
      const exportHeight = selectedResolution.height > 0 ? selectedResolution.height : 1080;

      const outputPath = await window.electronAPI.showSaveSequenceDialog('sequence_export.mp4');
      if (!outputPath) {
        setIsExporting(false);
        return;
      }

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

  // Export with IN/OUT range (Save button) - kept for future UI implementation
  const _handleExportRange = useCallback(async () => {
    if (!window.electronAPI || items.length === 0) return;
    if (inPoint === null || outPoint === null) return;

    setIsExporting(true);
    setIsPlaying(false);

    try {
      const exportWidth = selectedResolution.width > 0 ? selectedResolution.width : 1920;
      const exportHeight = selectedResolution.height > 0 ? selectedResolution.height : 1080;

      const outputPath = await window.electronAPI.showSaveSequenceDialog('sequence_export.mp4');
      if (!outputPath) {
        setIsExporting(false);
        return;
      }

      const rangeStart = Math.min(inPoint, outPoint);
      const rangeEnd = Math.max(inPoint, outPoint);

      const sequenceItems: Array<{
        type: 'image' | 'video';
        path: string;
        duration: number;
        inPoint?: number;
        outPoint?: number;
      }> = [];

      let accumulatedTime = 0;
      for (const item of items) {
        const asset = item.cut.asset;
        if (!asset?.path) continue;

        const itemStart = accumulatedTime;
        const itemEnd = accumulatedTime + item.cut.displayTime;
        accumulatedTime = itemEnd;

        if (itemEnd <= rangeStart || itemStart >= rangeEnd) continue;

        const clipStart = Math.max(0, rangeStart - itemStart);
        const clipEnd = Math.min(item.cut.displayTime, rangeEnd - itemStart);
        const clipDuration = clipEnd - clipStart;

        if (clipDuration <= 0) continue;

        if (asset.type === 'video') {
          const originalInPoint = item.cut.isClip && item.cut.inPoint !== undefined ? item.cut.inPoint : 0;
          sequenceItems.push({
            type: 'video',
            path: asset.path,
            duration: clipDuration,
            inPoint: originalInPoint + clipStart,
            outPoint: originalInPoint + clipEnd,
          });
        } else {
          sequenceItems.push({
            type: 'image',
            path: asset.path,
            duration: clipDuration,
          });
        }
      }

      if (sequenceItems.length === 0) {
        alert('No items in the selected range');
        setIsExporting(false);
        return;
      }

      const result = await window.electronAPI.exportSequence({
        items: sequenceItems,
        outputPath,
        width: exportWidth,
        height: exportHeight,
        fps: 30,
      });

      if (result.success) {
        alert(`Export complete! (${formatTime(rangeStart)} - ${formatTime(rangeEnd)})\nFile: ${result.outputPath}\nSize: ${(result.fileSize! / 1024 / 1024).toFixed(2)} MB`);
      } else {
        alert(`Export failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Export error: ${String(error)}`);
    } finally {
      setIsExporting(false);
    }
  }, [items, selectedResolution, inPoint, outPoint]);
  // Suppress unused variable warning - code kept for future use
  void _handleExportRange;

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

  // Progress bar handlers
  const handleProgressBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || items.length === 0) return;

    // Reset stopped flag when seeking
    stoppedAtOutPointRef.current = false;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressPercent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));

    const totalDuration = items.reduce((acc, item) => acc + item.cut.displayTime, 0);
    let newTime = (progressPercent / 100) * totalDuration;

    // If a marker is focused, move that marker with constraints
    if (focusedMarker === 'in') {
      // Constrain IN marker to not go past OUT point
      if (outPoint !== null) {
        newTime = Math.min(newTime, outPoint);
      }
      setInPoint(newTime);
    } else if (focusedMarker === 'out') {
      // Constrain OUT marker to not go before IN point
      if (inPoint !== null) {
        newTime = Math.max(newTime, inPoint);
      }
      setOutPoint(newTime);
    }

    // Always update playback position (recalculate from constrained newTime)
    const constrainedPercent = (newTime / totalDuration) * 100;
    const { index, localProgress } = calculateGlobalPositionFromProgress(constrainedPercent);
    setCurrentIndex(index);
    setProgress(localProgress);
    elapsedRef.current = (localProgress / 100) * items[index].cut.displayTime * 1000;
  }, [items, calculateGlobalPositionFromProgress, focusedMarker, inPoint, outPoint]);

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

  // Apply global volume to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = globalVolume;
      videoRef.current.muted = globalMuted;
    }
  }, [globalVolume, globalMuted]);

  // ===== SHARED COMPUTED VALUES =====
  const currentItem = items[currentIndex];
  const globalProgress = calculateGlobalProgress();
  const sequenceTotalDuration = items.reduce((acc, item) => acc + item.cut.displayTime, 0);
  const sequenceCurrentTime = (globalProgress / 100) * sequenceTotalDuration;

  // Check if range/IN-point is set for Save button
  const hasInPoint = inPoint !== null;
  // _hasRange kept for future range export UI implementation
  const _hasRange = inPoint !== null && outPoint !== null;
  // Suppress unused variable warnings - code kept for future use
  void _hasRange;

  // Single Mode: show Save button if IN point is set and callbacks are provided
  const showSingleModeSaveButton = isSingleMode && hasInPoint && (onClipSave || onFrameCapture);

  // Single Mode progress
  const singleModeProgressPercent = singleModeDuration > 0 ? (singleModeCurrentTime / singleModeDuration) * 100 : 0;

  // ===== SINGLE MODE RENDER =====
  if (isSingleMode) {
    return (
      <div className="preview-modal" ref={modalRef} onMouseDown={handleContainerMouseDown}>
        <div className="preview-backdrop" onClick={onClose} />
        <div className="preview-container">
          {/* Header: Left=asset name + resolution, Right=resolution select/close */}
          <div className="preview-header">
            <div className="header-left">
              <span className="scene-label">{asset.name}</span>
              {asset.metadata?.width && asset.metadata?.height && (
                <span className="resolution-info">
                  {asset.metadata.width}×{asset.metadata.height}
                </span>
              )}
            </div>
            <div className="header-center">
              {/* Empty for Single Mode */}
            </div>
            <div className="header-right">
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
              <button className="close-btn" onClick={onClose} title="Close (Esc)">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Display area */}
          <div className="preview-display" ref={displayContainerRef}>
            {isLoading ? (
              <div className="preview-placeholder">
                <div className="loading-spinner" />
                <p>Loading {isSingleModeVideo ? 'video' : 'image'}...</p>
              </div>
            ) : isSingleModeVideo && videoObjectUrl ? (
              (() => {
                const viewportStyle = getViewportStyle();
                const videoContent = (
                  <video
                    ref={videoRef}
                    src={videoObjectUrl}
                    className="preview-media"
                    onClick={toggleSingleModePlay}
                    onTimeUpdate={handleSingleModeTimeUpdate}
                    onLoadedMetadata={handleSingleModeLoadedMetadata}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={handleSingleModeVideoEnded}
                  />
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
                      {videoContent}
                    </div>
                  );
                }

                return (
                  <>
                    {videoContent}
                    {/* Play overlay */}
                    {!isPlaying && !isLoading && (
                      <div className="play-overlay" onClick={toggleSingleModePlay}>
                        <Play size={64} />
                      </div>
                    )}
                  </>
                );
              })()
            ) : isSingleModeImage && singleModeImageData ? (
              (() => {
                const viewportStyle = getViewportStyle();
                const imageContent = (
                  <img
                    src={singleModeImageData}
                    alt={asset?.name || 'Preview'}
                    className="preview-media"
                  />
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
                      {imageContent}
                    </div>
                  );
                }

                return imageContent;
              })()
            ) : (
              <div className="preview-placeholder">
                <p>Failed to load {isSingleModeVideo ? 'video' : 'image'}</p>
              </div>
            )}
          </div>

          {/* Progress bar with time display - only for video */}
          {isSingleModeVideo && (
            <div className="preview-progress">
              <div
                className="progress-bar scrub-enabled"
                ref={progressBarRef}
                onClick={handleSingleModeProgressClick}
              >
                <TimelineMarkers
                  inPoint={inPoint}
                  outPoint={outPoint}
                  duration={singleModeDuration}
                  showMilliseconds={true}
                  focusedMarker={focusedMarker}
                  onMarkerFocus={handleMarkerFocus}
                  onMarkerDrag={handleMarkerDrag}
                  onMarkerDragEnd={handleMarkerDragEnd}
                  progressBarRef={progressBarRef}
                />
                <div className="progress-fill" style={{ width: `${singleModeProgressPercent}%` }} />
                <div className="progress-handle" style={{ left: `${singleModeProgressPercent}%` }} />
              </div>
              <div className="progress-info">
                <TimeDisplay currentTime={singleModeCurrentTime} totalDuration={singleModeDuration} showMilliseconds={true} />
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="preview-controls">
            <div className="controls-left">
              {isSingleModeVideo && (
                <>
                  {/* Play/Pause */}
                  <button
                    className="control-btn"
                    onClick={toggleSingleModePlay}
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
                  <VolumeControl
                    volume={globalVolume}
                    isMuted={globalMuted}
                    onVolumeChange={setGlobalVolume}
                    onMuteToggle={toggleGlobalMute}
                  />
                </>
              )}
            </div>
            <div className="controls-center">
              {/* Empty for Single Mode */}
            </div>
            <div className="controls-right">
              {/* IN/OUT controls - only for video */}
              {isSingleModeVideo && (
                <>
                  <ClipRangeControls
                    inPoint={inPoint}
                    outPoint={outPoint}
                    onSetInPoint={handleSingleModeSetInPoint}
                    onSetOutPoint={handleSingleModeSetOutPoint}
                    onClear={handleClearPoints}
                    onSave={showSingleModeSaveButton ? handleSingleModeSave : undefined}
                    showSaveButton={!!showSingleModeSaveButton}
                    showMilliseconds={true}
                  />
                  <LoopToggle isLooping={isLooping} onToggle={() => setIsLooping(!isLooping)} />
                </>
              )}
              <FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== SEQUENCE MODE RENDER =====

  // Empty state for Sequence Mode
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
    <div className="preview-modal" ref={modalRef} onMouseDown={handleContainerMouseDown}>
      <div className="preview-backdrop" onClick={onClose} />
      <div className="preview-container">
        {/* Header: Left=index, Center=scene/cut info, Right=resolution/download/close */}
        <div className="preview-header">
          <div className="header-left">
            <span className="index-info">
              {currentIndex + 1} / {items.length}
            </span>
          </div>
          <div className="header-center">
            <span className="scene-label">{currentItem?.sceneName}</span>
            <span className="cut-label">Cut {(currentItem?.cutIndex || 0) + 1}</span>
          </div>
          <div className="header-right">
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
              className="action-btn"
              onClick={handleExportFull}
              disabled={isExporting || items.length === 0}
              title="Export full sequence to MP4"
            >
              <Download size={18} />
            </button>
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Display area */}
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
                  autoPlay={isPlaying && !isBuffering}
                  muted={globalMuted}
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
                  {/* Buffering overlay */}
                  {isBuffering && (
                    <div className="buffering-overlay">
                      <Loader2 size={48} className="buffering-spinner" />
                      <span>Loading...</span>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <>
                {content}
                {/* Buffering overlay */}
                {isBuffering && (
                  <div className="buffering-overlay">
                    <Loader2 size={48} className="buffering-spinner" />
                    <span>Loading...</span>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Progress bar with time display */}
        <div className="preview-progress">
          <div
            className="progress-bar scrub-enabled"
            ref={progressBarRef}
            onMouseDown={handleProgressBarMouseDown}
            onMouseMove={handleProgressBarHover}
            onMouseLeave={handleProgressBarLeave}
          >
            <TimelineMarkers
              inPoint={inPoint}
              outPoint={outPoint}
              duration={sequenceTotalDuration}
              showMilliseconds={false}
              focusedMarker={focusedMarker}
              onMarkerFocus={handleMarkerFocus}
              onMarkerDrag={handleMarkerDrag}
              onMarkerDragEnd={handleMarkerDragEnd}
              progressBarRef={progressBarRef}
            />
            <div className="progress-fill" style={{ width: `${globalProgress}%` }} />
            <div className="progress-handle" style={{ left: `${globalProgress}%` }} />
            {hoverTime && (
              <div className="progress-tooltip">
                {hoverTime}
              </div>
            )}
          </div>
          <div className="progress-info">
            <TimeDisplay currentTime={sequenceCurrentTime} totalDuration={sequenceTotalDuration} />
          </div>
        </div>

        {/* Controls: Left=play/skip/volume, Center=nav, Right=IN/OUT+loop+fullscreen */}
        <div className="preview-controls">
          <div className="controls-left">
            {/* Play/Pause */}
            <button
              className="control-btn"
              onClick={handlePlayPause}
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
            <VolumeControl
              volume={globalVolume}
              isMuted={globalMuted}
              onVolumeChange={setGlobalVolume}
              onMuteToggle={toggleGlobalMute}
            />
          </div>
          <div className="controls-center">
            <button
              className="control-btn"
              onClick={goToPrev}
              disabled={currentIndex === 0}
              title="Previous Cut"
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
              title="Next Cut"
            >
              <SkipForward size={20} />
            </button>
          </div>
          <div className="controls-right">
            {/* IN/OUT controls - Sequence Mode: no Save button (per plan) */}
            <ClipRangeControls
              inPoint={inPoint}
              outPoint={outPoint}
              onSetInPoint={handleSetInPoint}
              onSetOutPoint={handleSetOutPoint}
              onClear={handleClearPoints}
              showSaveButton={false}
              showMilliseconds={false}
            />
            <LoopToggle isLooping={isLooping} onToggle={() => setIsLooping(!isLooping)} />
            <FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
          </div>
        </div>
      </div>
    </div>
  );
}
