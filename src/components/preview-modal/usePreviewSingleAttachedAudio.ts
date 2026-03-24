import { useCallback, useMemo } from 'react';
import type React from 'react';
import type { ExportAudioPlan } from '../../utils/exportAudioPlan';
import { usePreviewAudioPlanPlayback } from './usePreviewAudioPlanPlayback';

interface UsePreviewSingleAttachedAudioInput {
  isSingleModeVideo: boolean;
  hasCutContext: boolean;
  assetId: string | undefined;
  previewAudioPlan: ExportAudioPlan;
  inPoint: number | null;
  outPoint: number | null;
  isPlaying: boolean;
  currentTime: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  globalMuted: boolean;
  globalVolume: number;
}

export function usePreviewSingleAttachedAudio({
  isSingleModeVideo,
  hasCutContext,
  assetId,
  previewAudioPlan,
  inPoint,
  outPoint,
  isPlaying,
  currentTime,
  videoRef,
  globalMuted,
  globalVolume,
}: UsePreviewSingleAttachedAudioInput) {
  const clipStartSec = useMemo(() => {
    const clipStart = inPoint !== null
      ? Math.min(inPoint, outPoint ?? inPoint)
      : 0;
    return Math.max(0, clipStart);
  }, [inPoint, outPoint]);

  const previewAbsoluteTime = useMemo(() => {
    if (!isSingleModeVideo) {
      return Math.max(0, currentTime);
    }
    return Math.max(0, currentTime - clipStartSec);
  }, [clipStartSec, currentTime, isSingleModeVideo]);

  const getLiveAbsoluteTime = useCallback(() => {
    if (!isSingleModeVideo) {
      return Math.max(0, currentTime);
    }
    const liveCurrentTime = videoRef.current?.currentTime ?? currentTime;
    return Math.max(0, liveCurrentTime - clipStartSec);
  }, [clipStartSec, currentTime, isSingleModeVideo, videoRef]);

  usePreviewAudioPlanPlayback({
    enabled: !!assetId && hasCutContext,
    absoluteTime: previewAbsoluteTime,
    getLiveAbsoluteTime,
    isPlaying,
    isBuffering: false,
    previewAudioPlan,
    globalMuted,
    globalVolume,
  });
}
