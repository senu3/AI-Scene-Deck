const AUTOSAVE_STORAGE_KEY = 'autosave.enabled';
const AUTOSAVE_EVENT = 'autosave-settings-changed';

export function getAutoSaveEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (raw === null) return false;
    return raw === 'true';
  } catch {
    return false;
  }
}

export function setAutoSaveEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage failures (private mode, etc.)
  }

  const event = new CustomEvent(AUTOSAVE_EVENT, { detail: { enabled } });
  window.dispatchEvent(event);
}

export function subscribeAutoSaveSettings(callback: (enabled: boolean) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
    if (typeof detail?.enabled === 'boolean') {
      callback(detail.enabled);
    } else {
      callback(getAutoSaveEnabled());
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === AUTOSAVE_STORAGE_KEY) {
      callback(getAutoSaveEnabled());
    }
  };

  window.addEventListener(AUTOSAVE_EVENT, handleCustom);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(AUTOSAVE_EVENT, handleCustom);
    window.removeEventListener('storage', handleStorage);
  };
}
