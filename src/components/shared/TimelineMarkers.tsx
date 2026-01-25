import { useRef, useCallback } from 'react';
import { formatTime } from '../../utils/timeUtils';
import './timeline-common.css';

export type FocusedMarker = 'in' | 'out' | null;

interface TimelineMarkersProps {
  inPoint: number | null;
  outPoint: number | null;
  duration: number;
  showMilliseconds?: boolean;
  focusedMarker?: FocusedMarker;
  onMarkerFocus?: (marker: FocusedMarker) => void;
  onMarkerDrag?: (marker: 'in' | 'out', newTime: number) => void;
  onMarkerDragEnd?: () => void;
  progressBarRef?: React.RefObject<HTMLDivElement>;
}

export function TimelineMarkers({
  inPoint,
  outPoint,
  duration,
  showMilliseconds = true,
  focusedMarker,
  onMarkerFocus,
  onMarkerDrag,
  onMarkerDragEnd,
  progressBarRef,
}: TimelineMarkersProps) {
  const draggingMarkerRef = useRef<'in' | 'out' | null>(null);

  const calculateTimeFromMouseEvent = useCallback((e: MouseEvent | React.MouseEvent): number => {
    if (!progressBarRef?.current) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    return percent * duration;
  }, [progressBarRef, duration]);

  const handleMarkerMouseDown = useCallback((marker: 'in' | 'out', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    draggingMarkerRef.current = marker;
    onMarkerFocus?.(marker);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!draggingMarkerRef.current) return;
      const newTime = calculateTimeFromMouseEvent(moveEvent);
      onMarkerDrag?.(draggingMarkerRef.current, newTime);
    };

    const handleMouseUp = () => {
      draggingMarkerRef.current = null;
      onMarkerDragEnd?.();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onMarkerFocus, onMarkerDrag, onMarkerDragEnd, calculateTimeFromMouseEvent]);

  const handleMarkerClick = useCallback((marker: 'in' | 'out', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Toggle focus on click (if already focused, stay focused for consistency)
    onMarkerFocus?.(marker);
  }, [onMarkerFocus]);

  if (duration <= 0) return null;

  const inPointPercent = inPoint !== null ? (inPoint / duration) * 100 : null;
  const outPointPercent = outPoint !== null ? (outPoint / duration) * 100 : null;

  return (
    <>
      {/* IN point marker */}
      {inPointPercent !== null && (
        <div
          className={`timeline-marker in-marker ${focusedMarker === 'in' ? 'focused' : ''}`}
          style={{ left: `${inPointPercent}%` }}
          title={`IN: ${formatTime(inPoint!, showMilliseconds)}`}
          onClick={(e) => handleMarkerClick('in', e)}
          onMouseDown={(e) => handleMarkerMouseDown('in', e)}
        />
      )}

      {/* OUT point marker */}
      {outPointPercent !== null && (
        <div
          className={`timeline-marker out-marker ${focusedMarker === 'out' ? 'focused' : ''}`}
          style={{ left: `${outPointPercent}%` }}
          title={`OUT: ${formatTime(outPoint!, showMilliseconds)}`}
          onClick={(e) => handleMarkerClick('out', e)}
          onMouseDown={(e) => handleMarkerMouseDown('out', e)}
        />
      )}

      {/* Selected region */}
      {inPointPercent !== null && outPointPercent !== null && (
        <div
          className="timeline-selection"
          style={{
            left: `${Math.min(inPointPercent, outPointPercent)}%`,
            width: `${Math.abs(outPointPercent - inPointPercent)}%`,
          }}
        />
      )}
    </>
  );
}
