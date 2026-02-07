import { useEffect, useRef, useState } from 'react';
import { absoluteTimeToRmsIndex, rmsValueToVariantIndex, type LipSyncThresholds } from '../utils/lipSyncUtils';

export interface LipSyncPreviewOptions {
  enabled: boolean;
  rms: number[] | null;
  fps: number;
  thresholds: LipSyncThresholds;
  getCurrentTime: () => number;
  audioOffsetSec?: number;
  intervalMs?: number;
}

export function useLipSyncPreview(options: LipSyncPreviewOptions): number {
  const {
    enabled,
    rms,
    fps,
    thresholds,
    getCurrentTime,
    audioOffsetSec = 0,
    intervalMs = 100,
  } = options;
  const [variantIndex, setVariantIndex] = useState(0);
  const lastIndexRef = useRef(0);

  useEffect(() => {
    lastIndexRef.current = 0;
    setVariantIndex(0);
  }, [enabled, rms, fps, thresholds, audioOffsetSec]);

  useEffect(() => {
    if (!enabled || !rms || rms.length === 0 || fps <= 0) return;

    const tick = () => {
      const time = getCurrentTime();
      const rmsIndex = absoluteTimeToRmsIndex(time, fps, rms.length, audioOffsetSec);
      const value = rms[rmsIndex] ?? 0;
      const nextIndex = rmsValueToVariantIndex(value, thresholds);
      if (nextIndex !== lastIndexRef.current) {
        lastIndexRef.current = nextIndex;
        setVariantIndex(nextIndex);
      }
    };

    const id = window.setInterval(tick, intervalMs);
    return () => {
      window.clearInterval(id);
    };
  }, [enabled, rms, fps, thresholds, getCurrentTime, audioOffsetSec, intervalMs]);

  return variantIndex;
}
