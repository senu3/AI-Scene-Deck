import { useState, useEffect } from "react";
import {
  Settings,
  Mic,
  Link,
  Music,
  Trash2,
  Clock,
  FileImage,
  Film,
  Plus,
  Minus,
  StickyNote,
  X,
  Layers,
  Play,
  Scissors,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { useHistoryStore } from "../store/historyStore";
import {
  UpdateDisplayTimeCommand,
  RemoveCutCommand,
  BatchUpdateDisplayTimeCommand,
  UpdateClipPointsCommand,
  ClearClipPointsCommand,
  AddCutCommand,
} from "../store/commands";
import { generateVideoThumbnail } from "../utils/videoUtils";
// Note: getAudioDuration was removed - duration comes from asset.duration after import
import PreviewModal from "./PreviewModal";
import LipSyncModal from "./LipSyncModal";
import type { ImageMetadata, Asset } from "../types";
import { v4 as uuidv4 } from "uuid";
import "./DetailsPanel.css";

export default function DetailsPanel() {
  const {
    scenes,
    selectedSceneId,
    selectedCutId,
    selectedCutIds,
    selectionType,
    getAsset,
    addSceneNote,
    removeSceneNote,
    getSelectedCuts,
    cacheAsset,
    updateCutAsset,
    vaultPath,
    metadataStore,
    attachAudioToAsset,
    detachAudioFromAsset,
    getAttachedAudio,
    updateAudioOffset,
    relinkCutAsset,
  } = useStore();

  const { executeCommand } = useHistoryStore();

  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [localDisplayTime, setLocalDisplayTime] = useState("2.0");
  const [batchDisplayTime, setBatchDisplayTime] = useState("2.0");
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [noteText, setNoteText] = useState("");
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [showLipSyncModal, setShowLipSyncModal] = useState(false);

  // Attached audio state
  const [attachedAudio, setAttachedAudio] = useState<Asset | undefined>(undefined);
  const [attachedAudioDuration, setAttachedAudioDuration] = useState<number | null>(null);
  const [audioOffset, setAudioOffset] = useState("0.0");

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
  const asset =
    cut?.asset || (cut?.assetId ? getAsset(cut.assetId) : undefined);

  // Check for multi-selection
  const isMultiSelection = selectedCutIds.size > 1;
  const selectedCuts = isMultiSelection ? getSelectedCuts() : [];

  // Load cut display time
  useEffect(() => {
    if (cut) {
      setLocalDisplayTime(cut.displayTime.toFixed(1));
    }
  }, [cut?.displayTime, cut]);

  // Load attached audio info
  useEffect(() => {
    const loadAttachedAudio = async () => {
      setAttachedAudio(undefined);
      setAttachedAudioDuration(null);

      if (!asset?.id) return;

      const audio = getAttachedAudio(asset.id);
      setAttachedAudio(audio);

      // Load offset from metadata
      const meta = metadataStore?.metadata[asset.id];
      setAudioOffset((meta?.attachedAudioOffset ?? 0).toFixed(1));

      // Use duration from asset (set during import)
      setAttachedAudioDuration(audio?.duration ?? null);
    };

    loadAttachedAudio();
  }, [asset?.id, metadataStore, getAttachedAudio]);

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

      // Load metadata - use asset.metadata if available (for videos)
      if (asset.metadata) {
        setMetadata(asset.metadata);
      } else if (window.electronAPI && asset.type === "image") {
        // Only call readImageMetadata for images without existing metadata
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
  }, [asset?.path, asset?.thumbnail, asset?.metadata, asset?.type]);

  const handleDisplayTimeChange = (value: string) => {
    setLocalDisplayTime(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0 && cutScene && cut) {
      executeCommand(
        new UpdateDisplayTimeCommand(cutScene.id, cut.id, numValue),
      ).catch((error) => {
        console.error("Failed to update display time:", error);
      });
    }
  };

  const handleAddNote = () => {
    if (selectedScene && noteText.trim()) {
      addSceneNote(selectedScene.id, {
        type: "text",
        content: noteText.trim(),
      });
      setNoteText("");
    }
  };

  const handleDeleteNote = (noteId: string) => {
    if (selectedScene) {
      removeSceneNote(selectedScene.id, noteId);
    }
  };

  // Batch operations for multi-select
  const handleBatchDisplayTimeChange = (value: string) => {
    setBatchDisplayTime(value);
  };

  const handleApplyBatchDisplayTime = () => {
    const numValue = parseFloat(batchDisplayTime);
    if (isNaN(numValue) || numValue <= 0) return;

    const updates = selectedCuts.map(({ scene, cut: c }) => ({
      sceneId: scene.id,
      cutId: c.id,
      newTime: numValue,
    }));

    if (updates.length > 0) {
      executeCommand(new BatchUpdateDisplayTimeCommand(updates)).catch(
        (error) => {
          console.error("Failed to batch update display time:", error);
        },
      );
    }
  };

  const handleBatchDelete = () => {
    // Delete all selected cuts
    for (const { scene, cut: c } of selectedCuts) {
      executeCommand(new RemoveCutCommand(scene.id, c.id)).catch((error) => {
        console.error("Failed to remove cut:", error);
      });
    }
  };

  const handleSaveClip = async (inPoint: number, outPoint: number) => {
    if (cutScene && cut && asset) {
      // Update existing cut with clip points
      await executeCommand(
        new UpdateClipPointsCommand(cutScene.id, cut.id, inPoint, outPoint),
      );

      // Regenerate thumbnail at IN point
      if (asset.path && asset.type === "video") {
        const newThumbnail = await generateVideoThumbnail(asset.path, inPoint);
        if (newThumbnail) {
          // Update both the cut's asset and the cache
          updateCutAsset(cutScene.id, cut.id, { thumbnail: newThumbnail });
          cacheAsset({ ...asset, thumbnail: newThumbnail });
          setThumbnail(newThumbnail);
        }
      }
    }
  };

  const handleClearClip = async () => {
    if (cutScene && cut && asset) {
      await executeCommand(new ClearClipPointsCommand(cutScene.id, cut.id));

      // Regenerate thumbnail at time 0
      if (asset.path && asset.type === "video") {
        const newThumbnail = await generateVideoThumbnail(asset.path, 0);
        if (newThumbnail) {
          // Update both the cut's asset and the cache
          updateCutAsset(cutScene.id, cut.id, { thumbnail: newThumbnail });
          cacheAsset({ ...asset, thumbnail: newThumbnail });
          setThumbnail(newThumbnail);
        }
      }
    }
  };

  // Attach audio handler
  // TODO: 音声紐づけ後にPreviewModalを開くとクラッシュする問題あり（原因調査中）
  const handleAttachAudio = async () => {
    if (!asset || !vaultPath || !window.electronAPI) return;

    let filePath: string | null = null;
    try {
      filePath = await window.electronAPI.showOpenFileDialog({
        title: 'Attach Audio File',
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] }],
      });
    } catch (error) {
      console.error('Failed to open file dialog:', error);
      return;
    }

    if (!filePath) return;

    try {
      const audioAssetId = uuidv4();

      // Import to vault
      const importResult = await window.electronAPI.importAssetToVault(
        filePath,
        vaultPath,
        audioAssetId
      );

      if (!importResult.success) {
        alert(`Failed to import audio: ${importResult.error}`);
        return;
      }

      // Get file info (with null check)
      const audioPath = importResult.vaultPath;
      if (!audioPath) {
        alert('Failed to get audio path after import');
        return;
      }

      const fileInfo = await window.electronAPI.getFileInfo(audioPath);

      // Note: Duration is not fetched here to avoid mixing HTMLAudioElement with Web Audio API
      // Duration will be available from AudioManager.getDuration() after load

      // Create audio asset
      const audioAsset: Asset = {
        id: audioAssetId,
        name: fileInfo?.name || filePath.split(/[/\\]/).pop() || 'audio',
        path: audioPath,
        type: 'audio',
        vaultRelativePath: importResult.relativePath,
        hash: importResult.hash,
        fileSize: fileInfo?.size,
      };

      // Attach to asset
      attachAudioToAsset(asset.id, audioAsset);
    } catch (error) {
      console.error('Failed to attach audio:', error);
      alert(`Failed to attach audio: ${error}`);
    }
  };

  // Detach audio handler
  const handleDetachAudio = () => {
    if (!asset) return;
    detachAudioFromAsset(asset.id);
  };

  // Relink file handler
  const handleRelinkFile = async () => {
    if (!cutScene || !cut || !vaultPath || !window.electronAPI) return;

    const filePath = await window.electronAPI.showOpenFileDialog({
      title: 'Select New File',
      filters: [{ name: 'Media', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi', 'mkv'] }],
    });

    if (!filePath) return;

    try {
      const newAssetId = uuidv4();

      // Import to vault
      const importResult = await window.electronAPI.importAssetToVault(
        filePath,
        vaultPath,
        newAssetId
      );

      if (!importResult.success) {
        alert(`Failed to import file: ${importResult.error}`);
        return;
      }

      // Get file info
      const fileInfo = await window.electronAPI.getFileInfo(importResult.vaultPath!);
      const ext = fileInfo?.extension?.toLowerCase() || '';
      const isVideo = ['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext);

      // Create new asset
      const newAsset: Asset = {
        id: newAssetId,
        name: fileInfo?.name || 'asset',
        path: importResult.vaultPath!,
        type: isVideo ? 'video' : 'image',
        vaultRelativePath: importResult.relativePath,
        hash: importResult.hash,
        fileSize: fileInfo?.size,
      };

      // Load thumbnail for images or generate for videos
      if (isVideo) {
        const thumbnail = await generateVideoThumbnail(importResult.vaultPath!);
        if (thumbnail) {
          newAsset.thumbnail = thumbnail;
        }
      } else if (window.electronAPI) {
        const thumbnail = await window.electronAPI.readFileAsBase64(importResult.vaultPath!);
        if (thumbnail) {
          newAsset.thumbnail = thumbnail;
        }
      }

      // Relink cut to new asset
      relinkCutAsset(cutScene.id, cut.id, newAsset);
    } catch (error) {
      console.error('Failed to relink file:', error);
      alert(`Failed to relink file: ${error}`);
    }
  };

  // Audio offset handlers
  const handleAudioOffsetChange = (value: string) => {
    setAudioOffset(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && asset) {
      updateAudioOffset(asset.id, numValue);
    }
  };

  const handleAudioOffsetStep = (delta: number) => {
    const currentOffset = parseFloat(audioOffset) || 0;
    const newOffset = (currentOffset + delta).toFixed(1);
    handleAudioOffsetChange(newOffset);
  };

  const handleFrameCapture = async (timestamp: number) => {
    if (!cutScene || !asset?.path || !vaultPath) {
      alert("Cannot capture frame: missing required data");
      return;
    }

    if (
      !window.electronAPI?.extractVideoFrame ||
      !window.electronAPI?.ensureAssetsFolder
    ) {
      alert("Frame capture requires app restart after update.");
      return;
    }

    try {
      // Ensure assets folder exists
      const assetsFolder =
        await window.electronAPI.ensureAssetsFolder(vaultPath);
      if (!assetsFolder) {
        alert("Failed to access assets folder");
        return;
      }

      // Generate unique filename: {video_name}_frame_{timestamp}_{uuid}.png
      const baseName = asset.name.replace(/\.[^/.]+$/, "");
      const timeStr = timestamp.toFixed(2).replace(".", "_");
      const uniqueId = uuidv4().substring(0, 8);
      const frameFileName = `${baseName}_frame_${timeStr}_${uniqueId}.png`;
      const outputPath = `${assetsFolder}/${frameFileName}`.replace(/\\/g, "/");

      // Extract frame using ffmpeg
      const result = await window.electronAPI.extractVideoFrame({
        sourcePath: asset.path,
        outputPath,
        timestamp,
      });

      if (!result.success) {
        alert(`Failed to capture frame: ${result.error}`);
        return;
      }

      // Read the captured image as base64 for thumbnail
      const thumbnailBase64 =
        await window.electronAPI.readFileAsBase64(outputPath);

      // Create new asset for the captured frame
      const newAssetId = uuidv4();
      const newAsset: Asset = {
        id: newAssetId,
        name: frameFileName,
        path: outputPath,
        type: "image",
        thumbnail: thumbnailBase64 || undefined,
        vaultRelativePath: `assets/${frameFileName}`,
      };

      // Cache the new asset
      cacheAsset(newAsset);

      // Add new cut with the captured frame
      await executeCommand(new AddCutCommand(cutScene.id, newAsset));

      // Show success message
      alert(`Frame captured!\n\nFile: ${frameFileName}`);
    } catch (error) {
      console.error("Frame capture failed:", error);
      alert(`Failed to capture frame: ${error}`);
    }
  };

  const formatClipTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Show multi-selection details
  if (isMultiSelection && selectionType === "cut") {
    const totalDuration = selectedCuts.reduce(
      (acc, { cut: c }) => acc + c.displayTime,
      0,
    );
    const sceneGroups = new Map<string, number>();
    selectedCuts.forEach(({ scene }) => {
      sceneGroups.set(scene.name, (sceneGroups.get(scene.name) || 0) + 1);
    });

    return (
      <aside className="details-panel">
        <div className="details-header">
          <Settings size={18} />
          <span>DETAILS</span>
        </div>

        <div className="details-content">
          <div className="selected-info multi-select">
            <span className="selected-label">MULTI-SELECT</span>
            <span className="selected-value">
              {selectedCutIds.size} cuts selected
            </span>
          </div>

          <div className="multi-select-stats">
            <div className="stat-item">
              <Clock size={16} />
              <span>{totalDuration.toFixed(1)}s total</span>
            </div>
            <div className="stat-item">
              <Layers size={16} />
              <span>
                {sceneGroups.size} scene{sceneGroups.size > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="multi-select-breakdown">
            <span className="breakdown-label">By Scene:</span>
            {Array.from(sceneGroups.entries()).map(([sceneName, count]) => (
              <div key={sceneName} className="breakdown-item">
                <span>{sceneName}</span>
                <span className="count">
                  {count} cut{count > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>

          <div className="multi-select-batch-actions">
            <div className="batch-action-section">
              <span className="batch-label">
                <Clock size={14} />
                Set Display Time:
              </span>
              <div className="batch-time-input-group">
                <input
                  type="number"
                  value={batchDisplayTime}
                  onChange={(e) => handleBatchDisplayTimeChange(e.target.value)}
                  step="0.1"
                  min="0.1"
                  max="60"
                  className="time-input"
                />
                <span className="time-unit">s</span>
                <button
                  className="apply-btn"
                  onClick={handleApplyBatchDisplayTime}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          <div className="multi-select-actions">
            <p className="hint">
              Ctrl/Cmd+C to copy, Ctrl/Cmd+V to paste, Delete to remove
            </p>
            <button className="delete-btn batch" onClick={handleBatchDelete}>
              <Trash2 size={14} />
              <span>Delete Selected ({selectedCutIds.size})</span>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // === DEMO: Show lip sync cut details ===
  if (selectionType === "cut" && selectedCutId === "demo-lipsync-1") {
    return (
      <aside className="details-panel">
        <div className="details-header">
          <Settings size={18} />
          <span>DETAILS</span>
        </div>

        <div className="details-content">
          <div className="selected-info lipsync-info">
            <span className="selected-label">LIP SYNC CUT</span>
            <span className="selected-value">Demo Lip Sync</span>
          </div>

          {/* Lip Sync Preview - shows base frame */}
          <div className="details-preview lipsync-preview">
            <div className="lipsync-preview-placeholder">
              <Mic size={48} />
              <span>4 Frames Registered</span>
            </div>
          </div>

          {/* Lip Sync Frame Grid */}
          <div className="lipsync-frames-info">
            <div className="lipsync-frames-header">
              <Mic size={14} />
              <span>Registered Frames</span>
            </div>
            <div className="lipsync-frames-grid">
              <div className="lipsync-frame-item">
                <div className="frame-thumb placeholder"></div>
                <span>Closed</span>
              </div>
              <div className="lipsync-frame-item">
                <div className="frame-thumb placeholder"></div>
                <span>Half 1</span>
              </div>
              <div className="lipsync-frame-item">
                <div className="frame-thumb placeholder"></div>
                <span>Half 2</span>
              </div>
              <div className="lipsync-frame-item">
                <div className="frame-thumb placeholder"></div>
                <span>Open</span>
              </div>
            </div>
          </div>

          {/* Thresholds Info */}
          <div className="lipsync-thresholds-info">
            <div className="threshold-row">
              <span className="threshold-label">T1 (Half1)</span>
              <span className="threshold-value">0.05</span>
            </div>
            <div className="threshold-row">
              <span className="threshold-label">T2 (Half2)</span>
              <span className="threshold-value">0.15</span>
            </div>
            <div className="threshold-row">
              <span className="threshold-label">T3 (Open)</span>
              <span className="threshold-value">0.30</span>
            </div>
          </div>

          <div className="details-info">
            <div className="info-row">
              <span className="info-label">
                <Clock size={14} />
                Display Time:
              </span>
              <div className="time-input-group">
                <input
                  type="number"
                  defaultValue="3.0"
                  step="0.1"
                  min="0.1"
                  max="60"
                  className="time-input"
                  readOnly
                />
                <span className="time-unit">seconds</span>
              </div>
            </div>
          </div>

          <div className="details-actions">
            <button className="action-btn primary">
              <Mic size={16} />
              <span>EDIT LIP SYNC</span>
            </button>
          </div>

          <div className="details-footer">
            <button className="delete-btn">
              <Trash2 size={14} />
              <span>Remove Cut</span>
            </button>
          </div>
        </div>
      </aside>
    );
  }
  // === END DEMO ===

  // Show scene details
  if (selectionType === "scene" && selectedScene) {
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
              {selectedScene.notes?.map((note) => (
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
              {(!selectedScene.notes || selectedScene.notes.length === 0) && (
                <p className="no-notes">No notes yet</p>
              )}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // Show cut details
  if (selectionType === "cut" && cut && asset) {
    const isVideo = asset.type === "video";

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

          <div
            className="details-preview clickable"
            onClick={() => setShowVideoPreview(true)}
            title="Click to preview"
          >
            {thumbnail ? (
              <>
                <img
                  src={thumbnail}
                  alt={asset.name}
                  className="preview-image"
                />
                {isVideo && (
                  <div className="preview-play-overlay">
                    <Play size={32} />
                  </div>
                )}
              </>
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
                  ? `${metadata.width}×${metadata.height}`
                  : "Unknown"}
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

          {/* Clip Info Section (for video clips) */}
          {isVideo &&
            cut?.isClip &&
            cut.inPoint !== undefined &&
            cut.outPoint !== undefined && (
              <div className="clip-info-section">
                <div className="clip-info-header">
                  <Scissors size={14} />
                  <span>Video Clip</span>
                </div>
                <div className="clip-info-content">
                  <div className="clip-times">
                    <span className="clip-time-label">IN:</span>
                    <span className="clip-time-value">
                      {formatClipTime(cut.inPoint)}
                    </span>
                    <span className="clip-time-separator">→</span>
                    <span className="clip-time-label">OUT:</span>
                    <span className="clip-time-value">
                      {formatClipTime(cut.outPoint)}
                    </span>
                  </div>
                  <div className="clip-actions">
                    <button
                      className="clip-edit-btn"
                      onClick={() => setShowVideoPreview(true)}
                      title="Edit clip points"
                    >
                      Edit
                    </button>
                    <button
                      className="clip-clear-btn"
                      onClick={handleClearClip}
                      title="Clear clip (use full video)"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

          {metadata?.prompt && (
            <div className="metadata-section">
              <div className="metadata-header">Prompt</div>
              <div className="metadata-content prompt-text">
                {metadata.prompt}
              </div>
              {metadata.negativePrompt && (
                <>
                  <div className="metadata-header negative">
                    Negative Prompt
                  </div>
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

          {/* Attached Audio Section */}
          {attachedAudio && (
            <div className="attached-audio-section">
              <div className="attached-audio-header">
                <Music size={14} />
                <span>Attached Audio</span>
              </div>
              <div className="attached-audio-info">
                <span className="audio-name">{attachedAudio.name}</span>
              </div>
              {attachedAudioDuration !== null && (
                <div className="attached-audio-duration">
                  Duration: {formatDuration(attachedAudioDuration)}
                </div>
              )}
              <div className="audio-offset-control">
                <label>Offset:</label>
                <button
                  className="audio-offset-btn"
                  onClick={() => handleAudioOffsetStep(-0.1)}
                  title="Decrease offset"
                >
                  <Minus size={12} />
                </button>
                <input
                  type="number"
                  value={audioOffset}
                  onChange={(e) => handleAudioOffsetChange(e.target.value)}
                  step="0.1"
                  className="offset-input"
                />
                <span className="offset-unit">s</span>
                <button
                  className="audio-offset-btn"
                  onClick={() => handleAudioOffsetStep(0.1)}
                  title="Increase offset"
                >
                  <Plus size={12} />
                </button>
              </div>
              <div className="attached-audio-actions">
                <button
                  className="audio-btn edit"
                  onClick={() => setShowVideoPreview(true)}
                  title="Preview with audio"
                >
                  Edit
                </button>
                <button
                  className="audio-btn remove"
                  onClick={handleDetachAudio}
                  title="Remove audio"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          <div className="details-actions">
            <button className="action-btn primary" onClick={() => setShowLipSyncModal(true)}>
              <Mic size={16} />
              <span>QUICK LIPSYNC</span>
            </button>
            <button className="action-btn secondary" onClick={handleAttachAudio}>
              <Music size={16} />
              <span>ATTACH AUDIO</span>
            </button>
          </div>

          <div className="details-footer">
            <button className="delete-btn" onClick={handleRelinkFile}>
              <Link size={14} />
              <span>Relink File</span>
            </button>
          </div>
        </div>

        {/* Single Mode Preview Modal */}
        {showVideoPreview && asset && (
          <PreviewModal
            asset={asset}
            onClose={() => setShowVideoPreview(false)}
            initialInPoint={cut?.inPoint}
            initialOutPoint={cut?.outPoint}
            onClipSave={isVideo ? handleSaveClip : undefined}
            onFrameCapture={isVideo ? handleFrameCapture : undefined}
          />
        )}

        {/* Lip Sync Modal */}
        {showLipSyncModal && asset && (
          <LipSyncModal
            asset={asset}
            sceneId={cutScene?.id || ""}
            onClose={() => setShowLipSyncModal(false)}
          />
        )}
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
