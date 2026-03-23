import type React from 'react';
import { useCallback, useState } from 'react';
import { constrainMarkerTime, moveRangeWindow } from './clipRangeOps';
import type { FocusedMarker } from './parts/PlaybackRangeMarkers';

interface UseClipRangeStateInput {
  usesSequenceController: boolean;
  sequenceInPoint: number | null;
  sequenceOutPoint: number | null;
  sequenceTotalDuration: number;
  singleModeDuration: number;
  initialInPoint?: number;
  initialOutPoint?: number;
  onRangeChange?: (range: { inPoint: number | null; outPoint: number | null }) => void;
  setSequenceRange: (inPoint: number | null, outPoint: number | null) => void;
  frameDuration: number;
}

export function useClipRangeState({
  usesSequenceController,
  sequenceInPoint,
  sequenceOutPoint,
  sequenceTotalDuration,
  singleModeDuration,
  initialInPoint,
  initialOutPoint,
  onRangeChange,
  setSequenceRange,
  frameDuration,
}: UseClipRangeStateInput) {
  const [singleModeInPoint, setSingleModeInPoint] = useState<number | null>(initialInPoint ?? null);
  const [singleModeOutPoint, setSingleModeOutPoint] = useState<number | null>(initialOutPoint ?? null);
  const [focusedMarker, setFocusedMarker] = useState<FocusedMarker>(null);

  const inPoint = usesSequenceController ? sequenceInPoint : singleModeInPoint;
  const outPoint = usesSequenceController ? sequenceOutPoint : singleModeOutPoint;

  const notifyRangeChange = useCallback((nextInPoint: number | null, nextOutPoint: number | null) => {
    onRangeChange?.({ inPoint: nextInPoint, outPoint: nextOutPoint });
  }, [onRangeChange]);

  const applyRange = useCallback((nextInPoint: number | null, nextOutPoint: number | null) => {
    if (!usesSequenceController) {
      setSingleModeInPoint(nextInPoint);
      setSingleModeOutPoint(nextOutPoint);
    } else {
      setSequenceRange(nextInPoint, nextOutPoint);
    }
    notifyRangeChange(nextInPoint, nextOutPoint);
  }, [
    usesSequenceController,
    setSequenceRange,
    notifyRangeChange,
  ]);

  const setMarkerTime = useCallback((marker: 'in' | 'out', newTime: number): number => {
    const duration = usesSequenceController
      ? sequenceTotalDuration
      : singleModeDuration;
    const constrainedTime = constrainMarkerTime({
      marker,
      candidateTime: newTime,
      duration,
      inPoint,
      outPoint,
    });

    if (marker === 'in') {
      applyRange(constrainedTime, outPoint ?? null);
    } else {
      applyRange(inPoint ?? null, constrainedTime);
    }

    return constrainedTime;
  }, [
    sequenceTotalDuration,
    singleModeDuration,
    inPoint,
    outPoint,
    applyRange,
  ]);

  const stepMarker = useCallback((marker: 'in' | 'out', direction: number): number | null => {
    const currentMarkerTime = marker === 'in' ? inPoint : outPoint;
    if (currentMarkerTime === null) return null;
    return setMarkerTime(marker, currentMarkerTime + (direction * frameDuration));
  }, [frameDuration, inPoint, outPoint, setMarkerTime]);

  const stepFocusedMarker = useCallback((direction: number): number | null => {
    if (!focusedMarker) return null;
    return stepMarker(focusedMarker, direction);
  }, [focusedMarker, stepMarker]);

  const handleMarkerFocus = useCallback((marker: FocusedMarker) => {
    setFocusedMarker(marker);
  }, []);

  const handleMarkerDrag = useCallback((marker: 'in' | 'out', newTime: number): number => {
    return setMarkerTime(marker, newTime);
  }, [setMarkerTime]);

  const handleSelectionDrag = useCallback((baseInPoint: number, baseOutPoint: number, deltaTime: number) => {
    const duration = usesSequenceController
      ? sequenceTotalDuration
      : singleModeDuration;
    const nextRange = moveRangeWindow({
      inPoint: baseInPoint,
      outPoint: baseOutPoint,
      duration,
      deltaTime,
    });
    applyRange(nextRange.inPoint, nextRange.outPoint);
    return nextRange;
  }, [usesSequenceController, sequenceTotalDuration, singleModeDuration, applyRange]);

  const handleMarkerDragEnd = useCallback(() => {}, []);

  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (!focusedMarker) return;
    const target = e.target as HTMLElement;
    const progressBar = target.closest('.preview-progress-bar');
    if (!progressBar) {
      setFocusedMarker(null);
    }
  }, [focusedMarker]);

  return {
    singleModeInPoint,
    setSingleModeInPoint,
    singleModeOutPoint,
    setSingleModeOutPoint,
    focusedMarker,
    setFocusedMarker,
    inPoint,
    outPoint,
    notifyRangeChange,
    setMarkerTime,
    stepMarker,
    stepFocusedMarker,
    handleMarkerFocus,
    handleMarkerDrag,
    handleSelectionDrag,
    handleMarkerDragEnd,
    handleContainerMouseDown,
  };
}
