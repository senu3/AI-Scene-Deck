/// <reference types="vite/client" />

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileItem[];
}

interface FolderSelection {
  path: string;
  name: string;
  structure: FileItem[];
}

interface FileInfo {
  name: string;
  path: string;
  size: number;
  modified: Date;
  type: 'image' | 'video' | null;
  extension: string;
}

interface ImageMetadata {
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

interface VaultInfo {
  path: string;
  trashPath: string;
  configPath: string;
}

interface RecentProject {
  name: string;
  path: string;
  date: string;
}

interface ElectronAPI {
  // Folder operations
  selectFolder: () => Promise<FolderSelection | null>;
  getFolderContents: (folderPath: string) => Promise<FileItem[]>;
  getFileInfo: (filePath: string) => Promise<FileInfo | null>;
  readFileAsBase64: (filePath: string) => Promise<string | null>;

  // Image metadata
  readImageMetadata: (filePath: string) => Promise<ImageMetadata | null>;

  // Vault operations
  selectVault: () => Promise<string | null>;
  createVault: (vaultPath: string, projectName: string) => Promise<VaultInfo | null>;
  createSceneFolder: (vaultPath: string, sceneName: string) => Promise<string | null>;

  // File operations
  moveToVault: (sourcePath: string, destFolder: string, newName?: string) => Promise<string | null>;
  moveToTrash: (filePath: string, trashPath: string) => Promise<string | null>;
  pathExists: (path: string) => Promise<boolean>;

  // Project operations
  saveProject: (projectData: string, projectPath?: string) => Promise<string | null>;
  loadProject: () => Promise<{ data: unknown; path: string } | null>;

  // Recent projects
  getRecentProjects: () => Promise<RecentProject[]>;
  saveRecentProjects: (projects: RecentProject[]) => Promise<boolean>;

  // Scene notes
  saveSceneNotes: (scenePath: string, notes: string) => Promise<boolean>;
  loadSceneNotes: (scenePath: string) => Promise<unknown[]>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
