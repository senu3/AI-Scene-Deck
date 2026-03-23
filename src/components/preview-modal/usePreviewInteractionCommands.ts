import { useCallback } from 'react';
import type React from 'react';
import type { Asset } from '../../types';
import type { PreviewItem } from './types';
import type { FocusedMarker } from './parts/PlaybackRangeMarkers';
import { FRAME_DURATION } from './constants';
import { clampToDuration } from './helpers';
import {
  computeNextRangeForSetIn,
  computeNextRangeForSetOut,
  resolveUiPlayheadTime,
} from './clipRangeOps';

interface UsePreviewInteractionCommandsInput {
  mode: 'single' | 'sequence';
  isPlaying: boolean;
  focusedMarker: FocusedMarker;
  items: PreviewItem[];
  currentIndex: number;
  inPoint: number | null;
  outPoint: number | null;
  singleModeDuration: number;
  sequenceTotalDuration: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  resolveAssetForCut: (cut: PreviewItem['cut']) => Asset | null;
  playSingleMode: () => void;
  pauseSingleMode: () => void;
  seekSingleMode: (time: number) => void;
  getSingleModeCurrentTime: () => number;
  getSequenceAbsoluteTime: () => number;
  seekSequenceAbsolute: (time: number) => void;
  seekSequencePercent: (percent: number) => void;
  sequencePause: () => void;
  skipSequence: (seconds: number) => void;
  setSequenceRange: (inPoint: number | null, outPoint: number | null) => void;
  notifyRangeChange: (inPoint: number | null, outPoint: number | null) => void;
  handlePlayPause: () => void;
  stepMarker: (marker: 'in' | 'out', direction: number) => number | null;
  stepFocusedMarker: (direction: number) => number | null;
  handleSingleModeSetInPoint: () => void;
  handleSingleModeSetOutPoint: () => void;
  toggleLooping: () => void;
  toggleGlobalMute: () => void;
  handleMarkerFocus: (marker: FocusedMarker) => void;
  handleMarkerDragStart: () => void;
  handleMarkerDrag: (marker: 'in' | 'out', newTime: number) => number;
  handleMarkerDragEnd: () => Promise<void>;
  handleSelectionDragStart: () => void;
  handleSelectionDrag: (baseInPoint: number, baseOutPoint: number, deltaTime: number) => void;
  handleSelectionDragEnd: () => Promise<void> | void;
}

export function usePreviewInteractionCommands({
  mode,
  isPlaying,
  focusedMarker,
  items,
  currentIndex,
  inPoint,
  outPoint,
  singleModeDuration,
  sequenceTotalDuration,
  videoRef,
  resolveAssetForCut,
  getSequenceAbsoluteTime,
  seekSequenceAbsolute,
  seekSequencePercent,
  sequencePause,
  skipSequence,
  setSequenceRange,
  notifyRangeChange,
  playSingleMode,
  pauseSingleMode,
  seekSingleMode,
  getSingleModeCurrentTime,
  handlePlayPause,
  stepMarker,
  stepFocusedMarker,
  handleSingleModeSetInPoint,
  handleSingleModeSetOutPoint,
  toggleLooping,
  toggleGlobalMute,
  handleMarkerFocus,
  handleMarkerDragStart,
  handleMarkerDrag,
  handleMarkerDragEnd,
  handleSelectionDragStart,
  handleSelectionDrag,
  handleSelectionDragEnd,
}: UsePreviewInteractionCommandsInput) {
  const seekToAbsolute = useCallback((time: number) => {
    if (mode === 'single') {
      seekSingleMode(clampToDuration(time, singleModeDuration));
      return;
    }
    if (items.length === 0) return;
    seekSequenceAbsolute(clampToDuration(time, sequenceTotalDuration));
  }, [
    mode,
    seekSingleMode,
    singleModeDuration,
    items.length,
    seekSequenceAbsolute,
    sequenceTotalDuration,
  ]);

  const seekToPercent = useCallback((percent: number) => {
    if (mode === 'single') {
      seekToAbsolute((clampToDuration(percent, 100) / 100) * singleModeDuration);
      return;
    }
    if (items.length === 0) return;
    seekSequencePercent(percent);
  }, [mode, seekToAbsolute, singleModeDuration, items.length, seekSequencePercent]);

  const stepSingleMode = useCallback((direction: number) => {
    if (isPlaying) {
      pauseSingleMode();
    }

    const newTime = getSingleModeCurrentTime() + (direction * FRAME_DURATION);
    seekSingleMode(clampToDuration(newTime, singleModeDuration));
  }, [
    isPlaying,
    pauseSingleMode,
    getSingleModeCurrentTime,
    seekSingleMode,
    singleModeDuration,
  ]);

  const stepSequenceFrame = useCallback((direction: number) => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      sequencePause();
    }

    const duration = videoRef.current.duration;
    const newTime = videoRef.current.currentTime + (direction * FRAME_DURATION);
    const clampedTime = clampToDuration(newTime, duration);
    videoRef.current.currentTime = clampedTime;
  }, [
    videoRef,
    isPlaying,
    sequencePause,
  ]);

  const skip = useCallback((seconds: number) => {
    if (mode === 'single') {
      const nextTime = clampToDuration(getSingleModeCurrentTime() + seconds, singleModeDuration);
      seekSingleMode(nextTime);
      return;
    }
    skipSequence(seconds);
  }, [mode, getSingleModeCurrentTime, singleModeDuration, seekSingleMode, skipSequence]);

  const playPause = useCallback(() => {
    if (mode === 'single') {
      if (isPlaying) {
        pauseSingleMode();
      } else {
        playSingleMode();
      }
      return;
    }
    handlePlayPause();
  }, [mode, isPlaying, pauseSingleMode, playSingleMode, handlePlayPause]);

  const beginRangeEdit = useCallback(() => {
    if (!isPlaying) return;
    if (mode === 'single') {
      pauseSingleMode();
      return;
    }
    sequencePause();
  }, [isPlaying, mode, pauseSingleMode, sequencePause]);

  const skipBack = useCallback(() => {
    skip(-5);
  }, [skip]);

  const skipForward = useCallback(() => {
    skip(5);
  }, [skip]);

  const stepBack = useCallback(() => {
    if (focusedMarker) {
      beginRangeEdit();
      const markerTime = stepFocusedMarker(-1);
      if (markerTime !== null) {
        seekToAbsolute(markerTime);
      }
      return;
    }
    if (mode === 'single') {
      stepSingleMode(-1);
      return;
    }
    const currentItem = items[currentIndex];
    const currentAsset = currentItem ? resolveAssetForCut(currentItem.cut) : undefined;
    if (currentAsset?.type === 'video') {
      stepSequenceFrame(-1);
    }
  }, [focusedMarker, beginRangeEdit, stepFocusedMarker, seekToAbsolute, mode, stepSingleMode, items, currentIndex, resolveAssetForCut, stepSequenceFrame]);

  const stepForward = useCallback(() => {
    if (focusedMarker) {
      beginRangeEdit();
      const markerTime = stepFocusedMarker(1);
      if (markerTime !== null) {
        seekToAbsolute(markerTime);
      }
      return;
    }
    if (mode === 'single') {
      stepSingleMode(1);
      return;
    }
    const currentItem = items[currentIndex];
    const currentAsset = currentItem ? resolveAssetForCut(currentItem.cut) : undefined;
    if (currentAsset?.type === 'video') {
      stepSequenceFrame(1);
    }
  }, [focusedMarker, beginRangeEdit, stepFocusedMarker, seekToAbsolute, mode, stepSingleMode, items, currentIndex, resolveAssetForCut, stepSequenceFrame]);

  const setInPoint = useCallback(() => {
    if (mode === 'single') {
      handleSingleModeSetInPoint();
      return;
    }
    if (items.length === 0) return;
    const playheadTime = resolveUiPlayheadTime({
      mode,
      getSingleModeCurrentTime,
      getSequenceAbsoluteTime,
    });
    const nextRange = computeNextRangeForSetIn({
      playheadTime,
      duration: sequenceTotalDuration,
      inPoint,
      outPoint,
    });
    setSequenceRange(nextRange.inPoint, nextRange.outPoint);
    notifyRangeChange(nextRange.inPoint, nextRange.outPoint);
  }, [
    mode,
    handleSingleModeSetInPoint,
    items.length,
    getSingleModeCurrentTime,
    getSequenceAbsoluteTime,
    sequenceTotalDuration,
    inPoint,
    outPoint,
    setSequenceRange,
    notifyRangeChange,
  ]);

  const setOutPoint = useCallback(() => {
    if (mode === 'single') {
      handleSingleModeSetOutPoint();
      return;
    }
    if (items.length === 0) return;
    const playheadTime = resolveUiPlayheadTime({
      mode,
      getSingleModeCurrentTime,
      getSequenceAbsoluteTime,
    });
    const nextRange = computeNextRangeForSetOut({
      playheadTime,
      duration: sequenceTotalDuration,
      inPoint,
      outPoint,
    });
    setSequenceRange(nextRange.inPoint, nextRange.outPoint);
    notifyRangeChange(nextRange.inPoint, nextRange.outPoint);
  }, [
    mode,
    handleSingleModeSetOutPoint,
    items.length,
    getSingleModeCurrentTime,
    getSequenceAbsoluteTime,
    sequenceTotalDuration,
    inPoint,
    outPoint,
    setSequenceRange,
    notifyRangeChange,
  ]);

  const markerDrag = useCallback((marker: 'in' | 'out', newTime: number) => {
    const markerTime = handleMarkerDrag(marker, newTime);
    seekToAbsolute(markerTime);
  }, [handleMarkerDrag, seekToAbsolute]);

  const markerStep = useCallback((marker: 'in' | 'out', direction: number) => {
    handleMarkerFocus(marker);
    beginRangeEdit();
    const markerTime = stepMarker(marker, direction);
    if (markerTime !== null) {
      seekToAbsolute(markerTime);
    }
  }, [handleMarkerFocus, beginRangeEdit, stepMarker, seekToAbsolute]);

  const markerDragStart = useCallback((marker: 'in' | 'out') => {
    handleMarkerFocus(marker);
    beginRangeEdit();
    handleMarkerDragStart();
  }, [handleMarkerFocus, beginRangeEdit, handleMarkerDragStart]);

  const markerDragEnd = useCallback(() => {
    void handleMarkerDragEnd();
  }, [handleMarkerDragEnd]);

  const selectionDragStart = useCallback(() => {
    beginRangeEdit();
    handleSelectionDragStart();
  }, [beginRangeEdit, handleSelectionDragStart]);

  const selectionDrag = useCallback((baseInPoint: number, baseOutPoint: number, deltaTime: number) => {
    handleSelectionDrag(baseInPoint, baseOutPoint, deltaTime);
  }, [handleSelectionDrag]);

  const selectionDragEnd = useCallback(() => {
    void handleSelectionDragEnd();
  }, [handleSelectionDragEnd]);

  return {
    playPause,
    skipBack,
    skipForward,
    stepBack,
    stepForward,
    setInPoint,
    setOutPoint,
    toggleLooping,
    toggleMute: toggleGlobalMute,
    markerFocus: handleMarkerFocus,
    markerStep,
    markerDragStart,
    markerDrag,
    markerDragEnd,
    selectionDragStart,
    selectionDrag,
    selectionDragEnd,
    seekToAbsolute,
    seekToPercent,
  };
}
