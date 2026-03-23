import type { ExportAudioPlan } from '../../utils/exportAudioPlan';
import { usePreviewAudioPlanPlayback } from './usePreviewAudioPlanPlayback';

interface UsePreviewSequenceAudioInput {
  itemsLength: number;
  absoluteTime: number;
  isPlaying: boolean;
  isBuffering: boolean;
  previewAudioPlan: ExportAudioPlan;
  globalMuted: boolean;
  globalVolume: number;
}

export function usePreviewSequenceAudio({
  itemsLength,
  absoluteTime,
  isPlaying,
  isBuffering,
  previewAudioPlan,
  globalMuted,
  globalVolume,
}: UsePreviewSequenceAudioInput) {
  usePreviewAudioPlanPlayback({
    enabled: itemsLength > 0,
    absoluteTime,
    isPlaying,
    isBuffering,
    previewAudioPlan,
    globalMuted,
    globalVolume,
  });
}
