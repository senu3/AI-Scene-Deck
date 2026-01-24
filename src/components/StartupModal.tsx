import { useState, useEffect } from 'react';
import { Clapperboard, FolderPlus, FolderOpen, Clock, ChevronRight, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { Scene, Asset, SourcePanelState } from '../types';
import MissingAssetRecoveryModal, { MissingAssetInfo, RecoveryDecision } from './MissingAssetRecoveryModal';
import { importFileToVault } from '../utils/assetPath';
import { extractVideoMetadata, generateVideoThumbnail } from '../utils/videoUtils';
import './StartupModal.css';

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

interface RecentProject {
  name: string;
  path: string;
  date: string;
}

// Pending project data for recovery dialog
interface PendingProject {
  name: string;
  vaultPath: string;
  scenes: Scene[];
  sourcePanelState?: SourcePanelState;
  projectPath: string;
}

export default function StartupModal() {
  const { initializeProject, setRootFolder, initializeSourcePanel, loadMetadata } = useStore();
  const [step, setStep] = useState<'choice' | 'new-project'>('choice');
  const [projectName, setProjectName] = useState('');
  const [vaultPath, setVaultPath] = useState('');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Recovery dialog state
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [missingAssets, setMissingAssets] = useState<MissingAssetInfo[]>([]);
  const [pendingProject, setPendingProject] = useState<PendingProject | null>(null);

  useEffect(() => {
    loadRecentProjects();
  }, []);

  const loadRecentProjects = async () => {
    if (window.electronAPI) {
      const projects = await window.electronAPI.getRecentProjects();

      // Filter out projects that no longer exist
      const validProjects: RecentProject[] = [];
      for (const project of projects) {
        const exists = await window.electronAPI.pathExists(project.path);
        if (exists) {
          validProjects.push(project);
        }
      }

      // Update recent projects if any were removed
      if (validProjects.length !== projects.length) {
        await window.electronAPI.saveRecentProjects(validProjects);
      }

      setRecentProjects(validProjects);
    }
  };

  const handleSelectVault = async () => {
    if (!window.electronAPI) {
      // Demo mode
      setVaultPath('/demo/vault');
      return;
    }

    const path = await window.electronAPI.selectVault();
    if (path) {
      setVaultPath(path);
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim() || !vaultPath) return;

    setIsCreating(true);

    try {
      if (window.electronAPI) {
        // Create vault structure
        const vault = await window.electronAPI.createVault(vaultPath, projectName);
        if (!vault) {
          alert('Failed to create vault folder');
          setIsCreating(false);
          return;
        }

        // Create assets folder for file-based asset sync
        await window.electronAPI.ensureAssetsFolder(vault.path);

        // Initialize project with default 3 scenes
        const defaultScenes = [
          { id: crypto.randomUUID(), name: 'Scene 1', cuts: [] },
          { id: crypto.randomUUID(), name: 'Scene 2', cuts: [] },
          { id: crypto.randomUUID(), name: 'Scene 3', cuts: [] },
        ];

        // Save initial empty project file immediately
        const projectData = JSON.stringify({
          version: 3,
          name: projectName,
          vaultPath: vault.path,
          scenes: defaultScenes,
          sourcePanel: undefined,
          savedAt: new Date().toISOString(),
        });

        const projectFilePath = `${vault.path}/project.sdp`;
        await window.electronAPI.saveProject(projectData, projectFilePath);

        // Update recent projects
        const newRecent: RecentProject = {
          name: projectName,
          path: projectFilePath,
          date: new Date().toISOString(),
        };
        const existingRecent = await window.electronAPI.getRecentProjects();
        await window.electronAPI.saveRecentProjects([newRecent, ...existingRecent.slice(0, 9)]);

        // Initialize project with the scenes we created
        initializeProject({
          name: projectName,
          vaultPath: vault.path,
          scenes: defaultScenes as any,
        });

        // Load metadata store (will be empty for new project)
        await loadMetadata(vault.path);

        // Set root folder to vault
        const structure = await window.electronAPI.getFolderContents(vault.path);
        setRootFolder({
          path: vault.path,
          name: projectName,
          structure,
        });

        // Initialize source panel with default vault assets folder
        await initializeSourcePanel(undefined, vault.path);
      } else {
        // Demo mode
        initializeProject({
          name: projectName,
          vaultPath: '/demo/vault/' + projectName,
        });
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project');
    }

    setIsCreating(false);
  };

  const handleLoadProject = async () => {
    if (!window.electronAPI) {
      // Demo mode - just initialize with demo data
      initializeProject({
        name: 'Demo Project',
        vaultPath: '/demo/vault',
      });
      return;
    }

    const result = await window.electronAPI.loadProject();
    if (result) {
      const { data, path } = result;
      const projectData = data as { name?: string; vaultPath?: string; scenes?: Scene[]; version?: number; sourcePanel?: SourcePanelState };

      // Determine vault path
      const loadedVaultPath = projectData.vaultPath || path.replace(/[/\\]project\.sdp$/, '').replace(/[/\\][^/\\]+\.sdp$/, '');

      // Resolve asset paths (v2+ uses relative paths)
      let scenes = projectData.scenes || [];
      let foundMissingAssets: MissingAssetInfo[] = [];

      if (projectData.version === 2 || projectData.version === 3 || scenes.some(s => s.cuts?.some(c => c.asset?.path?.startsWith('assets/')))) {
        const resolved = await resolveScenesAssets(scenes, loadedVaultPath);
        scenes = resolved.scenes;
        foundMissingAssets = resolved.missingAssets;
      }

      // If there are missing assets, show recovery dialog
      if (foundMissingAssets.length > 0) {
        setMissingAssets(foundMissingAssets);
        setPendingProject({
          name: projectData.name || 'Loaded Project',
          vaultPath: loadedVaultPath,
          scenes,
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
        scenes,
        sourcePanelState: projectData.sourcePanel,
        projectPath: path,
      });
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
                    const thumb = await generateVideoThumbnail(newPath, 0);
                    if (thumb) {
                      thumbnail = thumb;
                    }
                  } else {
                    // Load image as base64 for thumbnail
                    if (window.electronAPI) {
                      const base64 = await window.electronAPI.readFileAsBase64(newPath);
                      if (base64) {
                        thumbnail = base64;
                      }
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
          const newThumbnail = await generateVideoThumbnail(cut.asset.path, cut.inPoint);
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
      scenes: finalScenes as ReturnType<typeof useStore.getState>['scenes'],
    });

    // Load metadata store (audio attachments, etc.)
    await loadMetadata(project.vaultPath);

    // Initialize source panel state
    await initializeSourcePanel(project.sourcePanelState, project.vaultPath);

    // Update recent projects
    const newRecent: RecentProject = {
      name: project.name,
      path: project.projectPath,
      date: new Date().toISOString(),
    };
    const filtered = recentProjects.filter(p => p.path !== project.projectPath);
    const updated = [newRecent, ...filtered.slice(0, 9)];
    setRecentProjects(updated);
    await window.electronAPI?.saveRecentProjects(updated);

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

  const handleOpenRecent = async (project: RecentProject) => {
    if (!window.electronAPI) return;

    const exists = await window.electronAPI.pathExists(project.path);
    if (!exists) {
      alert('Project file not found. It may have been moved or deleted.');
      // Remove from recent
      const filtered = recentProjects.filter(p => p.path !== project.path);
      setRecentProjects(filtered);
      await window.electronAPI.saveRecentProjects(filtered);
      return;
    }

    // Load the project file directly from the specified path
    try {
      const result = await window.electronAPI.loadProjectFromPath(project.path);
      if (result) {
        const { data } = result;
        const projectData = data as { name?: string; vaultPath?: string; scenes?: Scene[]; version?: number; sourcePanel?: SourcePanelState };

        // Determine vault path
        const loadedVaultPath = projectData.vaultPath || project.path.replace(/[/\\]project\.sdp$/, '').replace(/[/\\][^/\\]+\.sdp$/, '');

        // Resolve asset paths (v2+ uses relative paths)
        let scenes = projectData.scenes || [];
        let foundMissingAssets: MissingAssetInfo[] = [];

        if (projectData.version === 2 || projectData.version === 3 || scenes.some(s => s.cuts?.some(c => c.asset?.path?.startsWith('assets/')))) {
          const resolved = await resolveScenesAssets(scenes, loadedVaultPath);
          scenes = resolved.scenes;
          foundMissingAssets = resolved.missingAssets;
        }

        // If there are missing assets, show recovery dialog
        if (foundMissingAssets.length > 0) {
          setMissingAssets(foundMissingAssets);
          setPendingProject({
            name: projectData.name || project.name,
            vaultPath: loadedVaultPath,
            scenes,
            sourcePanelState: projectData.sourcePanel,
            projectPath: project.path,
          });
          setShowRecoveryDialog(true);
          return;
        }

        // No missing assets, proceed directly
        await finalizeProjectLoad({
          name: projectData.name || project.name,
          vaultPath: loadedVaultPath,
          scenes,
          sourcePanelState: projectData.sourcePanel,
          projectPath: project.path,
        });
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      alert('Failed to load project');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  if (step === 'new-project') {
    return (
      <div className="startup-modal">
        <div className="startup-backdrop" />
        <div className="startup-container">
          <button className="back-btn" onClick={() => setStep('choice')}>
            <X size={20} />
          </button>

          <div className="startup-header">
            <Clapperboard size={32} className="logo-icon" />
            <h1>Create New Project</h1>
            <p>Set up a vault folder for your project</p>
          </div>

          <div className="new-project-form">
            <div className="form-group">
              <label>Project Name</label>
              <input
                type="text"
                placeholder="My AI Scene Project"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Vault Location</label>
              <div className="vault-selector">
                <input
                  type="text"
                  placeholder="Select a folder..."
                  value={vaultPath}
                  readOnly
                />
                <button onClick={handleSelectVault}>
                  <FolderOpen size={18} />
                  Browse
                </button>
              </div>
              <p className="form-hint">
                A new folder will be created inside this location for your project files.
              </p>
            </div>

            <button
              className="create-btn"
              onClick={handleCreateProject}
              disabled={!projectName.trim() || !vaultPath || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="startup-modal">
      <div className="startup-backdrop" />
      <div className="startup-container">
        <div className="startup-header">
          <Clapperboard size={48} className="logo-icon" />
          <h1>AI Scene Deck</h1>
          <p>Visual asset management for AI-generated content</p>
        </div>

        <div className="startup-actions">
          <button className="action-card" onClick={() => setStep('new-project')}>
            <FolderPlus size={24} />
            <div className="action-text">
              <span className="action-title">New Project</span>
              <span className="action-desc">Create a new vault and start fresh</span>
            </div>
            <ChevronRight size={20} className="action-arrow" />
          </button>

          <button className="action-card" onClick={handleLoadProject}>
            <FolderOpen size={24} />
            <div className="action-text">
              <span className="action-title">Open Project</span>
              <span className="action-desc">Load an existing .sdp project file</span>
            </div>
            <ChevronRight size={20} className="action-arrow" />
          </button>
        </div>

        {recentProjects.length > 0 && (
          <div className="recent-projects">
            <h3>
              <Clock size={16} />
              Recent Projects
            </h3>
            <div className="recent-list">
              {recentProjects.map((project, index) => (
                <button
                  key={index}
                  className="recent-item"
                  onClick={() => handleOpenRecent(project)}
                >
                  <span className="recent-name">{project.name}</span>
                  <span className="recent-date">{formatDate(project.date)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Missing Asset Recovery Dialog */}
      {showRecoveryDialog && pendingProject && (
        <MissingAssetRecoveryModal
          missingAssets={missingAssets}
          vaultPath={pendingProject.vaultPath}
          onComplete={handleRecoveryComplete}
          onCancel={handleRecoveryCancel}
        />
      )}
    </div>
  );
}
