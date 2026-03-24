import { useEffect } from 'react';
import type React from 'react';
import { isEditableTarget } from './helpers';

interface UsePreviewKeyboardShortcutsInput {
  modalRef: React.RefObject<HTMLDivElement>;
  onClose: () => void;
  onPlayPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onToggleFullscreen: () => void;
  onToggleLooping: () => void;
  onSetInPoint: () => void;
  onSetOutPoint: () => void;
  onToggleMute: () => void;
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
  onSkipBack,
  onSkipForward,
  onStepBack,
  onStepForward,
  onToggleFullscreen,
  onToggleLooping,
  onSetInPoint,
  onSetOutPoint,
  onToggleMute,
}: UsePreviewKeyboardShortcutsInput) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!isPreviewShortcutTarget(e.target, modalRef)) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case ' ':
          e.preventDefault();
          onPlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onSkipBack();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onSkipForward();
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
          onSetInPoint();
          break;
        case 'o':
          onSetOutPoint();
          break;
        case 'm':
          onToggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    modalRef,
    onClose,
    onPlayPause,
    onSkipBack,
    onSkipForward,
    onStepBack,
    onStepForward,
    onToggleFullscreen,
    onToggleLooping,
    onSetInPoint,
    onSetOutPoint,
    onToggleMute,
  ]);
}
