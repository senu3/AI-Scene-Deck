import { Clapperboard, FolderOpen, Save, MoreVertical, Undo, Redo, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useHistoryStore } from '../store/historyStore';
import MissingAssetRecoveryModal from './MissingAssetRecoveryModal';
import { useHeaderProjectController } from '../hooks/useHeaderProjectController';
import './Header.css';

interface HeaderProps {
  onOpenSettings?: () => void;
}

export default function Header({ onOpenSettings }: HeaderProps) {
  const { projectName } = useStore();
  const { undo, redo, canUndo, canRedo } = useHistoryStore();
  const {
    handleSaveProject,
    handleLoadProject,
    handleCloseProject,
    showRecoveryDialog,
    missingAssets,
    pendingProject,
    handleRecoveryComplete,
    handleRecoveryCancel,
  } = useHeaderProjectController();

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
