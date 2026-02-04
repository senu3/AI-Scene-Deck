import { useCallback, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../store/useStore';
import { useDialog } from '../ui';
import type { Scene, Asset, SourcePanelState, AssetUsageRef } from '../types';
import type { MissingAssetInfo, RecoveryDecision } from '../components/MissingAssetRecoveryModal';
import { importFileToVault } from '../utils/assetPath';
import { extractVideoMetadata } from '../utils/videoUtils';
import { getThumbnail } from '../utils/thumbnailCache';
import { createAutosaveController, subscribeProjectChanges } from '../utils/autosave';

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

// Convert assets to use relative paths for saving
function prepareAssetForSave(asset: Asset): Asset {
  if (asset.vaultRelativePath) {
    return {
      ...asset,
      // Store relative path as the main path for portability
      path: asset.vaultRelativePath,
    };
  }
  return asset;
}

// Prepare scenes for saving (convert to relative paths)
function prepareScenesForSave(scenes: Scene[]): Scene[] {
  return scenes.map(scene => ({
    ...scene,
    cuts: scene.cuts.map(cut => ({
      ...cut,
      asset: cut.asset ? prepareAssetForSave(cut.asset) : undefined,
    })),
  }));
}

function getOrderedAssetIdsFromScenes(scenes: Scene[]): string[] {
  const orderedIds: string[] = [];
  const seen = new Set<string>();

  for (const scene of scenes) {
    const cuts = [...scene.cuts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const cut of cuts) {
      const assetId = cut.asset?.id || cut.assetId;
      if (assetId && !seen.has(assetId)) {
        seen.add(assetId);
        orderedIds.push(assetId);
      }
    }
  }

  return orderedIds;
}

function buildAssetUsageRefs(scenes: Scene[]): Map<string, AssetUsageRef[]> {
  const usageMap = new Map<string, AssetUsageRef[]>();
  const orderedScenes = [...scenes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const scene of orderedScenes) {
    const sceneOrder = scene.order ?? 0;
    const cuts = [...scene.cuts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    cuts.forEach((cut, index) => {
      const assetId = cut.asset?.id || cut.assetId;
      if (!assetId) return;
      const ref: AssetUsageRef = {
        sceneId: scene.id,
        sceneName: scene.name,
        sceneOrder,
        cutId: cut.id,
        cutOrder: cut.order ?? index,
        cutIndex: index + 1,
      };
      const existing = usageMap.get(assetId) || [];
      existing.push(ref);
      usageMap.set(assetId, existing);
    });
  }

  return usageMap;
}

function ensureSceneIds(scenes: Scene[]): { scenes: Scene[]; missingCount: number } {
  let missingCount = 0;
  const updatedScenes = scenes.map((scene) => {
    if (typeof scene.id === 'string' && scene.id.trim().length > 0) return scene;
    missingCount += 1;
    return { ...scene, id: uuidv4() };
  });

  return { scenes: updatedScenes, missingCount };
}

export function useHeaderProjectController() {
  const {
    projectLoaded,
    scenes,
    vaultPath,
    clearProject,
    projectName,
    setProjectLoaded,
    initializeProject,
    getSourcePanelState,
    initializeSourcePanel,
    loadMetadata,
    loadProject,
  } = useStore();
  const { alert: dialogAlert } = useDialog();

  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [missingAssets, setMissingAssets] = useState<MissingAssetInfo[]>([]);
  const [pendingProject, setPendingProject] = useState<PendingProject | null>(null);

  const saveProjectInternal = useCallback(async (options?: { notify?: boolean; updateRecent?: boolean; allowPrompt?: boolean }) => {
    if (!window.electronAPI) {
      if (options?.notify !== false) {
        window.alert('File system access is only available in the desktop app.');
      }
      return;
    }

    const { scenes: normalizedScenes, missingCount } = ensureSceneIds(scenes);
    if (missingCount > 0) {
      if (options?.allowPrompt !== false) {
        await dialogAlert({
          title: 'Scene ID の自動付与',
          message: `Scene ID が未設定のシーンが ${missingCount} 件あります。OK を押すと自動付与して保存を続行します。`,
          variant: 'warning',
          confirmLabel: 'OK',
        });
      }
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
      if (options?.notify !== false) {
        alert('Project saved successfully!');
      }

      if (options?.updateRecent !== false) {
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
    }
  }, [dialogAlert, getSourcePanelState, loadProject, projectName, scenes, vaultPath]);

  const handleSaveProject = useCallback(async () => {
    await saveProjectInternal();
  }, [saveProjectInternal]);

  const handleAutosaveProject = useCallback(async () => {
    if (!vaultPath) return;
    await saveProjectInternal({ notify: false, updateRecent: false, allowPrompt: false });
  }, [saveProjectInternal, vaultPath]);

  const finalizeProjectLoad = useCallback(async (project: PendingProject, recoveryDecisions?: RecoveryDecision[]) => {
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
  }, [initializeProject, initializeSourcePanel, loadMetadata]);

  const handleRecoveryComplete = useCallback(async (decisions: RecoveryDecision[]) => {
    if (!pendingProject) return;
    await finalizeProjectLoad(pendingProject, decisions);
  }, [finalizeProjectLoad, pendingProject]);

  const handleRecoveryCancel = useCallback(() => {
    setShowRecoveryDialog(false);
    setPendingProject(null);
    setMissingAssets([]);
  }, []);

  const handleLoadProject = useCallback(async () => {
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
  }, [finalizeProjectLoad]);

  const handleCloseProject = useCallback(() => {
    if (confirm('Close project? Any unsaved changes will be lost.')) {
      clearProject();
      setProjectLoaded(false);
    }
  }, [clearProject, setProjectLoaded]);

  useEffect(() => {
    if (!projectLoaded) return;
    const controller = createAutosaveController({
      debounceMs: 1000,
      save: handleAutosaveProject,
      onError: (error) => {
        console.error('Autosave failed:', error);
      },
    });
    const unsubscribe = subscribeProjectChanges(useStore, () => controller.schedule());
    return () => unsubscribe();
  }, [projectLoaded, handleAutosaveProject]);

  return {
    handleSaveProject,
    handleLoadProject,
    handleCloseProject,
    showRecoveryDialog,
    missingAssets,
    pendingProject,
    handleRecoveryComplete,
    handleRecoveryCancel,
  };
}
