import { useState } from 'react';
import { Clapperboard, FolderOpen, Save, MoreVertical, Undo, Redo, X, RotateCcw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useDialog } from '../ui';
import { useHistoryStore } from '../store/historyStore';
import type { Scene, Asset, SourcePanelState } from '../types';
import MissingAssetRecoveryModal, { MissingAssetInfo, RecoveryDecision } from './MissingAssetRecoveryModal';
import { importFileToVault } from '../utils/assetPath';
import { extractVideoMetadata } from '../utils/videoUtils';
import { getThumbnail } from '../utils/thumbnailCache';
import { buildAssetUsageRefs, ensureSceneIds, getOrderedAssetIdsFromScenes, prepareScenesForSave } from '../utils/projectSave';
import { useSnapshotStore } from '../store/snapshotStore';
import { requestAutosave } from '../utils/autosaveBus';
import './Header.css';

// Helper to detect media type from filename
function getMediaType(filename: string): 'image' | 'video' {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
  return videoExts.includes(ext) ? 'video' : 'image';
}

// Resolve asset paths from relative to absolute
async function resolveAssetPath(asset: Asset, vaultPath: string): Promise<Asset> {
  // Check if path looks like a relative vault path
  if (asset.path.startsWith('assets/')) {
    const result = await window.electronAPI?.resolveVaultPath(vaultPath, asset.path);
    if (result?.exists) {
      return {
        ...asset,
        vaultRelativePath: asset.path,
        path: result.absolutePath || asset.path,
      };
    }
  }

  // Check if asset already has vaultRelativePath
  if (asset.vaultRelativePath && window.electronAPI) {
    const result = await window.electronAPI.resolveVaultPath(vaultPath, asset.vaultRelativePath);
    if (result?.exists) {
      return {
        ...asset,
        path: result.absolutePath || asset.path,
      };
    }
  }

  return asset;
}

// Resolve all asset paths in scenes
async function resolveScenesAssets(scenes: Scene[], vaultPath: string): Promise<{ scenes: Scene[]; missingAssets: MissingAssetInfo[] }> {
  const resolvedScenes: Scene[] = [];
  const missingAssets: MissingAssetInfo[] = [];

  for (const scene of scenes) {
    const resolvedCuts = await Promise.all(
      scene.cuts.map(async (cut) => {
        if (cut.asset) {
          const resolvedAsset = await resolveAssetPath(cut.asset, vaultPath);

          // Check if asset file exists
          if (resolvedAsset.path && window.electronAPI) {
            const exists = await window.electronAPI.pathExists(resolvedAsset.path);
            if (!exists) {
              missingAssets.push({
                name: resolvedAsset.name || resolvedAsset.path,
                cutId: cut.id,
                sceneId: scene.id,
                asset: resolvedAsset,
              });
            }
          }

          return { ...cut, asset: resolvedAsset };
        }
        return cut;
      })
    );

    resolvedScenes.push({
      ...scene,
      cuts: resolvedCuts,
    });
  }

  return { scenes: resolvedScenes, missingAssets };
}

// Pending project data for recovery dialog
interface PendingProject {
  name: string;
  vaultPath: string;
  scenes: Scene[];
  sourcePanelState?: SourcePanelState;
  projectPath: string;
}

//

interface HeaderProps {
  onOpenSettings?: () => void;
}

export default function Header({ onOpenSettings }: HeaderProps) {
  const { scenes, vaultPath, clearProject, projectName, setProjectLoaded, initializeProject, getSourcePanelState, initializeSourcePanel, loadMetadata, loadProject, applySceneSnapshot, saveMetadata } = useStore();
  const { undo, redo, canUndo, canRedo, clear: clearHistory } = useHistoryStore();
  const { alert: dialogAlert, confirm: dialogConfirm } = useDialog();
  const { setSnapshot, getSnapshot } = useSnapshotStore();

  // Recovery dialog state
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [missingAssets, setMissingAssets] = useState<MissingAssetInfo[]>([]);
  const [pendingProject, setPendingProject] = useState<PendingProject | null>(null);
  const handleSaveProject = async () => {
    if (!window.electronAPI) {
      window.alert('File system access is only available in the desktop app.');
      return;
    }

    const { scenes: normalizedScenes, missingCount } = ensureSceneIds(scenes);
    if (missingCount > 0) {
      await dialogAlert({
        title: 'Scene ID の自動付与',
        message: `Scene ID が未設定のシーンが ${missingCount} 件あります。OK を押すと自動付与して保存を続行します。`,
        variant: 'warning',
        confirmLabel: 'OK',
      });
      loadProject(normalizedScenes);
    }

    // Prepare scenes with relative paths for portability
    const scenesToSave = prepareScenesForSave(normalizedScenes);

    // Get source panel state for saving
    const sourcePanelState = getSourcePanelState();

    // Reorder asset index by Storyline order (scene/cut order)
    if (vaultPath && window.electronAPI.loadAssetIndex && window.electronAPI.vaultGateway?.saveAssetIndex) {
      try {
        const orderedIds = getOrderedAssetIdsFromScenes(normalizedScenes);
        const usageRefs = buildAssetUsageRefs(normalizedScenes);
        const index = await window.electronAPI.loadAssetIndex(vaultPath);
        const normalizedAssets = index.assets.map((entry) => ({
          ...entry,
          usageRefs: usageRefs.get(entry.id) || [],
        }));
        const remaining = normalizedAssets.filter(entry => !orderedIds.includes(entry.id));
        const ordered = orderedIds
          .map(id => normalizedAssets.find(entry => entry.id === id))
          .filter((entry): entry is NonNullable<typeof entry> => !!entry);
        const newIndex = {
          ...index,
          assets: [...ordered, ...remaining],
        };
        await window.electronAPI.vaultGateway.saveAssetIndex(vaultPath, newIndex);
      } catch (error) {
        console.error('Failed to reorder asset index:', error);
      }
    }

    const projectData = JSON.stringify({
      version: 3, // Version 3 includes source panel state
      name: projectName,
      vaultPath: vaultPath,
      scenes: scenesToSave,
      sourcePanel: sourcePanelState,
      savedAt: new Date().toISOString(),
    });

    const savedPath = await window.electronAPI.saveProject(projectData, vaultPath ? `${vaultPath}/project.sdp` : undefined);
    if (savedPath) {
      setSnapshot('manual-save', {
        createdAt: new Date().toISOString(),
        label: 'Manual Save',
        reason: 'manual-save',
        scenes: normalizedScenes,
      });
      alert('Project saved successfully!');

      // Update recent projects
      const recentProjects = await window.electronAPI.getRecentProjects();
      const newRecent = {
        name: projectName,
        path: savedPath,
        date: new Date().toISOString(),
      };
      const filtered = recentProjects.filter(p => p.path !== savedPath);
      await window.electronAPI.saveRecentProjects([newRecent, ...filtered.slice(0, 9)]);
    }
  };

  // Finalize project loading after recovery decisions (if any)
  const finalizeProjectLoad = async (project: PendingProject, recoveryDecisions?: RecoveryDecision[]) => {
    let finalScenes = project.scenes;

    // Apply recovery decisions
    if (recoveryDecisions && recoveryDecisions.length > 0) {
      for (const decision of recoveryDecisions) {
        if (decision.action === 'delete') {
          // Remove the cut from scenes
          finalScenes = finalScenes.map(scene => {
            if (scene.id === decision.sceneId) {
              return {
                ...scene,
                cuts: scene.cuts.filter(cut => cut.id !== decision.cutId),
              };
            }
            return scene;
          });
        } else if (decision.action === 'relink' && decision.newPath) {
          // Update the cut's asset path with new thumbnail and metadata
          finalScenes = await Promise.all(finalScenes.map(async scene => {
            if (scene.id === decision.sceneId) {
              const updatedCuts = await Promise.all(scene.cuts.map(async cut => {
                if (cut.id === decision.cutId && cut.asset) {
                  const newPath = decision.newPath!;
                  const newName = newPath.split(/[/\\]/).pop() || cut.asset.name;
                  const newType = getMediaType(newName);

                  // Get new thumbnail and metadata
                  let thumbnail: string | undefined;
                  let duration: number | undefined;
                  let metadata: { width?: number; height?: number } | undefined;

                  if (newType === 'video') {
                    // Extract video metadata and thumbnail
                    const videoMeta = await extractVideoMetadata(newPath);
                    if (videoMeta) {
                      duration = videoMeta.duration;
                      metadata = { width: videoMeta.width, height: videoMeta.height };
                    }
                    const thumb = await getThumbnail(newPath, 'video', { timeOffset: 0 });
                    if (thumb) {
                      thumbnail = thumb;
                    }
                  } else {
                    // Load image as base64 for thumbnail
                    const base64 = await getThumbnail(newPath, 'image');
                    if (base64) {
                      thumbnail = base64;
                    }
                  }

                  // Import the new file to vault
                  const importedAsset = await importFileToVault(
                    newPath,
                    project.vaultPath,
                    cut.asset.id,
                    {
                      name: newName,
                      type: newType,
                      thumbnail,
                      duration,
                      metadata,
                    }
                  );

                  if (importedAsset) {
                    return {
                      ...cut,
                      asset: { ...importedAsset, thumbnail, duration, metadata },
                      // Update displayTime for videos
                      displayTime: newType === 'video' && duration ? duration : cut.displayTime,
                    };
                  }

                  // Fallback: just update the path with new info
                  return {
                    ...cut,
                    asset: { ...cut.asset, path: newPath, name: newName, type: newType, thumbnail, duration, metadata },
                    displayTime: newType === 'video' && duration ? duration : cut.displayTime,
                  };
                }
                return cut;
              }));
              return { ...scene, cuts: updatedCuts };
            }
            return scene;
          }));
        }
        // For 'skip', we don't modify anything
      }
    }

    // Regenerate thumbnails for video clips at their IN points
    finalScenes = await Promise.all(finalScenes.map(async scene => {
      const updatedCuts = await Promise.all(scene.cuts.map(async cut => {
        // Only process video clips with valid IN points
        if (cut.isClip && cut.inPoint !== undefined && cut.asset?.type === 'video' && cut.asset.path) {
          const newThumbnail = await getThumbnail(cut.asset.path, 'video', { timeOffset: cut.inPoint });
          if (newThumbnail) {
            return {
              ...cut,
              asset: { ...cut.asset, thumbnail: newThumbnail },
            };
          }
        }
        return cut;
      }));
      return { ...scene, cuts: updatedCuts };
    }));

    initializeProject({
      name: project.name,
      vaultPath: project.vaultPath,
      scenes: finalScenes,
    });
    setSnapshot('initial-load', {
      createdAt: new Date().toISOString(),
      label: 'Initial Load',
      reason: 'load-project',
      scenes: finalScenes,
    });

    // Load metadata store (audio attachments, etc.)
    await loadMetadata(project.vaultPath);

    // Initialize source panel state
    await initializeSourcePanel(project.sourcePanelState, project.vaultPath);

    // Update recent projects
    const recentProjects = await window.electronAPI?.getRecentProjects() || [];
    const newRecent = {
      name: project.name,
      path: project.projectPath,
      date: new Date().toISOString(),
    };
    const filtered = recentProjects.filter((p: any) => p.path !== project.projectPath);
    await window.electronAPI?.saveRecentProjects([newRecent, ...filtered.slice(0, 9)]);

    // Clear recovery state
    setShowRecoveryDialog(false);
    setPendingProject(null);
    setMissingAssets([]);
  };

  // Handle recovery dialog completion
  const handleRecoveryComplete = async (decisions: RecoveryDecision[]) => {
    if (!pendingProject) return;
    await finalizeProjectLoad(pendingProject, decisions);
  };

  // Handle recovery dialog cancel
  const handleRecoveryCancel = () => {
    setShowRecoveryDialog(false);
    setPendingProject(null);
    setMissingAssets([]);
  };

  const handleLoadProject = async () => {
    if (!window.electronAPI) {
      alert('File system access is only available in the desktop app.');
      return;
    }

    const result = await window.electronAPI.loadProject();
    if (result) {
      const { data, path } = result;
      const projectData = data as { name?: string; vaultPath?: string; scenes?: Scene[]; version?: number; sourcePanel?: SourcePanelState };

      // Determine vault path
      const loadedVaultPath = projectData.vaultPath || path.replace(/[/\\]project\.sdp$/, '').replace(/[/\\][^/\\]+\.sdp$/, '');

      // Resolve asset paths (v2+ uses relative paths)
      let loadedScenes = projectData.scenes || [];
      let foundMissingAssets: MissingAssetInfo[] = [];

      if (projectData.version && projectData.version >= 2 || loadedScenes.some(s => s.cuts?.some(c => c.asset?.path?.startsWith('assets/')))) {
        const resolved = await resolveScenesAssets(loadedScenes, loadedVaultPath);
        loadedScenes = resolved.scenes;
        foundMissingAssets = resolved.missingAssets;
      }

      // If there are missing assets, show recovery dialog
      if (foundMissingAssets.length > 0) {
        setMissingAssets(foundMissingAssets);
        setPendingProject({
          name: projectData.name || 'Loaded Project',
          vaultPath: loadedVaultPath,
          scenes: loadedScenes,
          sourcePanelState: projectData.sourcePanel,
          projectPath: path,
        });
        setShowRecoveryDialog(true);
        return;
      }

      // No missing assets, proceed directly
      await finalizeProjectLoad({
        name: projectData.name || 'Loaded Project',
        vaultPath: loadedVaultPath,
        scenes: loadedScenes,
        sourcePanelState: projectData.sourcePanel,
        projectPath: path,
      });
    }
  };

  const handleCloseProject = () => {
    if (confirm('Close project? Any unsaved changes will be lost.')) {
      clearProject();
      setProjectLoaded(false);
    }
  };

  const handleRevertToManualSave = async () => {
    const snapshot = getSnapshot('manual-save');
    if (!snapshot) {
      await dialogAlert({
        title: 'Revert unavailable',
        message: 'No manual save snapshot is available for this project.',
        variant: 'warning',
        confirmLabel: 'OK',
      });
      return;
    }

    const confirmed = await dialogConfirm({
      title: 'Revert to Last Manual Save',
      message: 'Discard changes made in this session and revert to the last manual save state?',
      confirmLabel: 'Revert',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });

    if (!confirmed) return;

    applySceneSnapshot(snapshot.scenes);
    clearHistory();
    await saveMetadata();
    requestAutosave({ type: 'fast', urgency: 'immediate', reason: 'revert' });
    requestAutosave({ type: 'slow', urgency: 'immediate', reason: 'revert' });
  };

  const handleRevertToInitialLoad = async () => {
    const snapshot = getSnapshot('initial-load');
    if (!snapshot) {
      await dialogAlert({
        title: 'Revert unavailable',
        message: 'No initial load snapshot is available for this project.',
        variant: 'warning',
        confirmLabel: 'OK',
      });
      return;
    }

    const confirmed = await dialogConfirm({
      title: 'Revert to Opened State',
      message: 'Discard changes made in this session and revert to the state when the project was opened?',
      confirmLabel: 'Revert',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });

    if (!confirmed) return;

    applySceneSnapshot(snapshot.scenes);
    clearHistory();
    await saveMetadata();
    requestAutosave({ type: 'fast', urgency: 'immediate', reason: 'revert-initial-load' });
    requestAutosave({ type: 'slow', urgency: 'immediate', reason: 'revert-initial-load' });
  };

  const handleUndo = async () => {
    try {
      await undo();
    } catch (error) {
      console.error('Undo failed:', error);
    }
  };

  const handleRedo = async () => {
    try {
      await redo();
    } catch (error) {
      console.error('Redo failed:', error);
    }
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <div className="header-logo">
            <Clapperboard size={24} className="logo-icon" />
            <span className="logo-text">AI Scene Manager</span>
          </div>
        </div>

        <div className="header-center">
          <div className="header-title">
            <Clapperboard size={16} />
            <span>{projectName}</span>
          </div>
        </div>

        <div className="header-right">
          <button
            className="header-btn"
            onClick={handleUndo}
            disabled={!canUndo()}
            title="Undo (Ctrl+Z)"
          >
            <Undo size={18} />
          </button>
          <button
            className="header-btn"
            onClick={handleRedo}
            disabled={!canRedo()}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo size={18} />
          </button>
          <button className="header-btn" onClick={handleCloseProject} title="Close Project">
            <X size={18} />
          </button>
          <button className="header-btn" onClick={handleLoadProject} title="Open Project">
            <FolderOpen size={18} />
          </button>
          <button className="header-btn" onClick={handleSaveProject} title="Save Project">
            <Save size={18} />
          </button>
          <button className="header-btn" onClick={handleRevertToManualSave} title="Revert to Last Manual Save">
            <RotateCcw size={18} />
          </button>
          <button className="header-btn" onClick={handleRevertToInitialLoad} title="Revert to Opened State">
            <RotateCcw size={18} />
          </button>
          <button className="header-btn" title="Environment Settings" onClick={onOpenSettings}>
            <MoreVertical size={18} />
          </button>
        </div>
      </header>

      {/* Missing Asset Recovery Dialog */}
      {showRecoveryDialog && pendingProject && (
        <MissingAssetRecoveryModal
          missingAssets={missingAssets}
          vaultPath={pendingProject.vaultPath}
          onComplete={handleRecoveryComplete}
          onCancel={handleRecoveryCancel}
        />
      )}
    </>
  );
}
