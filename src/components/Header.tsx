import { Clapperboard, FolderOpen, Save, MoreVertical, Undo, Redo, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useHistoryStore } from '../store/historyStore';
import type { Scene, Asset, SourcePanelState } from '../types';
import './Header.css';

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

export default function Header() {
  const { scenes, vaultPath, clearProject, projectName, setProjectLoaded, initializeProject, getSourcePanelState, initializeSourcePanel } = useStore();
  const { undo, redo, canUndo, canRedo } = useHistoryStore();

  const handleSaveProject = async () => {
    if (!window.electronAPI) {
      alert('File system access is only available in the desktop app.');
      return;
    }

    // Prepare scenes with relative paths for portability
    const scenesToSave = prepareScenesForSave(scenes);

    // Get source panel state for saving
    const sourcePanelState = getSourcePanelState();

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

      initializeProject({
        name: projectData.name || 'Loaded Project',
        vaultPath: loadedVaultPath,
        scenes: projectData.scenes || [],
      });

      // Initialize source panel state
      await initializeSourcePanel(projectData.sourcePanel, loadedVaultPath);

      // Update recent projects
      const recentProjects = await window.electronAPI.getRecentProjects();
      const newRecent = {
        name: projectData.name || 'Loaded Project',
        path,
        date: new Date().toISOString(),
      };
      const filtered = recentProjects.filter((p: any) => p.path !== path);
      await window.electronAPI.saveRecentProjects([newRecent, ...filtered.slice(0, 9)]);
    }
  };

  const handleCloseProject = () => {
    if (confirm('Close project? Any unsaved changes will be lost.')) {
      clearProject();
      setProjectLoaded(false);
    }
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
        <button className="header-btn" title="More Options">
          <MoreVertical size={18} />
        </button>
      </div>
    </header>
  );
}
