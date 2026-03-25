import { useRef, useCallback, useState } from 'react';
import { formatTime } from '../../../utils/timeUtils';
import { FRAME_DURATION } from '../constants';
import '../styles/playback-controls.css';

export type FocusedMarker = 'in' | 'out' | null;

interface PlaybackRangeMarkersProps {
  inPoint: number | null;
  outPoint: number | null;
  duration: number;
  showMilliseconds?: boolean;
  focusedMarker?: FocusedMarker;
  onMarkerFocus?: (marker: FocusedMarker) => void;
  onMarkerStep?: (marker: 'in' | 'out', direction: number) => void;
  onMarkerDragStart?: (marker: 'in' | 'out') => void;
  onMarkerDrag?: (marker: 'in' | 'out', newTime: number) => void;
  onMarkerDragEnd?: () => void;
  onSelectionDragStart?: () => void;
  onSelectionDrag?: (baseInPoint: number, baseOutPoint: number, deltaTime: number) => void;
  onSelectionDragEnd?: () => void;
  progressBarRef?: React.RefObject<HTMLDivElement>;
}

export function PlaybackRangeMarkers({
  inPoint,
  outPoint,
  duration,
  showMilliseconds = true,
  focusedMarker,
  onMarkerFocus,
  onMarkerStep,
  onMarkerDragStart,
  onMarkerDrag,
  onMarkerDragEnd,
  onSelectionDragStart,
  onSelectionDrag,
  onSelectionDragEnd,
  progressBarRef,
}: PlaybackRangeMarkersProps) {
  const oneSecondStep = Math.round(1 / FRAME_DURATION);
  const fiveSecondStep = Math.round(5 / FRAME_DURATION);
  const tenSecondStep = Math.round(10 / FRAME_DURATION);
  const dragModeRef = useRef<'in' | 'out' | 'selection' | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectionStartRangeRef = useRef<{ inPoint: number; outPoint: number } | null>(null);
  const didDragRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [hoveredMarker, setHoveredMarker] = useState<'in' | 'out' | null>(null);

  const calculateTimeFromPointerEvent = useCallback((e: PointerEvent | React.PointerEvent): number => {
    if (!progressBarRef?.current) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    return percent * duration;
  }, [progressBarRef, duration]);

  const calculateDeltaTimeFromPointerEvent = useCallback((startClientX: number, currentClientX: number): number => {
    if (!progressBarRef?.current) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return ((currentClientX - startClientX) / rect.width) * duration;
  }, [progressBarRef, duration]);

  const handleMarkerPointerDown = useCallback((marker: 'in' | 'out', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).focus();

    dragModeRef.current = marker;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    didDragRef.current = false;
    onMarkerFocus?.(marker);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (dragModeRef.current !== marker) return;
      const dragStart = dragStartRef.current;
      if (!didDragRef.current && dragStart) {
        const movedX = Math.abs(moveEvent.clientX - dragStart.x);
        const movedY = Math.abs(moveEvent.clientY - dragStart.y);
        if (movedX > 2 || movedY > 2) {
          didDragRef.current = true;
          onMarkerDragStart?.(marker);
        }
      }
      if (!didDragRef.current) return;
      const newTime = calculateTimeFromPointerEvent(moveEvent);
      onMarkerDrag?.(marker, newTime);
    };

    const handlePointerUp = () => {
      const didDrag = didDragRef.current;
      dragModeRef.current = null;
      dragStartRef.current = null;
      didDragRef.current = false;
      if (didDrag) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        onMarkerDragEnd?.();
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [onMarkerFocus, onMarkerDragStart, onMarkerDrag, onMarkerDragEnd, calculateTimeFromPointerEvent]);

  const handleMarkerBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const nextFocused = e.relatedTarget as HTMLElement | null;
    if (nextFocused?.closest('.timeline-marker')) return;
    setHoveredMarker(null);
    onMarkerFocus?.(null);
  }, [onMarkerFocus]);

  const handleMarkerKeyDown = useCallback((marker: 'in' | 'out', e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        e.stopPropagation();
        onMarkerStep?.(
          marker,
          e.altKey ? -oneSecondStep : e.shiftKey ? -tenSecondStep : -fiveSecondStep,
        );
        break;
      case 'ArrowRight':
        e.preventDefault();
        e.stopPropagation();
        onMarkerStep?.(
          marker,
          e.altKey ? oneSecondStep : e.shiftKey ? tenSecondStep : fiveSecondStep,
        );
        break;
      case ',':
        e.preventDefault();
        e.stopPropagation();
        onMarkerStep?.(marker, -1);
        break;
      case '.':
        e.preventDefault();
        e.stopPropagation();
        onMarkerStep?.(marker, 1);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onMarkerFocus?.(null);
        e.currentTarget.blur();
        break;
    }
  }, [fiveSecondStep, onMarkerFocus, onMarkerStep, oneSecondStep, tenSecondStep]);

  const handleSelectionPointerDown = useCallback((e: React.PointerEvent) => {
    if (inPoint === null || outPoint === null) return;

    e.preventDefault();
    e.stopPropagation();

    dragModeRef.current = 'selection';
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    selectionStartRangeRef.current = { inPoint, outPoint };
    didDragRef.current = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (dragModeRef.current !== 'selection') return;
      const dragStart = dragStartRef.current;
      const selectionStartRange = selectionStartRangeRef.current;
      if (!dragStart || !selectionStartRange) return;

      if (!didDragRef.current) {
        const movedX = Math.abs(moveEvent.clientX - dragStart.x);
        const movedY = Math.abs(moveEvent.clientY - dragStart.y);
        if (movedX > 2 || movedY > 2) {
          didDragRef.current = true;
          onSelectionDragStart?.();
        }
      }
      if (!didDragRef.current) return;

      const deltaTime = calculateDeltaTimeFromPointerEvent(dragStart.x, moveEvent.clientX);
      onSelectionDrag?.(selectionStartRange.inPoint, selectionStartRange.outPoint, deltaTime);
    };

    const handlePointerUp = () => {
      const didDrag = didDragRef.current;
      dragModeRef.current = null;
      dragStartRef.current = null;
      selectionStartRangeRef.current = null;
      didDragRef.current = false;
      if (didDrag) {
        onSelectionDragEnd?.();
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [
    inPoint,
    outPoint,
    onSelectionDragStart,
    calculateDeltaTimeFromPointerEvent,
    onSelectionDrag,
    onSelectionDragEnd,
  ]);

  const handleMarkerClick = useCallback((marker: 'in' | 'out', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (suppressClickRef.current) return;
    // Toggle focus on click (if already focused, stay focused for consistency)
    onMarkerFocus?.(marker);
  }, [onMarkerFocus]);

  if (duration <= 0) return null;

  const inPointPercent = inPoint !== null ? (inPoint / duration) * 100 : null;
  const outPointPercent = outPoint !== null ? (outPoint / duration) * 100 : null;

  const showInTooltip = inPoint !== null && (hoveredMarker === 'in' || focusedMarker === 'in');
  const showOutTooltip = outPoint !== null && (hoveredMarker === 'out' || focusedMarker === 'out');

  return (
    <>
      {/* IN point marker */}
      {inPointPercent !== null && (
        <div
          className={`timeline-marker in-marker ${focusedMarker === 'in' ? 'focused' : ''}`}
          style={{ left: `${inPointPercent}%` }}
          tabIndex={0}
          role="slider"
          aria-label="IN point"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={inPoint!}
          aria-valuetext={`IN ${formatTime(inPoint!, showMilliseconds)}`}
          onClick={(e) => handleMarkerClick('in', e)}
          onFocus={() => onMarkerFocus?.('in')}
          onBlur={handleMarkerBlur}
          onKeyDown={(e) => handleMarkerKeyDown('in', e)}
          onPointerDown={(e) => handleMarkerPointerDown('in', e)}
          onMouseEnter={() => setHoveredMarker('in')}
          onMouseLeave={() => setHoveredMarker(null)}
        >
          <span className="timeline-marker-bar" />
          {showInTooltip && (
            <span className="marker-tooltip in-tooltip">
              IN {formatTime(inPoint!, showMilliseconds)}
            </span>
          )}
        </div>
      )}

      {/* OUT point marker */}
      {outPointPercent !== null && (
        <div
          className={`timeline-marker out-marker ${focusedMarker === 'out' ? 'focused' : ''}`}
          style={{ left: `${outPointPercent}%` }}
          tabIndex={0}
          role="slider"
          aria-label="OUT point"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={outPoint!}
          aria-valuetext={`OUT ${formatTime(outPoint!, showMilliseconds)}`}
          onClick={(e) => handleMarkerClick('out', e)}
          onFocus={() => onMarkerFocus?.('out')}
          onBlur={handleMarkerBlur}
          onKeyDown={(e) => handleMarkerKeyDown('out', e)}
          onPointerDown={(e) => handleMarkerPointerDown('out', e)}
          onMouseEnter={() => setHoveredMarker('out')}
          onMouseLeave={() => setHoveredMarker(null)}
        >
          <span className="timeline-marker-bar" />
          {showOutTooltip && (
            <span className="marker-tooltip out-tooltip">
              OUT {formatTime(outPoint!, showMilliseconds)}
            </span>
          )}
        </div>
      )}

      {/* Selected region */}
      {inPointPercent !== null && outPointPercent !== null && (
        <div
          className="timeline-selection"
          style={{
            left: `${Math.min(inPointPercent, outPointPercent)}%`,
            width: `${Math.abs(outPointPercent - inPointPercent)}%`,
          }}
          onPointerDown={handleSelectionPointerDown}
        />
      )}
    </>
  );
}
