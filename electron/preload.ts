import { contextBridge, ipcRenderer } from 'electron';

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileItem[];
}

export interface FolderSelection {
  path: string;
  name: string;
  structure: FileItem[];
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  modified: Date;
  type: 'image' | 'video' | null;
  extension: string;
}

export interface ImageMetadata {
  width?: number;
  height?: number;
  format?: string;
  prompt?: string;
  negativePrompt?: string;
  model?: string;
  seed?: number;
  steps?: number;
  sampler?: string;
  cfg?: number;
  software?: string;
  fileSize?: number;
}

export interface VaultInfo {
  path: string;
  trashPath: string;
  configPath: string;
}

export interface RecentProject {
  name: string;
  path: string;
  date: string;
}

const electronAPI = {
  // Folder operations
  selectFolder: (): Promise<FolderSelection | null> =>
    ipcRenderer.invoke('select-folder'),

  getFolderContents: (folderPath: string): Promise<FileItem[]> =>
    ipcRenderer.invoke('get-folder-contents', folderPath),

  getFileInfo: (filePath: string): Promise<FileInfo | null> =>
    ipcRenderer.invoke('get-file-info', filePath),

  readFileAsBase64: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('read-file-as-base64', filePath),

  // Image metadata
  readImageMetadata: (filePath: string): Promise<ImageMetadata | null> =>
    ipcRenderer.invoke('read-image-metadata', filePath),

  // Vault operations
  selectVault: (): Promise<string | null> =>
    ipcRenderer.invoke('select-vault'),

  createVault: (vaultPath: string, projectName: string): Promise<VaultInfo | null> =>
    ipcRenderer.invoke('create-vault', vaultPath, projectName),

  createSceneFolder: (vaultPath: string, sceneName: string): Promise<string | null> =>
    ipcRenderer.invoke('create-scene-folder', vaultPath, sceneName),

  // File operations
  moveToVault: (sourcePath: string, destFolder: string, newName?: string): Promise<string | null> =>
    ipcRenderer.invoke('move-to-vault', sourcePath, destFolder, newName),

  moveToTrash: (filePath: string, trashPath: string): Promise<string | null> =>
    ipcRenderer.invoke('move-to-trash', filePath, trashPath),

  pathExists: (path: string): Promise<boolean> =>
    ipcRenderer.invoke('path-exists', path),

  // Project operations
  saveProject: (projectData: string, projectPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('save-project', projectData, projectPath),

  loadProject: (): Promise<{ data: unknown; path: string } | null> =>
    ipcRenderer.invoke('load-project'),

  // Recent projects
  getRecentProjects: (): Promise<RecentProject[]> =>
    ipcRenderer.invoke('get-recent-projects'),

  saveRecentProjects: (projects: RecentProject[]): Promise<boolean> =>
    ipcRenderer.invoke('save-recent-projects', projects),

  // Scene notes
  saveSceneNotes: (scenePath: string, notes: string): Promise<boolean> =>
    ipcRenderer.invoke('save-scene-notes', scenePath, notes),

  loadSceneNotes: (scenePath: string): Promise<unknown[]> =>
    ipcRenderer.invoke('load-scene-notes', scenePath),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
