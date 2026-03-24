import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Cut } from '../../types';
import { createImageMediaSource, type MediaSource } from '../../utils/previewMedia';
import { clampToDuration } from './helpers';
import {
  computeNextRangeForSetIn,
  computeNextRangeForSetOut,
  hasValidRangeSpan,
  moveRangeWindow,
} from './clipRangeOps';
import type { FocusedMarker } from './parts/PlaybackRangeMarkers';

const CLIP_POINT_EPSILON = 0.0001;

interface UsePreviewSingleRuntimeInput {
  isSingleModeVideo: boolean;
  isSingleModeImage: boolean;
  assetName?: string;
  focusCut: Cut | null;
  focusCutId?: string;
  focusCutIsClip?: boolean;
  focusCutInPoint?: number;
  focusCutOutPoint?: number;
  inPoint: number | null;
  outPoint: number | null;
  initialInPoint?: number;
  singleModeInPoint: number | null;
  singleModeOutPoint: number | null;
  singleModeIsLooping: boolean;
  setFocusedMarker: (marker: FocusedMarker) => void;
  setSingleModeInPoint: (value: number | null) => void;
  setSingleModeOutPoint: (value: number | null) => void;
  notifyRangeChange: (inPoint: number | null, outPoint: number | null) => void;
  setMarkerTime: (marker: 'in' | 'out', newTime: number) => number;
  videoRef: React.RefObject<HTMLVideoElement>;
  onClipSave?: (
    inPoint: number,
    outPoint: number,
    options?: { expectedClipRevision?: number }
  ) => Promise<void> | void;
  onClipClear?: () => Promise<void> | void;
  onFrameCapture?: (timestamp: number) => Promise<string | void> | void;
  showMiniToast: (message: string, variant?: 'success' | 'info' | 'warning' | 'error') => void;
  singleModeImageData: string | null;
  singleModeImageDuration: number;
  singleModeDuration: number;
  setSingleModeDuration: (value: number) => void;
  singleModeCurrentTime: number;
  setSingleModeCurrentTime: (value: number) => void;
  getCurrentClipRevision?: () => number;
}

export function usePreviewSingleRuntime({
  isSingleModeVideo,
  isSingleModeImage,
  assetName,
  focusCut: _focusCut,
  focusCutId,
  focusCutIsClip,
  focusCutInPoint,
  focusCutOutPoint,
  inPoint,
  outPoint,
  initialInPoint,
  singleModeInPoint,
  singleModeOutPoint,
  singleModeIsLooping,
  setFocusedMarker,
  setSingleModeInPoint,
  setSingleModeOutPoint,
  notifyRangeChange,
  setMarkerTime,
  videoRef,
  onClipSave,
  onClipClear,
  onFrameCapture,
  showMiniToast,
  singleModeImageData,
  singleModeImageDuration,
  singleModeDuration,
  setSingleModeDuration,
  singleModeCurrentTime,
  setSingleModeCurrentTime,
  getCurrentClipRevision,
}: UsePreviewSingleRuntimeInput) {
  const [singleModeIsPlaying, setSingleModeIsPlaying] = useState(false);
  const [isSingleModeClipEnabled, setIsSingleModeClipEnabled] = useState(false);
  const [isSingleModeClipPending, setIsSingleModeClipPending] = useState(false);
  const [singleMediaElement, setSingleMediaElement] = useState<JSX.Element | null>(null);

  const lastCommittedClipPointsRef = useRef<{ start: number; end: number } | null>(null);
  const singleModeClipDragDirtyRef = useRef(false);
  const queuedClipCommitRef = useRef<{ inPoint: number | null; outPoint: number | null } | null>(null);
  const singleModeRangeRef = useRef<{ inPoint: number | null; outPoint: number | null }>({
    inPoint: null,
    outPoint: null,
  });
  const isDraggingRef = useRef(false);
  const pendingSyncRef = useRef(false);
  const singleImageSourceRef = useRef<MediaSource | null>(null);
  const isPlayingRef = useRef(false);
  const isLoopingRef = useRef(singleModeIsLooping);
  const rangeRef = useRef<{ inPoint: number | null; outPoint: number | null }>({
    inPoint,
    outPoint,
  });
  const latestExternalRef = useRef<{
    cutId: string | null;
    isClip: boolean;
    inPoint: number | null;
    outPoint: number | null;
  }>({
    cutId: null,
    isClip: false,
    inPoint: null,
    outPoint: null,
  });

  useEffect(() => {
    isPlayingRef.current = singleModeIsPlaying;
  }, [singleModeIsPlaying]);

  useEffect(() => {
    isLoopingRef.current = singleModeIsLooping;
  }, [singleModeIsLooping]);

  useEffect(() => {
    rangeRef.current = { inPoint, outPoint };
  }, [inPoint, outPoint]);
  const lastSyncedExternalRef = useRef<{
    cutId: string | null;
    isClip: boolean;
    inPoint: number | null;
    outPoint: number | null;
  }>({
    cutId: null,
    isClip: false,
    inPoint: null,
    outPoint: null,
  });

  const setSingleModeRange = useCallback((nextInPoint: number | null, nextOutPoint: number | null) => {
    singleModeRangeRef.current = { inPoint: nextInPoint, outPoint: nextOutPoint };
    setSingleModeInPoint(nextInPoint);
    setSingleModeOutPoint(nextOutPoint);
  }, [setSingleModeInPoint, setSingleModeOutPoint]);

  const syncLocalRangeFromExternal = useCallback((external: {
    cutId: string | null;
    isClip: boolean;
    inPoint: number | null;
    outPoint: number | null;
  }) => {
    const nextInPoint = external.isClip ? external.inPoint : null;
    const nextOutPoint = external.isClip ? external.outPoint : null;

    setSingleModeRange(nextInPoint, nextOutPoint);
    setIsSingleModeClipEnabled(external.isClip);
    setFocusedMarker(null);
    if (external.isClip && nextInPoint !== null && nextOutPoint !== null) {
      lastCommittedClipPointsRef.current = {
        start: Math.min(nextInPoint, nextOutPoint),
        end: Math.max(nextInPoint, nextOutPoint),
      };
      return;
    }
    lastCommittedClipPointsRef.current = null;
  }, [setSingleModeRange, setFocusedMarker]);

  const commitSingleModeClipPoints = useCallback(async (nextInPoint: number | null, nextOutPoint: number | null) => {
    if (!isSingleModeVideo || !onClipSave) return;
    if (nextInPoint === null || nextOutPoint === null) return;
    if (!hasValidRangeSpan(nextInPoint, nextOutPoint, singleModeDuration)) return;
    if (isSingleModeClipPending) {
      queuedClipCommitRef.current = { inPoint: nextInPoint, outPoint: nextOutPoint };
      return;
    }

    const start = Math.min(nextInPoint, nextOutPoint);
    const end = Math.max(nextInPoint, nextOutPoint);
    const committed = lastCommittedClipPointsRef.current;
    if (
      committed &&
      Math.abs(committed.start - start) < CLIP_POINT_EPSILON &&
      Math.abs(committed.end - end) < CLIP_POINT_EPSILON
    ) {
      return;
    }

    setIsSingleModeClipPending(true);
    try {
      await onClipSave(start, end, { expectedClipRevision: getCurrentClipRevision?.() });
      setIsSingleModeClipEnabled(true);
      lastCommittedClipPointsRef.current = { start, end };
    } catch (error) {
      console.error('Failed to update clip points:', error);
      showMiniToast(error instanceof Error ? error.message : 'Failed to update clip points', 'error');
    } finally {
      setIsSingleModeClipPending(false);
    }
  }, [isSingleModeVideo, onClipSave, isSingleModeClipPending, showMiniToast, getCurrentClipRevision, singleModeDuration]);

  useEffect(() => {
    singleModeRangeRef.current = { inPoint: singleModeInPoint, outPoint: singleModeOutPoint };
  }, [singleModeInPoint, singleModeOutPoint]);

  useEffect(() => {
    if (!isSingleModeVideo) return;
    if (isSingleModeClipPending) return;
    const queued = queuedClipCommitRef.current;
    if (!queued) return;
    queuedClipCommitRef.current = null;
    void commitSingleModeClipPoints(queued.inPoint, queued.outPoint);
  }, [isSingleModeVideo, isSingleModeClipPending, commitSingleModeClipPoints]);

  useEffect(() => {
    if (!isSingleModeVideo) return;
    const external = {
      cutId: focusCutId ?? null,
      isClip: !!focusCutIsClip,
      inPoint: typeof focusCutInPoint === 'number' ? focusCutInPoint : null,
      outPoint: typeof focusCutOutPoint === 'number' ? focusCutOutPoint : null,
    };
    latestExternalRef.current = external;

    const lastSynced = lastSyncedExternalRef.current;
    const changed = (
      external.cutId !== lastSynced.cutId
      || external.isClip !== lastSynced.isClip
      || external.inPoint !== lastSynced.inPoint
      || external.outPoint !== lastSynced.outPoint
    );
    if (!changed) return;

    if (isDraggingRef.current) {
      pendingSyncRef.current = true;
      return;
    }

    syncLocalRangeFromExternal(external);
    lastSyncedExternalRef.current = external;
  }, [
    focusCutId,
    focusCutInPoint,
    focusCutIsClip,
    focusCutOutPoint,
    isSingleModeVideo,
    syncLocalRangeFromExternal,
  ]);

  useEffect(() => {
    if (!isSingleModeImage) {
      singleImageSourceRef.current?.dispose();
      singleImageSourceRef.current = null;
      setSingleMediaElement(null);
      return;
    }

    setSingleModeDuration(singleModeImageDuration);
    const nextCurrentTime = clampToDuration(
      typeof initialInPoint === 'number' ? initialInPoint : 0,
      singleModeImageDuration,
    );
    setSingleModeCurrentTime(nextCurrentTime);

    if (!singleModeImageData || singleModeImageDuration <= 0) {
      singleImageSourceRef.current?.dispose();
      singleImageSourceRef.current = null;
      setSingleMediaElement(null);
      return;
    }

    singleImageSourceRef.current?.dispose();
    const source = createImageMediaSource({
      src: singleModeImageData,
      alt: assetName || 'Preview',
      className: 'preview-media',
      duration: singleModeImageDuration,
      onTimeUpdate: (localTimeSec) => {
        setSingleModeCurrentTime(localTimeSec);

        const currentRange = rangeRef.current;
        if (!isPlayingRef.current || currentRange.inPoint === null || currentRange.outPoint === null) {
          return;
        }

        const clipStart = Math.min(currentRange.inPoint, currentRange.outPoint);
        const clipEnd = Math.max(currentRange.inPoint, currentRange.outPoint);
        if (localTimeSec < clipEnd) return;

        if (isLoopingRef.current) {
          source.seek(clipStart);
          setSingleModeCurrentTime(clipStart);
          return;
        }

        source.pause();
        isPlayingRef.current = false;
        setSingleModeIsPlaying(false);
        source.seek(clipEnd);
        setSingleModeCurrentTime(clipEnd);
      },
      onEnded: () => {
        const currentRange = rangeRef.current;
        const loopStart = currentRange.inPoint !== null
          ? Math.min(currentRange.inPoint, currentRange.outPoint ?? currentRange.inPoint)
          : 0;
        if (isLoopingRef.current) {
          source.seek(loopStart);
          source.play();
          setSingleModeCurrentTime(loopStart);
          return;
        }
        isPlayingRef.current = false;
        setSingleModeIsPlaying(false);
      },
    });
    singleImageSourceRef.current = source;
    source.seek(nextCurrentTime);
    setSingleMediaElement(source.element);

    return () => {
      if (singleImageSourceRef.current === source) {
        singleImageSourceRef.current = null;
      }
      source.dispose();
    };
  }, [
    assetName,
    initialInPoint,
    isSingleModeImage,
    setSingleModeCurrentTime,
    setSingleModeDuration,
    singleModeImageData,
    singleModeImageDuration,
  ]);

  const seekSingleMode = useCallback((time: number) => {
    const nextTime = clampToDuration(time, singleModeDuration);
    if (isSingleModeVideo) {
      if (!videoRef.current) return;
      videoRef.current.currentTime = nextTime;
      setSingleModeCurrentTime(nextTime);
      return;
    }

    if (!isSingleModeImage) return;
    singleImageSourceRef.current?.seek(nextTime);
    setSingleModeCurrentTime(nextTime);
  }, [
    isSingleModeVideo,
    isSingleModeImage,
    singleModeDuration,
    videoRef,
    setSingleModeCurrentTime,
  ]);

  const getSingleModeCurrentTime = useCallback(() => {
    if (isSingleModeVideo) {
      return videoRef.current?.currentTime ?? singleModeCurrentTime;
    }
    if (isSingleModeImage) {
      return singleImageSourceRef.current?.getCurrentTime() ?? singleModeCurrentTime;
    }
    return singleModeCurrentTime;
  }, [isSingleModeVideo, isSingleModeImage, singleModeCurrentTime, videoRef]);

  const playSingleMode = useCallback(() => {
    if (isSingleModeVideo) {
      if (!videoRef.current) return;
      if (inPoint !== null && outPoint !== null) {
        const clipStart = Math.min(inPoint, outPoint);
        const clipEnd = Math.max(inPoint, outPoint);
        if (videoRef.current.currentTime < clipStart || videoRef.current.currentTime >= clipEnd) {
          videoRef.current.currentTime = clipStart;
          setSingleModeCurrentTime(clipStart);
        }
      }
      void videoRef.current.play();
      isPlayingRef.current = true;
      setSingleModeIsPlaying(true);
      return;
    }

    if (!isSingleModeImage) return;
    const source = singleImageSourceRef.current;
    if (!source) return;
    if (inPoint !== null && outPoint !== null) {
      const clipStart = Math.min(inPoint, outPoint);
      const clipEnd = Math.max(inPoint, outPoint);
      const currentTime = source.getCurrentTime();
      if (currentTime < clipStart || currentTime >= clipEnd) {
        source.seek(clipStart);
        setSingleModeCurrentTime(clipStart);
      }
    }
    source.play();
    isPlayingRef.current = true;
    setSingleModeIsPlaying(true);
  }, [
    inPoint,
    isSingleModeImage,
    isSingleModeVideo,
    outPoint,
    setSingleModeCurrentTime,
    videoRef,
  ]);

  const pauseSingleMode = useCallback(() => {
    if (isSingleModeVideo) {
      videoRef.current?.pause();
    } else if (isSingleModeImage) {
      singleImageSourceRef.current?.pause();
    }
    isPlayingRef.current = false;
    setSingleModeIsPlaying(false);
  }, [isSingleModeImage, isSingleModeVideo, videoRef]);

  const beginRangeEdit = useCallback(() => {
    isDraggingRef.current = true;
    if (isPlayingRef.current) {
      pauseSingleMode();
    }
  }, [pauseSingleMode]);

  const handleSingleModeSetInPoint = useCallback(() => {
    if (!isSingleModeVideo) return;
    const nextRange = computeNextRangeForSetIn({
      playheadTime: videoRef.current?.currentTime ?? singleModeCurrentTime,
      duration: singleModeDuration,
      inPoint,
      outPoint,
    });
    const { inPoint: nextInPoint, outPoint: nextOutPoint } = nextRange;
    setSingleModeRange(nextInPoint, nextOutPoint);
    notifyRangeChange(nextInPoint, nextOutPoint);
    void commitSingleModeClipPoints(nextInPoint, nextOutPoint);
  }, [
    isSingleModeVideo,
    singleModeCurrentTime,
    singleModeDuration,
    inPoint,
    outPoint,
    notifyRangeChange,
    commitSingleModeClipPoints,
    setSingleModeRange,
    videoRef,
  ]);

  const handleSingleModeSetOutPoint = useCallback(() => {
    if (!isSingleModeVideo) return;
    const nextRange = computeNextRangeForSetOut({
      playheadTime: videoRef.current?.currentTime ?? singleModeCurrentTime,
      duration: singleModeDuration,
      inPoint,
      outPoint,
    });
    const { inPoint: nextInPoint, outPoint: nextOutPoint } = nextRange;
    setSingleModeRange(nextInPoint, nextOutPoint);
    notifyRangeChange(nextInPoint, nextOutPoint);
    void commitSingleModeClipPoints(nextInPoint, nextOutPoint);
  }, [
    isSingleModeVideo,
    singleModeCurrentTime,
    singleModeDuration,
    inPoint,
    outPoint,
    notifyRangeChange,
    commitSingleModeClipPoints,
    setSingleModeRange,
    videoRef,
  ]);

  const handleSingleModeClearClip = useCallback(async () => {
    if (!isSingleModeVideo) return;
    setIsSingleModeClipPending(true);
    try {
      await onClipClear?.();
      setSingleModeRange(null, null);
      setFocusedMarker(null);
      setIsSingleModeClipEnabled(false);
      lastCommittedClipPointsRef.current = null;
      queuedClipCommitRef.current = null;
      notifyRangeChange(null, null);
      showMiniToast('VIDEOCLIP cleared', 'success');
    } catch (error) {
      console.error('Failed to clear clip:', error);
      showMiniToast(error instanceof Error ? error.message : 'Failed to clear clip', 'error');
    } finally {
      setIsSingleModeClipPending(false);
    }
  }, [isSingleModeVideo, notifyRangeChange, onClipClear, setSingleModeRange, setFocusedMarker, showMiniToast]);

  const handleSingleModeSave = useCallback(async () => {
    if (!isSingleModeVideo) return;
    if (inPoint === null || outPoint === null) return;
    if (!hasValidRangeSpan(inPoint, outPoint, singleModeDuration)) return;

    const start = Math.min(inPoint, outPoint);
    const end = Math.max(inPoint, outPoint);
    setIsSingleModeClipPending(true);
    try {
      await onClipSave?.(start, end, { expectedClipRevision: getCurrentClipRevision?.() });
      setIsSingleModeClipEnabled(true);
      lastCommittedClipPointsRef.current = { start, end };
      showMiniToast('VIDEOCLIP set', 'success');
    } catch (error) {
      console.error('Failed to save clip:', error);
      showMiniToast(error instanceof Error ? error.message : 'Failed to save clip', 'error');
    } finally {
      setIsSingleModeClipPending(false);
    }
  }, [isSingleModeVideo, inPoint, outPoint, onClipSave, showMiniToast, getCurrentClipRevision, singleModeDuration]);

  const handleSingleModeCaptureFrame = useCallback(async () => {
    if (!isSingleModeVideo || !onFrameCapture) return;
    const timestamp = videoRef.current?.currentTime ?? singleModeCurrentTime;
    try {
      const message = await onFrameCapture(timestamp);
      if (message) {
        showMiniToast(message, 'success');
      }
    } catch (error) {
      console.error('Frame capture failed:', error);
      const message = error instanceof Error ? error.message : 'Capture failed';
      showMiniToast(message, 'error');
    }
  }, [isSingleModeVideo, onFrameCapture, singleModeCurrentTime, videoRef, showMiniToast]);

  const handleSingleModeTimeUpdate = useCallback(() => {
    if (!videoRef.current || !isSingleModeVideo) return;

    setSingleModeCurrentTime(videoRef.current.currentTime);

    if (singleModeIsPlaying && inPoint !== null && outPoint !== null) {
      const clipStart = Math.min(inPoint, outPoint);
      const clipEnd = Math.max(inPoint, outPoint);
      if (videoRef.current.currentTime >= clipEnd) {
        if (singleModeIsLooping) {
          videoRef.current.currentTime = clipStart;
        } else {
          pauseSingleMode();
          videoRef.current.currentTime = clipEnd;
          setSingleModeCurrentTime(clipEnd);
        }
      }
    }
  }, [isSingleModeVideo, inPoint, outPoint, singleModeIsLooping, singleModeIsPlaying, videoRef, pauseSingleMode]);

  const handleSingleModeLoadedMetadata = useCallback(() => {
    if (!videoRef.current || !isSingleModeVideo) return;

    setSingleModeDuration(videoRef.current.duration);

    if (initialInPoint !== undefined) {
      videoRef.current.currentTime = initialInPoint;
      setSingleModeCurrentTime(initialInPoint);
    }
  }, [isSingleModeVideo, initialInPoint, videoRef]);

  const handleSingleModeVideoEnded = useCallback(() => {
    if (!isSingleModeVideo) return;

    if (singleModeIsLooping && videoRef.current) {
      const loopStart = inPoint !== null ? Math.min(inPoint, outPoint ?? inPoint) : 0;
      videoRef.current.currentTime = loopStart;
      void videoRef.current.play();
    } else {
      pauseSingleMode();
    }
  }, [isSingleModeVideo, singleModeIsLooping, inPoint, outPoint, videoRef, pauseSingleMode]);

  const handleMarkerDragStart = useCallback(() => {
    beginRangeEdit();
  }, [beginRangeEdit]);

  const handleMarkerDrag = useCallback((marker: 'in' | 'out', newTime: number): number => {
    beginRangeEdit();
    if (isSingleModeVideo) {
      singleModeClipDragDirtyRef.current = true;
    }
    return setMarkerTime(marker, newTime);
  }, [beginRangeEdit, setMarkerTime, isSingleModeVideo]);

  const handleSelectionDragStart = useCallback(() => {
    beginRangeEdit();
  }, [beginRangeEdit]);

  const handleSelectionDrag = useCallback((baseInPoint: number, baseOutPoint: number, deltaTime: number) => {
    beginRangeEdit();
    const nextRange = moveRangeWindow({
      inPoint: baseInPoint,
      outPoint: baseOutPoint,
      duration: singleModeDuration,
      deltaTime,
    });
    setSingleModeRange(nextRange.inPoint, nextRange.outPoint);
    notifyRangeChange(nextRange.inPoint, nextRange.outPoint);
    if (isSingleModeVideo) {
      singleModeClipDragDirtyRef.current = true;
    }
    return nextRange;
  }, [
    beginRangeEdit,
    singleModeDuration,
    setSingleModeRange,
    notifyRangeChange,
    isSingleModeVideo,
  ]);

  const handleMarkerDragEnd = useCallback(async () => {
    if (isSingleModeVideo && singleModeClipDragDirtyRef.current) {
      singleModeClipDragDirtyRef.current = false;
      const { inPoint: latestInPoint, outPoint: latestOutPoint } = singleModeRangeRef.current;
      await commitSingleModeClipPoints(latestInPoint, latestOutPoint);
    }
    isDraggingRef.current = false;
    if (pendingSyncRef.current) {
      pendingSyncRef.current = false;
      const latestExternal = latestExternalRef.current;
      syncLocalRangeFromExternal(latestExternal);
      lastSyncedExternalRef.current = latestExternal;
    }
  }, [isSingleModeVideo, commitSingleModeClipPoints, syncLocalRangeFromExternal]);

  return {
    singleMediaElement,
    singleModeIsPlaying,
    setSingleModeIsPlaying,
    isSingleModeClipEnabled,
    isSingleModeClipPending,
    playSingleMode,
    pauseSingleMode,
    seekSingleMode,
    getSingleModeCurrentTime,
    handleSingleModeSetInPoint,
    handleSingleModeSetOutPoint,
    handleSingleModeClearClip,
    handleSingleModeSave,
    handleSingleModeCaptureFrame,
    handleSingleModeTimeUpdate,
    handleSingleModeLoadedMetadata,
    handleSingleModeVideoEnded,
    handleMarkerDragStart,
    handleMarkerDrag,
    handleSelectionDragStart,
    handleSelectionDrag,
    handleMarkerDragEnd,
  };
}
