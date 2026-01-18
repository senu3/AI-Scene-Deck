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

export interface AssetIndexEntry {
  id: string;
  hash: string;
  filename: string;
  originalName: string;
  originalPath: string;
  type: 'image' | 'video';
  fileSize: number;
  importedAt: string;
}

export interface AssetIndex {
  version: number;
  assets: AssetIndexEntry[];
}

export interface VaultImportResult {
  success: boolean;
  vaultPath?: string;
  relativePath?: string;
  hash?: string;
  isDuplicate?: boolean;
  error?: string;
}

export interface VaultVerifyResult {
  valid: boolean;
  missing: string[];
  orphaned: string[];
  error?: string;
}

export interface PathResolveResult {
  absolutePath: string | null;
  exists: boolean;
  error?: string;
}

export interface FinalizeClipOptions {
  sourcePath: string;
  outputPath: string;
  inPoint: number;
  outPoint: number;
}

export interface FinalizeClipResult {
  success: boolean;
  outputPath?: string;
  fileSize?: number;
  error?: string;
}

export interface ExtractFrameOptions {
  sourcePath: string;
  outputPath: string;
  timestamp: number;
}

export interface ExtractFrameResult {
  success: boolean;
  outputPath?: string;
  fileSize?: number;
  error?: string;
}

export interface SequenceItem {
  type: 'image' | 'video';
  path: string;
  duration: number;
  inPoint?: number;
  outPoint?: number;
}

export interface ExportSequenceOptions {
  items: SequenceItem[];
  outputPath: string;
  width: number;
  height: number;
  fps: number;
}

export interface ExportSequenceResult {
  success: boolean;
  outputPath?: string;
  fileSize?: number;
  error?: string;
}

export interface RecentProject {
  name: string;
  path: string;
  date: string;
}

export interface OpenFileDialogOptions {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  defaultPath?: string;
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

  // Video metadata
  getVideoMetadata: (filePath: string): Promise<{ path: string; fileSize: number; format: string } | null> =>
    ipcRenderer.invoke('get-video-metadata', filePath),

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

  // File dialog
  showOpenFileDialog: (options?: OpenFileDialogOptions): Promise<string | null> =>
    ipcRenderer.invoke('show-open-file-dialog', options || {}),

  // Project operations
  saveProject: (projectData: string, projectPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('save-project', projectData, projectPath),

  loadProject: (): Promise<{ data: unknown; path: string } | null> =>
    ipcRenderer.invoke('load-project'),

  loadProjectFromPath: (projectPath: string): Promise<{ data: unknown; path: string } | null> =>
    ipcRenderer.invoke('load-project-from-path', projectPath),

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

  // Vault asset sync operations
  calculateFileHash: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('calculate-file-hash', filePath),

  ensureAssetsFolder: (vaultPath: string): Promise<string | null> =>
    ipcRenderer.invoke('ensure-assets-folder', vaultPath),

  loadAssetIndex: (vaultPath: string): Promise<AssetIndex> =>
    ipcRenderer.invoke('load-asset-index', vaultPath),

  saveAssetIndex: (vaultPath: string, index: AssetIndex): Promise<boolean> =>
    ipcRenderer.invoke('save-asset-index', vaultPath, index),

  importAssetToVault: (sourcePath: string, vaultPath: string, assetId: string): Promise<VaultImportResult> =>
    ipcRenderer.invoke('import-asset-to-vault', sourcePath, vaultPath, assetId),

  verifyVaultAssets: (vaultPath: string): Promise<VaultVerifyResult> =>
    ipcRenderer.invoke('verify-vault-assets', vaultPath),

  resolveVaultPath: (vaultPath: string, relativePath: string): Promise<PathResolveResult> =>
    ipcRenderer.invoke('resolve-vault-path', vaultPath, relativePath),

  getRelativePath: (vaultPath: string, absolutePath: string): Promise<string | null> =>
    ipcRenderer.invoke('get-relative-path', vaultPath, absolutePath),

  isPathInVault: (vaultPath: string, checkPath: string): Promise<boolean> =>
    ipcRenderer.invoke('is-path-in-vault', vaultPath, checkPath),

  // Video clip finalization
  showSaveClipDialog: (defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('show-save-clip-dialog', defaultName),

  finalizeClip: (options: FinalizeClipOptions): Promise<FinalizeClipResult> =>
    ipcRenderer.invoke('finalize-clip', options),

  // Video frame extraction
  extractVideoFrame: (options: ExtractFrameOptions): Promise<ExtractFrameResult> =>
    ipcRenderer.invoke('extract-video-frame', options),

  // Sequence export
  showSaveSequenceDialog: (defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('show-save-sequence-dialog', defaultName),

  exportSequence: (options: ExportSequenceOptions): Promise<ExportSequenceResult> =>
    ipcRenderer.invoke('export-sequence', options),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
