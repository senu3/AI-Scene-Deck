import { formatTime } from '../../utils/timeUtils';
import './timeline-common.css';

interface TimelineMarkersProps {
  inPoint: number | null;
  outPoint: number | null;
  duration: number;
  showMilliseconds?: boolean;
}

export function TimelineMarkers({
  inPoint,
  outPoint,
  duration,
  showMilliseconds = true,
}: TimelineMarkersProps) {
  if (duration <= 0) return null;

  const inPointPercent = inPoint !== null ? (inPoint / duration) * 100 : null;
  const outPointPercent = outPoint !== null ? (outPoint / duration) * 100 : null;

  return (
    <>
      {/* IN point marker */}
      {inPointPercent !== null && (
        <div
          className="timeline-marker in-marker"
          style={{ left: `${inPointPercent}%` }}
          title={`IN: ${formatTime(inPoint!, showMilliseconds)}`}
        />
      )}

      {/* OUT point marker */}
      {outPointPercent !== null && (
        <div
          className="timeline-marker out-marker"
          style={{ left: `${outPointPercent}%` }}
          title={`OUT: ${formatTime(outPoint!, showMilliseconds)}`}
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
