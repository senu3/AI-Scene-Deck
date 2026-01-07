import { useState, useEffect } from 'react';
import {
  Settings,
  Sparkles,
  Wand2,
  Trash2,
  Clock,
  FileImage,
  Film,
  Plus,
  StickyNote,
  X,
  Layers,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import type { ImageMetadata } from '../types';
import './DetailsPanel.css';

export default function DetailsPanel() {
  const {
    scenes,
    selectedSceneId,
    selectedCutId,
    selectionType,
    getAsset,
    updateCutDisplayTime,
    removeCut,
    trashPath,
    addSceneNote,
    updateSceneNote,
    removeSceneNote,
  } = useStore();

  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [localDisplayTime, setLocalDisplayTime] = useState('2.0');
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [noteText, setNoteText] = useState('');

  // Find selected scene
  const selectedScene = selectedSceneId
    ? scenes.find((s) => s.id === selectedSceneId)
    : null;

  // Find selected cut
  const selectedCutData = (() => {
    if (!selectedCutId) return null;

    for (const scene of scenes) {
      const cut = scene.cuts.find((c) => c.id === selectedCutId);
      if (cut) {
        return { scene, cut };
      }
    }
    return null;
  })();

  const cut = selectedCutData?.cut;
  const cutScene = selectedCutData?.scene;
  const asset = cut?.asset || (cut?.assetId ? getAsset(cut.assetId) : undefined);

  // Load cut display time
  useEffect(() => {
    if (cut) {
      setLocalDisplayTime(cut.displayTime.toFixed(1));
    }
  }, [cut?.displayTime, cut]);

  // Load thumbnail and metadata
  useEffect(() => {
    const loadAssetData = async () => {
      setThumbnail(null);
      setMetadata(null);

      if (!asset?.path) return;

      // Load thumbnail
      if (asset.thumbnail) {
        setThumbnail(asset.thumbnail);
      } else if (window.electronAPI) {
        try {
          const base64 = await window.electronAPI.readFileAsBase64(asset.path);
          if (base64) {
            setThumbnail(base64);
          }
        } catch {
          // Failed to load
        }
      }

      // Load metadata
      if (window.electronAPI) {
        try {
          const meta = await window.electronAPI.readImageMetadata(asset.path);
          if (meta) {
            setMetadata(meta);
          }
        } catch {
          // Failed to load
        }
      }
    };

    loadAssetData();
  }, [asset?.path, asset?.thumbnail]);

  const handleDisplayTimeChange = (value: string) => {
    setLocalDisplayTime(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0 && cutScene && cut) {
      updateCutDisplayTime(cutScene.id, cut.id, numValue);
    }
  };

  const handleRemoveCut = async () => {
    if (cutScene && cut) {
      if (confirm('Remove this cut from the timeline?')) {
        const removedCut = removeCut(cutScene.id, cut.id);

        // Move to trash
        if (removedCut?.asset?.path && trashPath && window.electronAPI) {
          await window.electronAPI.moveToTrash(removedCut.asset.path, trashPath);
        }
      }
    }
  };

  const handleAddNote = () => {
    if (selectedScene && noteText.trim()) {
      addSceneNote(selectedScene.id, {
        type: 'text',
        content: noteText.trim(),
      });
      setNoteText('');
    }
  };

  const handleDeleteNote = (noteId: string) => {
    if (selectedScene) {
      removeSceneNote(selectedScene.id, noteId);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Show scene details
  if (selectionType === 'scene' && selectedScene) {
    return (
      <aside className="details-panel">
        <div className="details-header">
          <Settings size={18} />
          <span>DETAILS</span>
        </div>

        <div className="details-content">
          <div className="selected-info">
            <span className="selected-label">SELECTED SCENE</span>
            <span className="selected-value">{selectedScene.name}</span>
          </div>

          <div className="scene-stats">
            <div className="stat-item">
              <Layers size={16} />
              <span>{selectedScene.cuts.length} cuts</span>
            </div>
            <div className="stat-item">
              <Clock size={16} />
              <span>
                {selectedScene.cuts
                  .reduce((acc, c) => acc + c.displayTime, 0)
                  .toFixed(1)}
                s total
              </span>
            </div>
          </div>

          <div className="scene-notes-section">
            <div className="notes-header">
              <StickyNote size={16} />
              <span>Notes</span>
            </div>

            <div className="notes-input">
              <textarea
                placeholder="Add a note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
              />
              <button
                className="add-note-btn"
                onClick={handleAddNote}
                disabled={!noteText.trim()}
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="notes-list">
              {selectedScene.notes.map((note) => (
                <div key={note.id} className="note-item">
                  <p>{note.content}</p>
                  <button
                    className="delete-note-btn"
                    onClick={() => handleDeleteNote(note.id)}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {selectedScene.notes.length === 0 && (
                <p className="no-notes">No notes yet</p>
              )}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // Show cut details
  if (selectionType === 'cut' && cut && asset) {
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
            <span className="selected-value">
              {cutScene?.name} / Cut {(cut.order || 0) + 1}
            </span>
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
              <span className="info-value">
                {metadata?.width && metadata?.height
                  ? `${metadata.width}x${metadata.height}`
                  : 'Unknown'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Size:</span>
              <span className="info-value">
                {formatFileSize(metadata?.fileSize || asset.fileSize)}
              </span>
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

          {metadata?.prompt && (
            <div className="metadata-section">
              <div className="metadata-header">Prompt</div>
              <div className="metadata-content prompt-text">
                {metadata.prompt}
              </div>
              {metadata.negativePrompt && (
                <>
                  <div className="metadata-header negative">Negative Prompt</div>
                  <div className="metadata-content prompt-text negative">
                    {metadata.negativePrompt}
                  </div>
                </>
              )}
              {(metadata.model || metadata.seed) && (
                <div className="metadata-params">
                  {metadata.model && <span>Model: {metadata.model}</span>}
                  {metadata.seed && <span>Seed: {metadata.seed}</span>}
                  {metadata.steps && <span>Steps: {metadata.steps}</span>}
                  {metadata.cfg && <span>CFG: {metadata.cfg}</span>}
                </div>
              )}
            </div>
          )}

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

  // Default empty state
  return (
    <aside className="details-panel">
      <div className="details-header">
        <Settings size={18} />
        <span>DETAILS</span>
      </div>
      <div className="details-empty">
        <p>Select a scene or cut to view details</p>
      </div>
    </aside>
  );
}
