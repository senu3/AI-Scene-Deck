import { useCallback, useEffect } from 'react';
import type React from 'react';

const TABBABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getTabbableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter((element) => {
    if (element.getAttribute('aria-hidden') === 'true') return false;
    return element.tabIndex >= 0;
  });
}

export function usePreviewFocusTrap(modalRef: React.RefObject<HTMLDivElement>) {
  const handleKeyDownCapture = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;

    const modal = modalRef.current;
    if (!modal) return;

    const tabbableElements = getTabbableElements(modal);
    if (tabbableElements.length === 0) return;

    const activeElement = document.activeElement as HTMLElement | null;
    const firstElement = tabbableElements[0];
    const lastElement = tabbableElements[tabbableElements.length - 1];

    if (event.shiftKey) {
      if (activeElement === firstElement || activeElement === modal) {
        event.preventDefault();
        lastElement.focus();
      }
      return;
    }

    if (activeElement === lastElement || activeElement === modal) {
      event.preventDefault();
      firstElement.focus();
    }
  }, [modalRef]);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusFirstElement = window.requestAnimationFrame(() => {
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement && modal.contains(activeElement)) {
        return;
      }

      const tabbableElements = getTabbableElements(modal);
      if (tabbableElements.length > 0) {
        tabbableElements[0].focus();
      }
    });

    return () => {
      window.cancelAnimationFrame(focusFirstElement);
    };
  }, [modalRef]);

  return handleKeyDownCapture;
}
