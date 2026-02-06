/**
 * MiniToast - Compact, auto-dismissing notification for overlay contexts.
 *
 * Designed for use inside PreviewModal or other fullscreen overlays where
 * the standard Toast would be too large and intrusive.
 *
 * Usage:
 *   const { show, element } = useMiniToast();
 *   show('IN point set', 'info');
 *   // render {element} inside your overlay container
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import styles from './MiniToast.module.css';

// ============================================
// Types
// ============================================
export type MiniToastVariant = 'success' | 'info' | 'warning' | 'error';

interface MiniToastState {
  message: string;
  variant: MiniToastVariant;
  key: number;
  exiting: boolean;
}

// ============================================
// useMiniToast Hook
// ============================================
export interface UseMiniToastOptions {
  /** Default duration in ms. Default: 1800 */
  duration?: number;
}

export interface MiniToastAPI {
  /** Show a mini toast message */
  show: (message: string, variant?: MiniToastVariant, duration?: number) => void;
  /** ReactNode to render inside your overlay container */
  element: React.ReactNode;
}

export function useMiniToast(options?: UseMiniToastOptions): MiniToastAPI {
  const defaultDuration = options?.duration ?? 1800;
  const [toast, setToast] = useState<MiniToastState | null>(null);
  const dismissTimerRef = useRef<number>(0);
  const removeTimerRef = useRef<number>(0);

  // Clear timers on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      window.clearTimeout(dismissTimerRef.current);
      window.clearTimeout(removeTimerRef.current);
    };
  }, []);

  const show = useCallback(
    (message: string, variant: MiniToastVariant = 'info', duration?: number) => {
      // Clear any pending timers
      window.clearTimeout(dismissTimerRef.current);
      window.clearTimeout(removeTimerRef.current);

      const ms = duration ?? defaultDuration;

      // Show immediately (new key forces re-mount for animation)
      setToast({ message, variant, key: Date.now(), exiting: false });

      // Start exit animation before removal
      dismissTimerRef.current = window.setTimeout(() => {
        setToast((prev) => (prev ? { ...prev, exiting: true } : null));

        // Remove after exit animation completes
        removeTimerRef.current = window.setTimeout(() => {
          setToast(null);
        }, 180);
      }, ms);
    },
    [defaultDuration]
  );

  const element = toast ? (
    <div
      key={toast.key}
      className={styles.miniToast}
      data-variant={toast.variant}
      data-exiting={toast.exiting || undefined}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  ) : null;

  return { show, element };
}
