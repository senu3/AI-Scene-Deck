import { memo, useEffect, useMemo, useState } from "react";
import {
  Clock,
  FileImage,
  Film,
  Link,
  Minus,
  Music,
  Play,
  Plus,
  Scissors,
  Volume2,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { v4 as uuidv4 } from "uuid";
import { Toggle } from "../../ui";
import { useStore } from "../../store/useStore";
import {
  selectAttachAudioToCut,
  selectCacheAsset,
  selectCreateStoreEventOperation,
  selectDetachAudioFromCut,
  selectRelinkCutAsset,
  selectSetCutUseEmbeddedAudio,
  selectUpdateCutAudioOffset,
  selectVaultPath,
} from "../../store/selectors";
import { useHistoryStore } from "../../store/historyStore";
import {
  AddCutCommand,
  UpdateDisplayTimeCommand,
} from "../../store/commands";
import {
  getAssetThumbnail,
  resolveCutThumbnailFromCache,
} from "../../features/thumbnails/api";
import { selectAndImportAssetToVault } from "../../features/asset/import";
import { useAssetMetadataHydration } from "../../features/metadata/useAssetMetadataHydration";
import {
  ensureVaultStagingFolderBridge,
  extractVideoFrameBridge,
  getFileInfoBridge,
} from "../../features/platform/electronGateway";
import { clearPreviewClipPoints, savePreviewClipPoints } from "../../features/cut/previewClipUpdate";
import { importFileToVault } from "../../utils/assetPath";
import type { Asset, PreviewableAsset } from "../../types";
import AssetModal from "../AssetModal";
import PreviewModal from "../PreviewModal";
import DetailsPanelFrame from "./DetailsPanelFrame";
import {
  findCutSelectionById,
  makeSelectCutAudioFields,
  makeSelectCutClipFields,
  makeSelectCutInfoFields,
  makeSelectCutPanelBase,
} from "./selectors";

function isPreviewableAsset(asset: Asset | null | undefined): asset is PreviewableAsset {
  return asset?.type === "image" || asset?.type === "video";
}

function formatClipTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getCutSelectionSnapshot(cutId: string) {
  return findCutSelectionById(useStore.getState(), cutId);
}

interface CutDetailsPanelProps {
  cutId: string;
}

const CutDetailsHeaderSection = memo(function CutDetailsHeaderSection({
  sceneName,
  cutOrder,
}: {
  sceneName: string;
  cutOrder: number;
}) {
  return (
    <div className="selected-info">
      <span className="selected-label">SELECTED</span>
      <span className="selected-value">
        {sceneName} / Cut {cutOrder}
      </span>
    </div>
  );
});

const CutDetailsThumbSection = memo(function CutDetailsThumbSection({
  cutId,
  assetId,
  assetName,
  assetPath,
  assetType,
  assetSnapshotThumbnail,
  canPreview,
  isVideo,
  onOpenPreview,
}: {
  cutId: string;
  assetId: string;
  assetName: string;
  assetPath: string | null;
  assetType: Asset["type"] | null;
  assetSnapshotThumbnail: string | null;
  canPreview: boolean;
  isVideo: boolean;
  onOpenPreview: () => void;
}) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadThumbnail = async () => {
      const selected = getCutSelectionSnapshot(cutId);
      setThumbnail(null);

      if (!selected) {
        return;
      }

      const preferredThumbnail = resolveCutThumbnailFromCache("details-panel", {
        cutId: selected.cut.id,
        kind: selected.cut.isClip ? "clip" : "cut",
        assetId: assetId || selected.cut.assetId,
        assetPath: assetPath ?? undefined,
        assetType: assetType ?? undefined,
        inPointSec: selected.cut.inPoint,
        outPointSec: selected.cut.outPoint,
        assetSnapshotThumbnail: assetSnapshotThumbnail ?? undefined,
      }, {
        includeAssetSnapshotFallback: !selected.cut.isClip,
      });

      if (preferredThumbnail) {
        if (isActive) {
          setThumbnail(preferredThumbnail);
        }
        return;
      }

      if (!assetPath || (assetType !== "image" && assetType !== "video")) {
        return;
      }

      try {
        const cached = await getAssetThumbnail("details-panel", {
          assetId,
          path: assetPath,
          type: assetType,
        });
        if (isActive && cached) {
          setThumbnail(cached);
        }
      } catch {
        // ignore
      }
    };

    void loadThumbnail();
    return () => {
      isActive = false;
    };
  }, [cutId, assetId, assetPath, assetType, assetSnapshotThumbnail]);

  return (
    <div
      className="details-preview clickable"
      onClick={() => canPreview && onOpenPreview()}
      title={canPreview ? "Click to preview" : undefined}
    >
      {thumbnail ? (
        <>
          <img
            src={thumbnail}
            alt={assetName}
            className="preview-image"
          />
          {canPreview && (
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
  );
});

const CutDetailsInfoSection = memo(function CutDetailsInfoSection({
  cutId,
  isVideo,
}: {
  cutId: string;
  isVideo: boolean;
}) {
  const selector = useMemo(() => makeSelectCutInfoFields(cutId), [cutId]);
  const fields = useStore(useShallow(selector));
  const setCutUseEmbeddedAudio = useStore(selectSetCutUseEmbeddedAudio);
  const { executeCommand } = useHistoryStore();
  const [localDisplayTime, setLocalDisplayTime] = useState("2.0");

  useEffect(() => {
    if (!fields) return;
    setLocalDisplayTime(fields.displayTime.toFixed(1));
  }, [cutId, fields?.displayTime]);

  if (!fields) {
    return null;
  }

  const handleDisplayTimeChange = (value: string) => {
    if (fields.isClipDurationLocked) return;

    setLocalDisplayTime(value);
    const numValue = parseFloat(value);
    const selected = getCutSelectionSnapshot(cutId);
    if (
      !selected
      || Number.isNaN(numValue)
      || numValue <= 0
    ) {
      return;
    }

    executeCommand(
      new UpdateDisplayTimeCommand(selected.scene.id, selected.cut.id, numValue),
    ).catch((error) => {
      console.error("Failed to update display time:", error);
    });
  };

  const handleUseEmbeddedAudioToggle = (enabled: boolean) => {
    const selected = getCutSelectionSnapshot(cutId);
    if (!selected) return;
    setCutUseEmbeddedAudio(selected.scene.id, selected.cut.id, enabled);
  };

  return (
    <div className="details-info">
      <div className="info-row">
        <span className="info-label">
          <Clock size={14} />
          Display Time:
        </span>
        <div className="time-input-group">
          <input
            type="number"
            value={localDisplayTime}
            onChange={(event) => handleDisplayTimeChange(event.target.value)}
            step="0.1"
            min="0.1"
            max="60"
            className="time-input"
            disabled={fields.isClipDurationLocked}
            title={fields.isClipDurationLocked ? "Display time is locked for clip cuts" : undefined}
          />
          <span className="time-unit">seconds</span>
        </div>
      </div>
      {isVideo && (
        <div className="info-row">
          <span className="info-label">
            <Volume2 size={14} />
            Audio from the video:
          </span>
          <Toggle
            checked={fields.useEmbeddedAudio}
            onChange={handleUseEmbeddedAudioToggle}
            size="sm"
          />
        </div>
      )}
    </div>
  );
});

const CutDetailsClipSection = memo(function CutDetailsClipSection({
  cutId,
  isVideo,
  onOpenPreview,
  onClearClip,
}: {
  cutId: string;
  isVideo: boolean;
  onOpenPreview: () => void;
  onClearClip: () => void;
}) {
  const selector = useMemo(() => makeSelectCutClipFields(cutId), [cutId]);
  const clipFields = useStore(useShallow(selector));

  if (
    !isVideo
    || !clipFields?.isClip
    || clipFields.inPoint === undefined
    || clipFields.outPoint === undefined
  ) {
    return null;
  }

  return (
    <div className="clip-info-section">
      <div className="clip-info-header">
        <Scissors size={14} />
        <span>Video Clip</span>
      </div>
      <div className="clip-info-content">
        <div className="clip-times">
          <span className="clip-time-label">IN:</span>
          <span className="clip-time-value">
            {formatClipTime(clipFields.inPoint)}
          </span>
          <span className="clip-time-separator">→</span>
          <span className="clip-time-label">OUT:</span>
          <span className="clip-time-value">
            {formatClipTime(clipFields.outPoint)}
          </span>
        </div>
        <div className="clip-actions">
          <button
            className="clip-edit-btn"
            onClick={onOpenPreview}
            title="Edit clip points"
          >
            Edit
          </button>
          <button
            className="clip-clear-btn"
            onClick={onClearClip}
            title="Clear clip (use full video)"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
});

const CutDetailsMetadataSection = memo(function CutDetailsMetadataSection({
  metadata,
}: {
  metadata: Asset["metadata"] | null;
}) {
  if (!metadata?.prompt) {
    return null;
  }

  return (
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
  );
});

const CutDetailsAudioSection = memo(function CutDetailsAudioSection({
  cutId,
  onAttachAudio,
  onReplaceAudio,
  onDetachAudio,
}: {
  cutId: string;
  onAttachAudio: () => void;
  onReplaceAudio: () => void;
  onDetachAudio: () => void;
}) {
  const selector = useMemo(() => makeSelectCutAudioFields(cutId), [cutId]);
  const audioFields = useStore(useShallow(selector));
  const updateCutAudioOffset = useStore(selectUpdateCutAudioOffset);
  const [audioOffset, setAudioOffset] = useState("0.0");

  useEffect(() => {
    setAudioOffset((audioFields?.primaryAudioBinding?.offsetSec ?? 0).toFixed(1));
  }, [cutId, audioFields?.primaryAudioBinding?.offsetSec]);

  const hasAttachedAudio = !!audioFields?.primaryAudioBinding?.audioAssetId;
  const attachedAudioSourceName = audioFields?.primaryAudioBinding?.sourceName
    || audioFields?.attachedAudio?.name
    || "Unknown";
  const attachedAudioDuration = audioFields?.attachedAudio?.duration ?? null;

  const handleAudioOffsetChange = (value: string) => {
    setAudioOffset(value);
    const numValue = parseFloat(value);
    const selected = getCutSelectionSnapshot(cutId);
    if (!selected || Number.isNaN(numValue)) return;
    updateCutAudioOffset(selected.scene.id, selected.cut.id, numValue);
  };

  const handleAudioOffsetStep = (delta: number) => {
    const currentOffset = parseFloat(audioOffset) || 0;
    const newOffset = (currentOffset + delta).toFixed(1);
    handleAudioOffsetChange(newOffset);
  };

  return (
    <>
      {hasAttachedAudio && (
        <div className="attached-audio-section">
          <div className="attached-audio-header">
            <Music size={14} />
            <span>Attached Audio</span>
          </div>
          <div className="attached-audio-info">
            <span className="audio-name">{attachedAudioSourceName}</span>
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
              onChange={(event) => handleAudioOffsetChange(event.target.value)}
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
              onClick={onReplaceAudio}
              title="Replace audio"
            >
              Replace
            </button>
            <button
              className="audio-btn remove"
              onClick={onDetachAudio}
              title="Clear audio"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="details-actions">
        <button className="action-btn secondary" onClick={onAttachAudio}>
          <Music size={16} />
          <span>ATTACH AUDIO</span>
        </button>
      </div>
    </>
  );
});

export default function CutDetailsPanel({ cutId }: CutDetailsPanelProps) {
  const selector = useMemo(() => makeSelectCutPanelBase(cutId), [cutId]);
  const panelBase = useStore(useShallow(selector));
  const cacheAsset = useStore(selectCacheAsset);
  const vaultPath = useStore(selectVaultPath);
  const attachAudioToCut = useStore(selectAttachAudioToCut);
  const detachAudioFromCut = useStore(selectDetachAudioFromCut);
  const createStoreEventOperation = useStore(selectCreateStoreEventOperation);
  const relinkCutAsset = useStore(selectRelinkCutAsset);
  const { executeCommand } = useHistoryStore();
  const [showSinglePreview, setShowSinglePreview] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);

  const { asset: hydratedAsset } = useAssetMetadataHydration({
    asset: panelBase?.asset ?? null,
    requirements: panelBase?.asset?.type === "video"
      ? { duration: true, dimensions: true, fileSize: true }
      : panelBase?.asset?.type === "image"
        ? { dimensions: true, fileSize: true }
        : {},
    cacheAsset,
  });

  const activeAsset = hydratedAsset ?? panelBase?.asset ?? null;
  const metadata = activeAsset?.metadata ?? null;

  if (!panelBase || !activeAsset) {
    return (
      <DetailsPanelFrame>
        <div className="details-empty">
          <p>Select a scene or cut to view details</p>
        </div>
      </DetailsPanelFrame>
    );
  }

  const isVideo = activeAsset.type === "video";
  const previewAsset = isPreviewableAsset(activeAsset) ? activeAsset : null;
  const currentCut = getCutSelectionSnapshot(cutId)?.cut ?? null;

  const handleSaveClip = async (
    inPoint: number,
    outPoint: number,
    options?: { expectedClipRevision?: number },
  ) => {
    const selected = getCutSelectionSnapshot(cutId);
    if (!selected) return;

    await savePreviewClipPoints(
      {
        sceneId: selected.scene.id,
        cutId: selected.cut.id,
        isClip: !!selected.cut.isClip,
        asset: activeAsset,
      },
      inPoint,
      outPoint,
      {
        executeCommand,
        getCurrentCut: (sceneId, targetCutId) => {
          const target = useStore.getState().scenes.find((scene) => scene.id === sceneId);
          return target?.cuts.find((cut) => cut.id === targetCutId);
        },
        getCurrentClipRevision: (targetCutId) => useStore.getState().getCutRuntime(targetCutId)?.clipRevision ?? 0,
        thumbnailProfile: "details-panel",
      },
      options,
    );
  };

  const handleClearClip = async () => {
    const selected = getCutSelectionSnapshot(cutId);
    if (!selected) return;

    await clearPreviewClipPoints(
      {
        sceneId: selected.scene.id,
        cutId: selected.cut.id,
        isClip: !!selected.cut.isClip,
        asset: activeAsset,
      },
      {
        executeCommand,
        getCurrentCut: (sceneId, targetCutId) => {
          const target = useStore.getState().scenes.find((scene) => scene.id === sceneId);
          return target?.cuts.find((cut) => cut.id === targetCutId);
        },
        getCurrentClipRevision: (targetCutId) => useStore.getState().getCutRuntime(targetCutId)?.clipRevision ?? 0,
        thumbnailProfile: "details-panel",
      },
    );
  };

  const handleAttachAudio = () => {
    setShowAssetModal(true);
  };

  const handleReplaceAudio = () => {
    setShowAssetModal(true);
  };

  const handleDetachAudio = () => {
    const selected = getCutSelectionSnapshot(cutId);
    if (!selected) return;
    detachAudioFromCut(selected.scene.id, selected.cut.id);
  };

  const handleAssetModalConfirm = (selectedAsset: Asset) => {
    const selected = getCutSelectionSnapshot(cutId);
    if (!selected) return;
    attachAudioToCut(selected.scene.id, selected.cut.id, selectedAsset);
    setShowAssetModal(false);
  };

  const handleFrameCapture = async (timestamp: number): Promise<string | void> => {
    const selected = getCutSelectionSnapshot(cutId);
    if (!selected || !activeAsset.path || !vaultPath) {
      throw new Error("Cannot capture frame: missing required data");
    }

    try {
      const stagingFolder = await ensureVaultStagingFolderBridge(vaultPath);
      if (!stagingFolder) {
        throw new Error("Failed to access vault staging folder");
      }

      const baseName = activeAsset.name.replace(/\.[^/.]+$/, "");
      const timeStr = timestamp.toFixed(2).replace(".", "_");
      const uniqueId = uuidv4().substring(0, 8);
      const frameFileName = `${baseName}_frame_${timeStr}_${uniqueId}.png`;
      const outputPath = `${stagingFolder}/${frameFileName}`.replace(/\\/g, "/");

      const result = await extractVideoFrameBridge({
        sourcePath: activeAsset.path,
        outputPath,
        timestamp,
      });

      if (!result.success) {
        throw new Error(`Failed to capture frame: ${result.error}`);
      }

      const thumbnailBase64 = await getAssetThumbnail("timeline-card", {
        path: outputPath,
        type: "image",
      });

      const info = await getFileInfoBridge(outputPath);
      const newAssetId = uuidv4();
      const sourceLabel = `${baseName} @ ${formatClipTime(timestamp)}`;
      const baseAsset: Asset = {
        id: newAssetId,
        name: sourceLabel,
        path: outputPath,
        type: "image",
        thumbnail: thumbnailBase64 || undefined,
        fileSize: info?.size,
      };

      const importedAsset = await importFileToVault(outputPath, vaultPath, newAssetId, baseAsset);
      const finalAsset = importedAsset ?? baseAsset;

      cacheAsset(finalAsset);

      const currentIndex = selected.scene.cuts.findIndex((cut) => cut.id === selected.cut.id);
      const insertIndex = currentIndex >= 0 ? currentIndex + 1 : undefined;
      await executeCommand(new AddCutCommand(selected.scene.id, finalAsset, undefined, insertIndex));

      return `Captured frame: ${sourceLabel}`;
    } catch (error) {
      console.error("Frame capture failed:", error);
      throw error;
    }
  };

  const handleRelinkFile = async () => {
    const selected = getCutSelectionSnapshot(cutId);
    if (!selected || !vaultPath) return;

    try {
      const importedAsset = await selectAndImportAssetToVault({
        vaultPath,
        filterType: "all",
        dialogTitle: "Select New File",
      });
      if (!importedAsset) {
        return;
      }

      const newAsset: Asset = { ...importedAsset };
      const thumbnail = await getAssetThumbnail("timeline-card", {
        assetId: newAsset.id,
        path: newAsset.path,
        type: newAsset.type === "video" ? "video" : "image",
      });
      if (thumbnail) {
        newAsset.thumbnail = thumbnail;
      }

      relinkCutAsset(selected.scene.id, selected.cut.id, newAsset, {
        eventContext: createStoreEventOperation("user"),
      });
    } catch (error) {
      console.error("Failed to relink file:", error);
      alert(`Failed to relink file: ${error}`);
    }
  };

  return (
    <DetailsPanelFrame>
      <div className="details-content">
        <CutDetailsHeaderSection
          sceneName={panelBase.sceneName}
          cutOrder={panelBase.cutOrder}
        />

        <CutDetailsThumbSection
          cutId={cutId}
          assetId={panelBase.assetId}
          assetName={panelBase.assetName}
          assetPath={panelBase.assetPath}
          assetType={panelBase.assetType}
          assetSnapshotThumbnail={panelBase.assetSnapshotThumbnail}
          canPreview={!!previewAsset}
          isVideo={isVideo}
          onOpenPreview={() => setShowSinglePreview(true)}
        />

        <CutDetailsInfoSection cutId={cutId} isVideo={isVideo} />

        <CutDetailsClipSection
          cutId={cutId}
          isVideo={isVideo}
          onOpenPreview={() => setShowSinglePreview(true)}
          onClearClip={() => {
            void handleClearClip();
          }}
        />

        <CutDetailsMetadataSection metadata={metadata} />

        <CutDetailsAudioSection
          cutId={cutId}
          onAttachAudio={handleAttachAudio}
          onReplaceAudio={handleReplaceAudio}
          onDetachAudio={handleDetachAudio}
        />

        <div className="details-footer">
          <button className="relink-btn" onClick={() => void handleRelinkFile()}>
            <Link size={14} />
            <span>Relink File</span>
          </button>
        </div>
      </div>

      {showSinglePreview && previewAsset && (
        <PreviewModal
          mode="single"
          asset={previewAsset}
          focusCutId={cutId}
          onClose={() => setShowSinglePreview(false)}
          initialInPoint={currentCut?.inPoint}
          initialOutPoint={currentCut?.outPoint}
          onClipSave={isVideo ? handleSaveClip : undefined}
          onClipClear={isVideo ? handleClearClip : undefined}
          onFrameCapture={isVideo ? handleFrameCapture : undefined}
        />
      )}

      <AssetModal
        open={showAssetModal}
        onClose={() => setShowAssetModal(false)}
        onConfirm={handleAssetModalConfirm}
        title="Select Audio"
        initialFilterType="audio"
        allowImport={true}
      />
    </DetailsPanelFrame>
  );
}
