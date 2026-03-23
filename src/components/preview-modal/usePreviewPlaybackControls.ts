import { useCallback, useEffect } from 'react';

interface SequenceStateSnapshot {
  currentIndex: number;
  localProgress: number;
  isPlaying: boolean;
  isBuffering: boolean;
  isLooping: boolean;
  inPoint: number | null;
  outPoint: number | null;
  totalDuration: number;
}

interface UsePreviewPlaybackControlsInput {
  itemsLength: number;
  sequenceState: SequenceStateSnapshot;
  getSequenceAbsoluteTime: () => number;
  sequenceGoToNext: () => void;
  sequenceGoToPrev: () => void;
  sequenceToggle: () => void;
  sequencePause: () => void;
  setSequenceLooping: (isLooping: boolean) => void;
  seekSequenceAbsolute: (time: number) => void;
  setSequenceBuffering: (isBuffering: boolean) => void;
  checkBufferStatus: () => { ready: boolean; neededItems: number[] };
}

export function usePreviewPlaybackControls({
  itemsLength,
  sequenceState,
  getSequenceAbsoluteTime,
  sequenceGoToNext,
  sequenceGoToPrev,
  sequenceToggle,
  sequencePause,
  setSequenceLooping,
  seekSequenceAbsolute,
  setSequenceBuffering,
  checkBufferStatus,
}: UsePreviewPlaybackControlsInput) {
  const goToNext = useCallback(() => {
    sequenceGoToNext();
  }, [sequenceGoToNext]);

  const goToPrev = useCallback(() => {
    sequenceGoToPrev();
  }, [sequenceGoToPrev]);

  const handlePlayPause = useCallback(() => {
    if (itemsLength === 0) return;

    if (!sequenceState.isPlaying) {
      const currentAbsTime = getSequenceAbsoluteTime();
      if (sequenceState.inPoint !== null && sequenceState.outPoint !== null) {
        const effectiveOutPoint = Math.max(sequenceState.inPoint, sequenceState.outPoint);
        const effectiveInPoint = Math.min(sequenceState.inPoint, sequenceState.outPoint);
        if (currentAbsTime < effectiveInPoint - 0.001 || currentAbsTime >= effectiveOutPoint - 0.001) {
          seekSequenceAbsolute(effectiveInPoint);
        }
      } else if (sequenceState.currentIndex >= itemsLength - 1 && sequenceState.localProgress >= 99) {
        seekSequenceAbsolute(0);
      }
    }

    sequenceToggle();
  }, [itemsLength, sequenceState, getSequenceAbsoluteTime, seekSequenceAbsolute, sequenceToggle]);

  useEffect(() => {
    if (itemsLength === 0) return;

    const { ready } = checkBufferStatus();
    if (sequenceState.isPlaying && !ready && !sequenceState.isBuffering) {
      setSequenceBuffering(true);
    } else if (sequenceState.isPlaying && ready && sequenceState.isBuffering) {
      setSequenceBuffering(false);
    }
  }, [itemsLength, sequenceState.isPlaying, sequenceState.isBuffering, checkBufferStatus, setSequenceBuffering]);

  const toggleLooping = useCallback(() => {
    setSequenceLooping(!sequenceState.isLooping);
  }, [sequenceState.isLooping, setSequenceLooping]);

  const pauseBeforeExport = useCallback(() => {
    sequencePause();
  }, [sequencePause]);

  return {
    goToNext,
    goToPrev,
    handlePlayPause,
    toggleLooping,
    pauseBeforeExport,
  };
}
