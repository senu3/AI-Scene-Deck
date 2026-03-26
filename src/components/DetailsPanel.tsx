import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Edit2,
  FolderOpen,
  Layers,
  Music,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "../store/useStore";
import {
  selectGetAsset,
  selectGetAttachedAudioForGroup,
  selectGetAttachedAudioForScene,
  selectGetSelectedCuts,
  selectGetSelectedGroup,
  selectMetadataStore,
  selectScenes,
  selectSelectedCutId,
  selectSelectedCutIds,
  selectSelectedGroupId,
  selectSelectedSceneId,
  selectSelectionType,
  selectToggleGroupCollapsed,
} from "../store/selectors";
import { useHistoryStore } from "../store/historyStore";
import {
  BatchUpdateDisplayTimeCommand,
  CreateGroupCommand,
  DeleteGroupCommand,
  RemoveCutCommand,
  RemoveSceneNoteCommand,
  RenameGroupCommand,
  SetGroupAttachAudioCommand,
  SetSceneAttachAudioCommand,
  AddSceneNoteCommand,
} from "../store/commands";
import {
  getAssetThumbnail,
  resolveCutThumbnailFromCache,
} from "../features/thumbnails/api";
import { resolveCutAsset } from "../utils/assetResolve";
import type { Asset } from "../types";
import AssetModal from "./AssetModal";
import CutDetailsPanel from "./details-panel/CutDetailsPanel";
import DetailsPanelFrame from "./details-panel/DetailsPanelFrame";
import "./DetailsPanel.css";

export default function DetailsPanel() {
  const scenes = useStore(selectScenes);
  const selectedSceneId = useStore(selectSelectedSceneId);
  const selectedCutId = useStore(selectSelectedCutId);
  const selectedCutIds = useStore(selectSelectedCutIds);
  const selectionType = useStore(selectSelectionType);
  const selectedGroupId = useStore(selectSelectedGroupId);
  const getAsset = useStore(selectGetAsset);
  const getSelectedCuts = useStore(selectGetSelectedCuts);
  const getSelectedGroup = useStore(selectGetSelectedGroup);
  const toggleGroupCollapsed = useStore(selectToggleGroupCollapsed);
  const metadataStore = useStore(selectMetadataStore);
  const getAttachedAudioForScene = useStore(selectGetAttachedAudioForScene);
  const getAttachedAudioForGroup = useStore(selectGetAttachedAudioForGroup);
  const { executeCommand } = useHistoryStore();

  const [noteText, setNoteText] = useState("");
  const [batchDisplayTime, setBatchDisplayTime] = useState("2.0");
  const [showSceneAudioModal, setShowSceneAudioModal] = useState(false);
  const [showGroupAudioModal, setShowGroupAudioModal] = useState(false);
  const [groupThumbnail, setGroupThumbnail] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");

  const selectedScene = selectedSceneId
    ? scenes.find((scene) => scene.id === selectedSceneId)
    : null;

  const isMultiSelection = selectedCutIds.size > 1;
  const selectedCuts = isMultiSelection ? getSelectedCuts() : [];
  const hasClipInSelection = selectedCuts.some(({ cut }) => !!cut.isClip);
  const allSameScene = selectedCuts.length > 0
    && selectedCuts.every(({ scene }) => scene.id === selectedCuts[0].scene.id);

  const selectedGroupData = getSelectedGroup();
  const sceneAudioBinding = selectedScene
    ? metadataStore?.sceneMetadata?.[selectedScene.id]?.attachAudio
    : undefined;
  const attachedSceneAudio = selectedScene
    ? getAttachedAudioForScene(selectedScene.id)
    : undefined;

  useEffect(() => {
    let isActive = true;

    const loadGroupThumbnail = async () => {
      setGroupThumbnail(null);

      if (!selectedGroupData) return;

      const firstCutId = selectedGroupData.group.cutIds[0];
      if (!firstCutId) return;

      const firstCut = selectedGroupData.scene.cuts.find((cut) => cut.id === firstCutId);
      if (!firstCut) return;

      const firstAsset = resolveCutAsset(firstCut, getAsset);
      const firstThumbnail = resolveCutThumbnailFromCache("details-panel", {
        cutId: firstCut.id,
        kind: firstCut.isClip ? "clip" : "cut",
        assetId: firstAsset?.id ?? firstCut.assetId,
        assetPath: firstAsset?.path,
        assetType: firstAsset?.type,
        inPointSec: firstCut.inPoint,
        outPointSec: firstCut.outPoint,
        assetSnapshotThumbnail: firstAsset?.thumbnail,
      }, {
        includeAssetSnapshotFallback: !firstCut.isClip,
      });
      if (firstThumbnail) {
        if (isActive) {
          setGroupThumbnail(firstThumbnail);
        }
        return;
      }

      if (!firstAsset?.path || (firstAsset.type !== "image" && firstAsset.type !== "video")) {
        return;
      }

      try {
        const cached = await getAssetThumbnail("details-panel", {
          assetId: firstAsset.id,
          path: firstAsset.path,
          type: firstAsset.type,
        });
        if (isActive && cached) {
          setGroupThumbnail(cached);
        }
      } catch {
        // ignore
      }
    };

    void loadGroupThumbnail();
    return () => {
      isActive = false;
    };
  }, [selectedGroupData, getAsset]);

  const handleAddNote = () => {
    if (!selectedScene || !noteText.trim()) return;

    executeCommand(new AddSceneNoteCommand(selectedScene.id, {
      type: "text",
      content: noteText.trim(),
    })).catch((error) => {
      console.error("Failed to add scene note:", error);
    });
    setNoteText("");
  };

  const handleDeleteNote = (noteId: string) => {
    if (!selectedScene) return;
    executeCommand(new RemoveSceneNoteCommand(selectedScene.id, noteId)).catch((error) => {
      console.error("Failed to remove scene note:", error);
    });
  };

  const handleApplyBatchDisplayTime = () => {
    if (hasClipInSelection) return;
    const numValue = parseFloat(batchDisplayTime);
    if (Number.isNaN(numValue) || numValue <= 0) return;

    const updates = selectedCuts.map(({ scene, cut }) => ({
      sceneId: scene.id,
      cutId: cut.id,
      newTime: numValue,
    }));

    if (updates.length === 0) return;

    executeCommand(new BatchUpdateDisplayTimeCommand(updates)).catch((error) => {
      console.error("Failed to batch update display time:", error);
    });
  };

  const handleBatchDelete = () => {
    for (const { scene, cut } of selectedCuts) {
      executeCommand(new RemoveCutCommand(scene.id, cut.id)).catch((error) => {
        console.error("Failed to remove cut:", error);
      });
    }
  };

  const handleCreateGroup = async () => {
    if (!allSameScene || selectedCuts.length < 2) return;

    const sceneId = selectedCuts[0].scene.id;
    const cutIds = selectedCuts.map(({ cut }) => cut.id);
    try {
      await executeCommand(new CreateGroupCommand(sceneId, cutIds, `Group ${Date.now()}`));
    } catch (error) {
      console.error("Failed to create group:", error);
    }
  };

  const handleSceneAudioModalConfirm = async (selectedAsset: Asset) => {
    if (!selectedScene) return;
    await executeCommand(new SetSceneAttachAudioCommand(selectedScene.id, selectedAsset));
    setShowSceneAudioModal(false);
  };

  const handleSceneDetachAudio = async () => {
    if (!selectedScene) return;
    await executeCommand(new SetSceneAttachAudioCommand(selectedScene.id, null));
  };

  const handleGroupAudioModalConfirm = async (selectedAsset: Asset) => {
    if (!selectedGroupData) return;
    await executeCommand(new SetGroupAttachAudioCommand(
      selectedGroupData.scene.id,
      selectedGroupData.group.id,
      selectedAsset,
    ));
    setShowGroupAudioModal(false);
  };

  const handleGroupDetachAudio = async () => {
    if (!selectedGroupData) return;
    await executeCommand(new SetGroupAttachAudioCommand(
      selectedGroupData.scene.id,
      selectedGroupData.group.id,
      null,
    ));
  };

  if (selectedGroupId && selectedGroupData) {
    const { scene, group } = selectedGroupData;
    const groupCuts = group.cutIds
      .map((id) => scene.cuts.find((cut) => cut.id === id))
      .filter((cut): cut is typeof scene.cuts[0] => cut !== undefined);
    const totalDuration = groupCuts.reduce((acc, cut) => acc + cut.displayTime, 0);
    const groupAudioBinding = metadataStore?.sceneMetadata?.[scene.id]?.groupAudioBindings?.[group.id];
    const attachedGroupAudio = getAttachedAudioForGroup(scene.id, group.id);

    const handleRenameGroup = async () => {
      if (!groupNameInput.trim()) return;
      try {
        await executeCommand(new RenameGroupCommand(scene.id, group.id, groupNameInput.trim()));
        setEditingGroupName(false);
      } catch (error) {
        console.error("Failed to rename group:", error);
      }
    };

    const handleDissolveGroup = async () => {
      try {
        await executeCommand(new DeleteGroupCommand(scene.id, group.id));
      } catch (error) {
        console.error("Failed to dissolve group:", error);
      }
    };

    return (
      <DetailsPanelFrame>
        <div className="details-content">
          <div className="selected-info group-info">
            <span className="selected-label">GROUP</span>
            {editingGroupName ? (
              <div className="group-name-edit">
                <input
                  type="text"
                  value={groupNameInput}
                  onChange={(event) => setGroupNameInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleRenameGroup();
                    if (event.key === "Escape") setEditingGroupName(false);
                  }}
                  onBlur={() => setEditingGroupName(false)}
                  autoFocus
                />
              </div>
            ) : (
              <span
                className="selected-value editable"
                onClick={() => {
                  setGroupNameInput(group.name || "");
                  setEditingGroupName(true);
                }}
              >
                {group.name}
                <Edit2 size={12} />
              </span>
            )}
          </div>

          <div className="details-preview">
            {groupThumbnail ? (
              <img
                src={groupThumbnail}
                alt={group.name}
                className="preview-image"
              />
            ) : (
              <div className="preview-placeholder">
                <Layers size={48} />
              </div>
            )}
          </div>

          <div className="multi-select-stats">
            <div className="stat-item">
              <Layers size={16} />
              <span>{groupCuts.length} cuts</span>
            </div>
            <div className="stat-item">
              <Clock size={16} />
              <span>{totalDuration.toFixed(1)}s total</span>
            </div>
          </div>

          <div className="group-cuts-list">
            <span className="breakdown-label">Cuts in Group:</span>
            {groupCuts.map((groupCut, idx) => (
              <div key={groupCut.id} className="breakdown-item">
                <span>Cut {idx + 1}</span>
                <span className="count">{groupCut.displayTime.toFixed(1)}s</span>
              </div>
            ))}
          </div>

          {groupAudioBinding?.audioAssetId ? (
            <div className="attached-audio-section">
              <div className="attached-audio-header">
                <Music size={14} />
                <span>Group Audio</span>
              </div>
              <div className="attached-audio-info">
                <span className="audio-name">
                  {groupAudioBinding.sourceName || attachedGroupAudio?.name || "Unknown"}
                </span>
              </div>
              <div className="attached-audio-actions">
                <button
                  className="audio-btn edit"
                  onClick={() => setShowGroupAudioModal(true)}
                  title="Replace group audio"
                >
                  Replace
                </button>
                <button
                  className="audio-btn remove"
                  onClick={() => void handleGroupDetachAudio()}
                  title="Clear group audio"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div className="scene-notes-section">
              <div className="notes-header">
                <Music size={16} />
                <span>Group Audio</span>
              </div>
              <div className="details-actions">
                <button className="action-btn secondary" onClick={() => setShowGroupAudioModal(true)}>
                  <Music size={16} />
                  <span>ATTACH GROUP AUDIO</span>
                </button>
              </div>
            </div>
          )}

          <div className="details-actions">
            <button
              className="action-btn secondary"
              onClick={() => toggleGroupCollapsed(scene.id, group.id)}
            >
              {group.isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              <span>{group.isCollapsed ? "EXPAND" : "COLLAPSE"}</span>
            </button>
          </div>

          <div className="details-footer">
            <button className="delete-btn" onClick={() => void handleDissolveGroup()}>
              <FolderOpen size={14} />
              <span>Dissolve Group</span>
            </button>
          </div>

          <AssetModal
            open={showGroupAudioModal}
            onClose={() => setShowGroupAudioModal(false)}
            onConfirm={handleGroupAudioModalConfirm}
            title="Select Group Audio"
            initialFilterType="audio"
            allowImport={true}
          />
        </div>
      </DetailsPanelFrame>
    );
  }

  if (isMultiSelection && selectionType === "cut") {
    const totalDuration = selectedCuts.reduce((acc, { cut }) => acc + cut.displayTime, 0);
    const sceneGroups = new Map<string, number>();
    selectedCuts.forEach(({ scene }) => {
      sceneGroups.set(scene.name, (sceneGroups.get(scene.name) || 0) + 1);
    });

    return (
      <DetailsPanelFrame>
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

          {allSameScene && selectedCuts.length >= 2 && (
            <div className="details-actions">
              <button className="action-btn create-group" onClick={() => void handleCreateGroup()}>
                <Layers size={16} />
                <span>CREATE GROUP</span>
              </button>
            </div>
          )}

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
                  onChange={(event) => setBatchDisplayTime(event.target.value)}
                  step="0.1"
                  min="0.1"
                  max="60"
                  className="time-input"
                  disabled={hasClipInSelection}
                  title={hasClipInSelection ? "Display time is locked when clip cuts are selected" : undefined}
                />
                <span className="time-unit">s</span>
                <button
                  className="apply-btn"
                  onClick={handleApplyBatchDisplayTime}
                  disabled={hasClipInSelection}
                  title={hasClipInSelection ? "Display time is locked when clip cuts are selected" : undefined}
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
      </DetailsPanelFrame>
    );
  }

  if (selectionType === "scene" && selectedScene) {
    return (
      <DetailsPanelFrame>
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
                {selectedScene.cuts.reduce((acc, cut) => acc + cut.displayTime, 0).toFixed(1)}
                s total
              </span>
            </div>
          </div>

          {sceneAudioBinding?.audioAssetId ? (
            <div className="attached-audio-section">
              <div className="attached-audio-header">
                <Music size={14} />
                <span>Scene Audio</span>
              </div>
              <div className="attached-audio-info">
                <span className="audio-name">
                  {sceneAudioBinding.sourceName || attachedSceneAudio?.name || "Unknown"}
                </span>
              </div>
              <div className="attached-audio-actions">
                <button
                  className="audio-btn edit"
                  onClick={() => setShowSceneAudioModal(true)}
                  title="Replace scene audio"
                >
                  Replace
                </button>
                <button
                  className="audio-btn remove"
                  onClick={() => void handleSceneDetachAudio()}
                  title="Clear scene audio"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div className="scene-notes-section">
              <div className="notes-header">
                <Music size={16} />
                <span>Scene Audio</span>
              </div>
              <div className="details-actions">
                <button className="action-btn secondary" onClick={() => setShowSceneAudioModal(true)}>
                  <Music size={16} />
                  <span>ATTACH SCENE AUDIO</span>
                </button>
              </div>
            </div>
          )}

          <div className="scene-notes-section">
            <div className="notes-header">
              <StickyNote size={16} />
              <span>Notes</span>
            </div>

            <div className="notes-input">
              <textarea
                placeholder="Add a note..."
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
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

          <AssetModal
            open={showSceneAudioModal}
            onClose={() => setShowSceneAudioModal(false)}
            onConfirm={handleSceneAudioModalConfirm}
            title="Select Scene Audio"
            initialFilterType="audio"
            allowImport={true}
          />
        </div>
      </DetailsPanelFrame>
    );
  }

  if (selectionType === "cut" && selectedCutId) {
    return <CutDetailsPanel cutId={selectedCutId} />;
  }

  return (
    <DetailsPanelFrame>
      <div className="details-empty">
        <p>Select a scene or cut to view details</p>
      </div>
    </DetailsPanelFrame>
  );
}
