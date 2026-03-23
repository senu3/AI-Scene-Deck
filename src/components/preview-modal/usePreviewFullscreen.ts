import { useCallback, useEffect, useState } from 'react';
import type React from 'react';

export function usePreviewFullscreen(modalRef: React.RefObject<HTMLDivElement>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === modalRef.current);
    };

    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, [modalRef]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement === modalRef.current) {
      void document.exitFullscreen();
      return;
    }

    if (modalRef.current) {
      void modalRef.current.requestFullscreen();
    }
  }, [modalRef]);

  return {
    isFullscreen,
    toggleFullscreen,
  };
}
