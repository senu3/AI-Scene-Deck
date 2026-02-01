import { Play, Download, LayoutGrid, Film, Clock } from 'lucide-react';
import { useTimelinePosition, formatTimeCode } from '../hooks/useTimelinePosition';
import './PlaybackControls.css';

interface PlaybackControlsProps {
  onPreview: () => void;
  onExport: () => void;
  isExporting: boolean;
  /** Export progress (0-100), only shown when isExporting is true */
  exportProgress?: number;
}

export default function PlaybackControls({
  onPreview,
  onExport,
  isExporting,
  exportProgress,
}: PlaybackControlsProps) {
  const { sceneCount, cutCount, currentPosition, totalDuration, hasSelection } = useTimelinePosition();

  const canPreview = cutCount > 0;
  const canExport = cutCount > 0 && !isExporting;

  // Format the timecode display
  const currentTimeDisplay = hasSelection ? formatTimeCode(currentPosition) : '--';
  const totalTimeDisplay = formatTimeCode(totalDuration);

  return (
    <footer className="playback-controls">
      <div className="footer-stats">
        <div className="stat-item">
          <LayoutGrid size={14} />
          <span className="stat-value">{sceneCount}</span>
          <span className="stat-label">scenes</span>
        </div>
        <div className="stat-item">
          <Film size={14} />
          <span className="stat-value">{cutCount}</span>
          <span className="stat-label">cuts</span>
        </div>
        <div className="stat-item time">
          <Clock size={14} />
          <span className="time-current">{currentTimeDisplay}</span>
          <span className="time-separator">/</span>
          <span className="time-total">{totalTimeDisplay}</span>
        </div>
      </div>

      <div className="footer-actions">
        <button
          className="footer-btn preview-btn"
          onClick={onPreview}
          disabled={!canPreview}
          title="Preview All (Space)"
        >
          <Play size={14} fill="currentColor" />
          <span>PREVIEW</span>
        </button>
        <button
          className={`footer-btn export-btn ${isExporting ? 'exporting' : ''}`}
          onClick={onExport}
          disabled={!canExport}
          title="Export Video"
          style={isExporting && exportProgress !== undefined ? { '--progress': `${exportProgress}%` } as React.CSSProperties : undefined}
        >
          <Download size={14} />
          <span>{isExporting ? `EXPORTING...${exportProgress !== undefined ? ` ${Math.round(exportProgress)}%` : ''}` : 'EXPORT'}</span>
        </button>
      </div>
    </footer>
  );
}
