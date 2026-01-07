import { useState, useEffect } from 'react';
import { Settings, Sparkles, Wand2, Trash2, Clock, FileImage, Film } from 'lucide-react';
import { useStore } from '../store/useStore';
import './DetailsPanel.css';

export default function DetailsPanel() {
  const {
    scenes,
    selectedCutId,
    getAsset,
    updateCutDisplayTime,
    removeCut,
  } = useStore();

  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [localDisplayTime, setLocalDisplayTime] = useState('2.0');

  // Find the selected cut
  const selectedData = (() => {
    if (!selectedCutId) return null;

    for (const scene of scenes) {
      const cut = scene.cuts.find(c => c.id === selectedCutId);
      if (cut) {
        return { scene, cut };
      }
    }
    return null;
  })();

  const cut = selectedData?.cut;
  const scene = selectedData?.scene;
  const asset = cut?.asset || (cut?.assetId ? getAsset(cut.assetId) : undefined);

  useEffect(() => {
    if (cut) {
      setLocalDisplayTime(cut.displayTime.toFixed(1));
    }
  }, [cut?.displayTime, cut]);

  useEffect(() => {
    const loadThumbnail = async () => {
      if (asset?.thumbnail) {
        setThumbnail(asset.thumbnail);
        return;
      }

      if (asset?.path && window.electronAPI) {
        try {
          const base64 = await window.electronAPI.readFileAsBase64(asset.path);
          if (base64) {
            setThumbnail(base64);
          }
        } catch {
          // Failed to load thumbnail
        }
      } else {
        setThumbnail(null);
      }
    };

    loadThumbnail();
  }, [asset]);

  const handleDisplayTimeChange = (value: string) => {
    setLocalDisplayTime(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0 && scene && cut) {
      updateCutDisplayTime(scene.id, cut.id, numValue);
    }
  };

  const handleRemoveCut = () => {
    if (scene && cut) {
      if (confirm('Remove this cut from the timeline?')) {
        removeCut(scene.id, cut.id);
      }
    }
  };

  if (!cut || !asset) {
    return (
      <aside className="details-panel">
        <div className="details-header">
          <Settings size={18} />
          <span>DETAILS</span>
        </div>
        <div className="details-empty">
          <p>Select a cut to view details</p>
        </div>
      </aside>
    );
  }

  const isVideo = asset.type === 'video';

  return (
    <aside className="details-panel">
      <div className="details-header">
        <Settings size={18} />
        <span>DETAILS</span>
      </div>

      <div className="details-content">
        <div className="selected-info">
          <span className="selected-label">SELECTED</span>
          <span className="selected-value">{scene?.name} / Cut {(cut.order || 0) + 1}</span>
        </div>

        <div className="details-preview">
          {thumbnail ? (
            <img src={thumbnail} alt={asset.name} className="preview-image" />
          ) : (
            <div className="preview-placeholder">
              {isVideo ? <Film size={48} /> : <FileImage size={48} />}
            </div>
          )}
        </div>

        <div className="details-info">
          <div className="info-row">
            <span className="info-label">Resolution:</span>
            <span className="info-value">1920x1080</span>
          </div>
          <div className="info-row">
            <span className="info-label">Source:</span>
            <span className="info-value truncate">{asset.name}</span>
          </div>
          <div className="info-row">
            <span className="info-label">
              <Clock size={14} />
              Display Time:
            </span>
            <div className="time-input-group">
              <input
                type="number"
                value={localDisplayTime}
                onChange={(e) => handleDisplayTimeChange(e.target.value)}
                step="0.1"
                min="0.1"
                max="60"
                className="time-input"
              />
              <span className="time-unit">seconds</span>
            </div>
          </div>
        </div>

        <div className="details-actions">
          <button className="action-btn primary">
            <Sparkles size={16} />
            <span>REMIX IMAGE</span>
          </button>
          <button className="action-btn secondary">
            <Wand2 size={16} />
            <span>AI INPAINT</span>
          </button>
        </div>

        <div className="details-footer">
          <button className="delete-btn" onClick={handleRemoveCut}>
            <Trash2 size={14} />
            <span>Remove Cut</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
