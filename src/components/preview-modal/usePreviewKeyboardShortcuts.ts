import { useEffect } from 'react';
import type React from 'react';
import { isEditableTarget } from './helpers';

interface UsePreviewKeyboardShortcutsInput {
  modalRef: React.RefObject<HTMLDivElement>;
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

function isPreviewShortcutTarget(
  target: EventTarget | null,
  modalRef: React.RefObject<HTMLDivElement>
): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  const modal = modalRef.current;
  if (!modal) return false;
  if (!modal.contains(target)) return false;
  if (isEditableTarget(target)) return false;
  if (target.closest('button, a[href], [role="button"]')) return false;
  return true;
}

export function usePreviewKeyboardShortcuts({
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
}: UsePreviewKeyboardShortcutsInput) {
  useEffect(() => {
    const repeatableKeys = new Set(['ArrowLeft', 'ArrowRight', ',', '.']);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const normalizedKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const isArrowKey = normalizedKey === 'ArrowLeft' || normalizedKey === 'ArrowRight';
      if (e.ctrlKey || e.metaKey) return;
      if (e.altKey && !isArrowKey) return;
      if (!isPreviewShortcutTarget(e.target, modalRef)) return;
      if (e.repeat && !repeatableKeys.has(normalizedKey)) return;

      switch (normalizedKey) {
        case 'Escape':
          onClose();
          break;
        case ' ':
          e.preventDefault();
          onPlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onSkipBySeconds(e.altKey ? -1 : e.shiftKey ? -10 : -5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          onSkipBySeconds(e.altKey ? 1 : e.shiftKey ? 10 : 5);
          break;
        case ',':
          e.preventDefault();
          onStepBack();
          break;
        case '.':
          e.preventDefault();
          onStepForward();
          break;
        case 'f':
          onToggleFullscreen();
          break;
        case 'l':
          onToggleLooping();
          break;
        case 'i':
          if (!onSetInPoint) return;
          onSetInPoint();
          break;
        case 'o':
          if (!onSetOutPoint) return;
          onSetOutPoint();
          break;
        case 'm':
          onToggleMute();
          break;
        case 's':
          onPrimaryClipAction?.();
          break;
        case 'h':
          onToggleHold?.();
          break;
        case 'c':
          onCaptureFrame?.();
          break;
        case 'e':
          onExportFull?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
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
  ]);
}
