import { Play, SkipForward, Pause, Download } from 'lucide-react';
import { useStore } from '../store/useStore';
import './PlaybackControls.css';

interface PlaybackControlsProps {
  onPreview: () => void;
  onExport: () => void;
  isExporting: boolean;
}

export default function PlaybackControls({ onPreview, onExport, isExporting }: PlaybackControlsProps) {
  const { scenes, previewMode, setPreviewMode, selectedSceneId } = useStore();

  const totalCuts = scenes.reduce((acc, scene) => acc + scene.cuts.length, 0);
  const totalDuration = scenes.reduce((acc, scene) =>
    acc + scene.cuts.reduce((cutAcc, cut) => cutAcc + cut.displayTime, 0), 0
  );

  const handlePlayAll = () => {
    setPreviewMode('all');
    onPreview();
  };

  const handlePlayScene = () => {
    if (selectedSceneId) {
      setPreviewMode('scene');
      onPreview();
    }
  };

  return (
    <div className="playback-controls">
      <div className="controls-left">
        <div className="timeline-stats">
          <span className="stat">
            <strong>{scenes.length}</strong> Scenes
          </span>
          <span className="stat-divider">·</span>
          <span className="stat">
            <strong>{totalCuts}</strong> Cuts
          </span>
          <span className="stat-divider">·</span>
          <span className="stat">
            <strong>{totalDuration.toFixed(1)}s</strong> Total
          </span>
        </div>
      </div>

      <div className="controls-center">
        <button
          className="control-btn"
          onClick={handlePlayScene}
          disabled={!selectedSceneId}
          title="Preview Selected Scene"
        >
          <SkipForward size={20} />
        </button>
        <button
          className="control-btn primary"
          onClick={handlePlayAll}
          disabled={totalCuts === 0}
          title="Preview All"
        >
          {previewMode === 'all' ? <Play size={24} /> : <Play size={24} />}
        </button>
        <button
          className="control-btn"
          disabled
          title="Pause"
        >
          <Pause size={20} />
        </button>
      </div>

      <div className="controls-right">
        <button
          className="export-btn"
          onClick={onExport}
          disabled={isExporting || totalCuts === 0}
        >
          <Download size={16} />
          <span>{isExporting ? 'EXPORTING...' : 'EXPORT VIDEO'}</span>
        </button>
      </div>
    </div>
  );
}
