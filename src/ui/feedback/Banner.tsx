/**
 * Banner - Persistent notification for ongoing states
 *
 * Usage:
 * <BannerProvider>
 *   <App />
 * </BannerProvider>
 *
 * const { banner } = useBanner();
 * banner.show({ variant: 'warning', message: 'Network offline', id: 'offline' });
 * banner.dismiss('offline');
 *
 * Use for: ongoing warnings, sync status, progress indicators
 * NOT for: one-time notifications (use Toast instead)
 */

import {
  createContext,
  useContext,
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, Info, Wifi, WifiOff, Loader2, X } from 'lucide-react';
import styles from './Banner.module.css';

// ============================================
// Types
// ============================================
export type BannerVariant = 'info' | 'warning' | 'error' | 'progress';

export interface BannerAction {
  label: string;
  onClick: () => void;
}

export interface BannerItem {
  id: string;
  variant: BannerVariant;
  message: string;
  /** Optional icon override */
  icon?: 'wifi' | 'wifi-off' | 'sync' | 'alert' | 'info';
  /** Optional action button */
  action?: BannerAction;
  /** Allow manual dismiss */
  dismissible?: boolean;
  /** Progress percentage (0-100) for progress variant */
  progress?: number;
}

export interface BannerAPI {
  show: (item: Omit<BannerItem, 'id'> & { id?: string }) => string;
  update: (id: string, updates: Partial<Omit<BannerItem, 'id'>>) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export interface BannerContextValue {
  banner: BannerAPI;
}

// ============================================
// Context
// ============================================
const BannerContext = createContext<BannerContextValue | null>(null);

// ============================================
// useBanner Hook
// ============================================
export function useBanner(): BannerContextValue {
  const context = useContext(BannerContext);
  if (!context) {
    throw new Error('useBanner must be used within a BannerProvider');
  }
  return context;
}

// ============================================
// Provider
// ============================================
export interface BannerProviderProps {
  children: ReactNode;
}

let bannerIdCounter = 0;

export function BannerProvider({ children }: BannerProviderProps) {
  const [banners, setBanners] = useState<BannerItem[]>([]);

  const show = useCallback(
    (item: Omit<BannerItem, 'id'> & { id?: string }): string => {
      const id = item.id || `banner-${++bannerIdCounter}`;

      setBanners((prev) => {
        // Replace existing banner with same ID
        const existingIndex = prev.findIndex((b) => b.id === id);
        const newBanner: BannerItem = { ...item, id };

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = newBanner;
          return updated;
        }

        return [...prev, newBanner];
      });

      return id;
    },
    []
  );

  const update = useCallback(
    (id: string, updates: Partial<Omit<BannerItem, 'id'>>) => {
      setBanners((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
      );
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setBanners([]);
  }, []);

  const bannerAPI: BannerAPI = {
    show,
    update,
    dismiss,
    dismissAll,
  };

  return (
    <BannerContext.Provider value={{ banner: bannerAPI }}>
      {children}
      <BannerContainer banners={banners} onDismiss={dismiss} />
    </BannerContext.Provider>
  );
}

// ============================================
// Banner Container
// ============================================
interface BannerContainerProps {
  banners: BannerItem[];
  onDismiss: (id: string) => void;
}

function BannerContainer({ banners, onDismiss }: BannerContainerProps) {
  if (banners.length === 0) return null;

  return (
    <div className={styles.bannerContainer}>
      {banners.map((banner) => (
        <Banner key={banner.id} banner={banner} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ============================================
// Individual Banner
// ============================================
interface BannerProps {
  banner: BannerItem;
  onDismiss: (id: string) => void;
}

function Banner({ banner, onDismiss }: BannerProps) {
  const Icon = getIcon(banner);
  const isSpinning = banner.variant === 'progress' && banner.progress === undefined;

  return (
    <div className={styles.banner} data-variant={banner.variant}>
      <div className={styles.bannerIcon} data-spinning={isSpinning || undefined}>
        <Icon size={16} />
      </div>
      <span className={styles.bannerMessage}>{banner.message}</span>

      {banner.variant === 'progress' && banner.progress !== undefined && (
        <div className={styles.bannerProgress}>
          <div
            className={styles.bannerProgressBar}
            style={{ width: `${banner.progress}%` }}
          />
        </div>
      )}

      {banner.action && (
        <button
          className={styles.bannerAction}
          onClick={banner.action.onClick}
        >
          {banner.action.label}
        </button>
      )}

      {banner.dismissible !== false && (
        <button
          className={styles.bannerClose}
          onClick={() => onDismiss(banner.id)}
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function getIcon(banner: BannerItem) {
  if (banner.icon) {
    switch (banner.icon) {
      case 'wifi':
        return Wifi;
      case 'wifi-off':
        return WifiOff;
      case 'sync':
        return Loader2;
      case 'alert':
        return AlertTriangle;
      case 'info':
        return Info;
    }
  }

  switch (banner.variant) {
    case 'info':
      return Info;
    case 'warning':
    case 'error':
      return AlertTriangle;
    case 'progress':
      return Loader2;
  }
}

export default BannerProvider;
