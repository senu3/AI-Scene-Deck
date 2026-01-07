import { useState, useEffect } from 'react';
import { Clapperboard, FolderPlus, FolderOpen, Clock, ChevronRight, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import './StartupModal.css';

interface RecentProject {
  name: string;
  path: string;
  date: string;
}

export default function StartupModal() {
  const { initializeProject, setRootFolder } = useStore();
  const [step, setStep] = useState<'choice' | 'new-project'>('choice');
  const [projectName, setProjectName] = useState('');
  const [vaultPath, setVaultPath] = useState('');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadRecentProjects();
  }, []);

  const loadRecentProjects = async () => {
    if (window.electronAPI) {
      const projects = await window.electronAPI.getRecentProjects();
      setRecentProjects(projects);
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

        // Initialize project
        initializeProject({
          name: projectName,
          vaultPath: vault.path,
        });

        // Set root folder to vault
        const structure = await window.electronAPI.getFolderContents(vault.path);
        setRootFolder({
          path: vault.path,
          name: projectName,
          structure,
        });

        // Save to recent projects
        const newRecent: RecentProject = {
          name: projectName,
          path: `${vault.path}/project.sdp`,
          date: new Date().toISOString(),
        };
        await window.electronAPI.saveRecentProjects([newRecent, ...recentProjects.slice(0, 9)]);
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
      const projectData = data as { name?: string; vaultPath?: string; scenes?: unknown[] };

      initializeProject({
        name: projectData.name || 'Loaded Project',
        vaultPath: projectData.vaultPath || path.replace('/project.sdp', ''),
        scenes: projectData.scenes as ReturnType<typeof useStore.getState>['scenes'],
      });

      // Update recent projects
      const newRecent: RecentProject = {
        name: projectData.name || 'Loaded Project',
        path,
        date: new Date().toISOString(),
      };
      const filtered = recentProjects.filter(p => p.path !== path);
      await window.electronAPI.saveRecentProjects([newRecent, ...filtered.slice(0, 9)]);
    }
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

    // Load the project file directly
    try {
      const result = await window.electronAPI.loadProject();
      if (result) {
        const { data } = result;
        const projectData = data as { name?: string; vaultPath?: string; scenes?: unknown[] };

        initializeProject({
          name: projectData.name || project.name,
          vaultPath: projectData.vaultPath || project.path.replace('/project.sdp', ''),
          scenes: projectData.scenes as ReturnType<typeof useStore.getState>['scenes'],
        });
      }
    } catch {
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
    </div>
  );
}
