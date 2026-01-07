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

export interface Asset {
  id: string;
  name: string;
  path: string;
  type: 'image' | 'video';
  thumbnail?: string;
  duration?: number; // For videos, in seconds
}

export interface Cut {
  id: string;
  assetId: string;
  asset?: Asset;
  displayTime: number; // Display time in seconds
  order: number;
}

export interface Scene {
  id: string;
  name: string;
  cuts: Cut[];
  order: number;
}

export interface Project {
  id: string;
  name: string;
  scenes: Scene[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FavoriteFolder {
  path: string;
  name: string;
}

export type PlaybackMode = 'stopped' | 'playing' | 'paused';
export type PreviewMode = 'scene' | 'all';
