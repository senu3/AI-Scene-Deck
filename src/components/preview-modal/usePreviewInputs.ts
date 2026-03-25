import type React from 'react';
import { usePreviewKeyboardShortcuts } from './usePreviewKeyboardShortcuts';
import { usePreviewProgressInteractions } from './usePreviewProgressInteractions';

interface UsePreviewInputsInput {
  modalRef: React.RefObject<HTMLDivElement>;
  progressBarRef: React.RefObject<HTMLDivElement>;
  itemsLength: number;
  totalDuration: number;
  onPauseBeforeSeek: () => void;
  onSeekAbsolute: (time: number) => void;
  onSeekPercent: (percent: number) => void;
  onClose: () => void;
  onPlayPause: () => void;
  onSkipBySeconds: (seconds: number) => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onToggleFullscreen: () => void;
  onToggleLooping: () => void;
  onSetInPoint?: () => void;
  onSetOutPoint?: () => void;
  onToggleMute: () => void;
  onPrimaryClipAction?: () => void;
  onToggleHold?: () => void;
  onCaptureFrame?: () => void;
  onExportFull?: () => void;
}

export function usePreviewInputs({
  modalRef,
  progressBarRef,
  itemsLength,
  totalDuration,
  onPauseBeforeSeek,
  onSeekAbsolute,
  onSeekPercent,
  onClose,
  onPlayPause,
  onSkipBySeconds,
  onStepBack,
  onStepForward,
  onToggleFullscreen,
  onToggleLooping,
  onSetInPoint,
  onSetOutPoint,
  onToggleMute,
  onPrimaryClipAction,
  onToggleHold,
  onCaptureFrame,
  onExportFull,
}: UsePreviewInputsInput) {
  const {
    isDragging,
    hoverTime,
    handleProgressBarMouseDown,
    handleProgressBarHover,
    handleProgressBarLeave,
  } = usePreviewProgressInteractions({
    progressBarRef,
    itemsLength,
    totalDuration,
    onPauseBeforeSeek,
    onSeekAbsolute,
    onSeekPercent,
  });

  usePreviewKeyboardShortcuts({
    modalRef,
    onClose,
    onPlayPause,
    onSkipBySeconds,
    onStepBack,
    onStepForward,
    onToggleFullscreen,
    onToggleLooping,
    onSetInPoint,
    onSetOutPoint,
    onToggleMute,
    onPrimaryClipAction,
    onToggleHold,
    onCaptureFrame,
    onExportFull,
  });

  return {
    isDragging,
    hoverTime,
    handleProgressBarMouseDown,
    handleProgressBarHover,
    handleProgressBarLeave,
  };
}
