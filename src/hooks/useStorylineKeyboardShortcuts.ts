import { useCallback, useEffect } from 'react';
import type React from 'react';

export interface StorylineKeyboardCapabilities {
  hasCommandShortcuts: boolean;
}

export interface StorylineKeyboardCommands {
  // Reserved command lane. Concrete bindings will be added in a later phase.
}

interface UseStorylineKeyboardShortcutsInput {
  containerRef: React.RefObject<HTMLDivElement>;
  isCommandScopeActive: boolean;
  isPointerInside: boolean;
  isHandToolActive: boolean;
  commands: StorylineKeyboardCommands;
  capabilities: StorylineKeyboardCapabilities;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function shouldHandleStorylineCommandShortcut(input: {
  target: EventTarget | null;
  container: HTMLDivElement | null;
  isCommandScopeActive: boolean;
  isHandToolActive: boolean;
}): boolean {
  const { target, container, isCommandScopeActive, isHandToolActive } = input;
  if (isHandToolActive) return false;
  if (!isCommandScopeActive) return false;
  if (!(target instanceof HTMLElement)) return false;
  if (!container?.contains(target)) return false;
  if (isEditableTarget(target)) return false;
  if (target.closest('button, a[href], [role="button"], [role="menuitem"], [role="dialog"], [aria-modal="true"]')) {
    return false;
  }
  return true;
}

export function useStorylineKeyboardShortcuts({
  containerRef,
  isCommandScopeActive,
  isPointerInside,
  isHandToolActive,
  commands,
  capabilities,
}: UseStorylineKeyboardShortcutsInput) {
  const shouldHandleCommandShortcut = useCallback((target: EventTarget | null) => (
    shouldHandleStorylineCommandShortcut({
      target,
      container: containerRef.current,
      isCommandScopeActive,
      isHandToolActive,
    })
  ), [containerRef, isCommandScopeActive, isHandToolActive]);

  useEffect(() => {
    if (!capabilities.hasCommandShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!shouldHandleCommandShortcut(event.target)) return;

      // Reserved command lane. Bindings will be added after keymap review.
      void commands;
      void isPointerInside;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [capabilities.hasCommandShortcuts, commands, isPointerInside, shouldHandleCommandShortcut]);

  return {
    shouldHandleCommandShortcut,
  };
}
