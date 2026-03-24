import { useCallback, useEffect } from 'react';
import type React from 'react';
import { isEditableTarget } from './helpers';

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

function isInteractiveTarget(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  if (isEditableTarget(target)) return true;
  return !!target.closest('button, a[href], [role="button"]');
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

    const previousTabIndex = modal.getAttribute('tabindex');
    if (previousTabIndex === null) {
      modal.tabIndex = -1;
    }

    const handlePointerDownCapture = (event: PointerEvent) => {
      if (isInteractiveTarget(event.target)) return;
      modal.focus();
    };
    modal.addEventListener('pointerdown', handlePointerDownCapture, true);

    const focusFirstElement = window.requestAnimationFrame(() => {
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement && modal.contains(activeElement)) {
        return;
      }
      modal.focus();
    });

    return () => {
      modal.removeEventListener('pointerdown', handlePointerDownCapture, true);
      if (previousTabIndex === null) {
        modal.removeAttribute('tabindex');
      }
      window.cancelAnimationFrame(focusFirstElement);
    };
  }, [modalRef]);

  return handleKeyDownCapture;
}
