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

export interface Asset {
  id: string;
  name: string;
  path: string;
  type: 'image' | 'video';
  thumbnail?: string;
  duration?: number;
  metadata?: ImageMetadata;
  fileSize?: number;
}

export interface Cut {
  id: string;
  assetId: string;
  asset?: Asset;
  displayTime: number;
  order: number;
}

export interface SceneNote {
  id: string;
  type: 'text' | 'image';
  content: string; // For text: the text content, for image: the path
  createdAt: string;
}

export interface Scene {
  id: string;
  name: string;
  cuts: Cut[];
  order: number;
  notes: SceneNote[];
  folderPath?: string; // Path to scene folder in vault
}

export interface Project {
  id: string;
  name: string;
  vaultPath: string;
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
}

export interface FavoriteFolder {
  path: string;
  name: string;
}

export type PlaybackMode = 'stopped' | 'playing' | 'paused';
export type PreviewMode = 'scene' | 'all';
export type SelectionType = 'scene' | 'cut' | null;
