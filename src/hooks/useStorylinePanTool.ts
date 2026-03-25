import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface StorylinePanBind {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPointerDownCapture: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export interface StorylinePanToolState {
  isSpaceHeld: boolean;
  isPanModeReady: boolean;
  isPanning: boolean;
  bind: StorylinePanBind;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function isShortcutBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (isEditableTarget(target)) return true;
  return !!target.closest(
    '.preview-modal, [role="dialog"], [aria-modal="true"], button, a[href], [role="button"], [role="menuitem"]'
  );
}

function isTargetInsideContainer(
  target: EventTarget | null,
  container: HTMLDivElement | null
): boolean {
  return !!container && target instanceof Node && container.contains(target);
}

export function useStorylinePanTool(
  containerRef: React.RefObject<HTMLDivElement>
): StorylinePanToolState {
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const hoveredRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const startClientXRef = useRef(0);
  const startScrollLeftRef = useRef(0);

  const setHovered = useCallback((nextHovered: boolean) => {
    hoveredRef.current = nextHovered;
    setIsHovered(nextHovered);
  }, []);

  const finishPanning = useCallback(() => {
    const container = containerRef.current;
    const pointerId = activePointerIdRef.current;

    if (
      container &&
      pointerId !== null &&
      typeof container.hasPointerCapture === 'function' &&
      typeof container.releasePointerCapture === 'function' &&
      container.hasPointerCapture(pointerId)
    ) {
      container.releasePointerCapture(pointerId);
    }

    activePointerIdRef.current = null;
    setIsPanning(false);
  }, [containerRef]);

  const releasePanScope = useCallback(() => {
    hoveredRef.current = false;
    setIsHovered(false);
    setIsSpaceHeld(false);
    finishPanning();
  }, [finishPanning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (isShortcutBlockedTarget(e.target)) {
        setIsSpaceHeld(false);
        finishPanning();
        return;
      }
      if (!hoveredRef.current) return;
      e.preventDefault();
      setIsSpaceHeld(true);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (hoveredRef.current && !isShortcutBlockedTarget(e.target)) {
        e.preventDefault();
      }
      setIsSpaceHeld(false);
    };

    const handlePointerDownCapture = (e: PointerEvent) => {
      if (isTargetInsideContainer(e.target, containerRef.current)) return;
      releasePanScope();
    };

    const handleFocusInCapture = (e: FocusEvent) => {
      if (isTargetInsideContainer(e.target, containerRef.current)) return;
      releasePanScope();
    };

    const handleWindowBlur = () => {
      releasePanScope();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('pointerdown', handlePointerDownCapture, true);
    document.addEventListener('focusin', handleFocusInCapture, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('pointerdown', handlePointerDownCapture, true);
      document.removeEventListener('focusin', handleFocusInCapture, true);
    };
  }, [containerRef, finishPanning, releasePanScope]);

  useEffect(() => {
    if (!isSpaceHeld) {
      finishPanning();
    }
  }, [isSpaceHeld, finishPanning]);

  const isPanModeReady = isHovered && isSpaceHeld;

  const onPointerDownCapture = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanModeReady) return;
    if (e.button !== 0) return;
    const container = containerRef.current;
    if (!container) return;

    activePointerIdRef.current = e.pointerId;
    startClientXRef.current = e.clientX;
    startScrollLeftRef.current = container.scrollLeft;
    setIsPanning(true);

    if (typeof container.setPointerCapture === 'function') {
      container.setPointerCapture(e.pointerId);
    }

    e.preventDefault();
    e.stopPropagation();
  }, [containerRef, isPanModeReady]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    if (activePointerIdRef.current !== e.pointerId) return;
    const container = containerRef.current;
    if (!container) return;

    const dx = e.clientX - startClientXRef.current;
    container.scrollLeft = startScrollLeftRef.current - dx;
    e.preventDefault();
  }, [containerRef, isPanning]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    finishPanning();
  }, [finishPanning]);

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    finishPanning();
  }, [finishPanning]);

  const bind = useMemo<StorylinePanBind>(() => ({
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onPointerDownCapture,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  }), [onPointerCancel, onPointerDownCapture, onPointerMove, onPointerUp, setHovered]);

  return {
    isSpaceHeld,
    isPanModeReady,
    isPanning,
    bind,
  };
}
