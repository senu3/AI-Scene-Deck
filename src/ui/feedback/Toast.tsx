/**
 * Toast - Notification feedback component
 *
 * Usage:
 * 1. Wrap app with ToastProvider
 * 2. Use useToast() hook to show toasts
 *
 * const { toast } = useToast();
 * toast.success('Saved!');
 * toast.error('Failed to save', 'Check your connection');
 * toast.info('Processing...', undefined, { duration: 0 }); // persistent
 */

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  type ReactNode,
} from 'react';
import { CheckCircle, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import styles from './Toast.module.css';

// ============================================
// Types
// ============================================
export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface ToastAction {
  /** Button label */
  label: string;
  /** Click handler */
  onClick: () => void;
}

export interface ToastOptions {
  /** Duration in ms. 0 = persistent. Default: 4000 for success/info, 6000 for warning/error */
  duration?: number;
  /** Unique ID for deduplication */
  id?: string;
  /** Optional action button (CTA) */
  action?: ToastAction;
}

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration: number;
  createdAt: number;
  exiting?: boolean;
  action?: ToastAction;
}

export interface ToastAPI {
  success: (title: string, message?: string, options?: ToastOptions) => string;
  info: (title: string, message?: string, options?: ToastOptions) => string;
  warning: (title: string, message?: string, options?: ToastOptions) => string;
  error: (title: string, message?: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export interface ToastContextValue {
  toast: ToastAPI;
}

// ============================================
// Context
// ============================================
const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================
// useToast Hook
// ============================================
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ============================================
// Provider
// ============================================
export interface ToastProviderProps {
  children: ReactNode;
  /** Maximum number of toasts to show at once. Default: 5 */
  maxToasts?: number;
}

export function ToastProvider({ children, maxToasts = 5 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdCounter = useRef(0);
  const timersRef = useRef<Map<string, number>>(new Map());

  const getDefaultDuration = (variant: ToastVariant): number => {
    switch (variant) {
      case 'success':
      case 'info':
        return 4000;
      case 'warning':
      case 'error':
        return 6000;
    }
  };

  const dismiss = useCallback((id: string) => {
    // Clear timer
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    // Start exit animation
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );

    // Remove after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const dismissAll = useCallback(() => {
    // Clear all timers
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();

    // Start exit animation for all
    setToasts((prev) => prev.map((t) => ({ ...t, exiting: true })));

    // Remove all after animation
    setTimeout(() => {
      setToasts([]);
    }, 200);
  }, []);

  const addToast = useCallback(
    (
      variant: ToastVariant,
      title: string,
      message?: string,
      options?: ToastOptions
    ): string => {
      const id = options?.id || `toast-${++toastIdCounter.current}`;
      const duration = options?.duration ?? getDefaultDuration(variant);

      // If toast with same ID exists, update it
      setToasts((prev) => {
        const existingIndex = prev.findIndex((t) => t.id === id);
        const newToast: ToastItem = {
          id,
          variant,
          title,
          message,
          duration,
          createdAt: Date.now(),
          action: options?.action,
        };

        if (existingIndex >= 0) {
          // Update existing
          const updated = [...prev];
          updated[existingIndex] = newToast;
          return updated;
        }

        // Add new, limit to maxToasts
        const filtered = prev.filter((t) => !t.exiting);
        if (filtered.length >= maxToasts) {
          // Remove oldest
          const oldest = filtered[0];
          dismiss(oldest.id);
        }

        return [...prev, newToast];
      });

      // Set auto-dismiss timer
      if (duration > 0) {
        // Clear existing timer for this ID
        const existingTimer = timersRef.current.get(id);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = window.setTimeout(() => {
          dismiss(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [maxToasts, dismiss]
  );

  const toastAPI: ToastAPI = {
    success: (title, message, options) => addToast('success', title, message, options),
    info: (title, message, options) => addToast('info', title, message, options),
    warning: (title, message, options) => addToast('warning', title, message, options),
    error: (title, message, options) => addToast('error', title, message, options),
    dismiss,
    dismissAll,
  };

  return (
    <ToastContext.Provider value={{ toast: toastAPI }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ============================================
// Toast Container
// ============================================
interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer}>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ============================================
// Individual Toast
// ============================================
interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = getIcon(toast.variant);

  const handleActionClick = () => {
    toast.action?.onClick();
    onDismiss(toast.id);
  };

  return (
    <div
      className={styles.toast}
      data-variant={toast.variant}
      data-exiting={toast.exiting || undefined}
    >
      <div className={styles.toastIcon}>
        <Icon size={18} />
      </div>
      <div className={styles.toastContent}>
        <p className={styles.toastTitle}>{toast.title}</p>
        {toast.message && <p className={styles.toastMessage}>{toast.message}</p>}
        {toast.action && (
          <button className={styles.toastAction} onClick={handleActionClick}>
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        className={styles.toastClose}
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
      {toast.duration > 0 && (
        <div className={styles.toastProgress}>
          <div
            className={styles.toastProgressBar}
            style={{ animationDuration: `${toast.duration}ms` }}
          />
        </div>
      )}
    </div>
  );
}

function getIcon(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return CheckCircle;
    case 'info':
      return Info;
    case 'warning':
      return AlertTriangle;
    case 'error':
      return XCircle;
  }
}

export default ToastProvider;
