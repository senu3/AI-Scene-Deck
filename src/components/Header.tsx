import { Clapperboard, FolderOpen, Save, MoreVertical, Undo, Redo } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useHistoryStore } from '../store/historyStore';
import './Header.css';

export default function Header() {
  const { scenes, loadProject, clearProject } = useStore();
  const { undo, redo, canUndo, canRedo } = useHistoryStore();

  const handleSaveProject = async () => {
    if (!window.electronAPI) {
      alert('File system access is only available in the desktop app.');
      return;
    }

    const projectData = JSON.stringify({
      version: '1.0',
      scenes: scenes,
      savedAt: new Date().toISOString(),
    });

    const success = await window.electronAPI.saveProject(projectData);
    if (success) {
      alert('Project saved successfully!');
    }
  };

  const handleLoadProject = async () => {
    if (!window.electronAPI) {
      alert('File system access is only available in the desktop app.');
      return;
    }

    const data = await window.electronAPI.loadProject();
    if (data && typeof data === 'object' && 'scenes' in data) {
      loadProject((data as { scenes: typeof scenes }).scenes);
    }
  };

  const handleNewProject = () => {
    if (confirm('Create a new project? Any unsaved changes will be lost.')) {
      clearProject();
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
          <FolderOpen size={16} />
          <span>TIMELINE / WORKSPACE</span>
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
        <button className="header-btn" onClick={handleNewProject} title="New Project">
          <FolderOpen size={18} />
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
