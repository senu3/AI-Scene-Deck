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

interface ElectronAPI {
  selectFolder: () => Promise<FolderSelection | null>;
  getFolderContents: (folderPath: string) => Promise<FileItem[]>;
  getFileInfo: (filePath: string) => Promise<FileInfo | null>;
  readFileAsBase64: (filePath: string) => Promise<string | null>;
  saveProject: (projectData: string) => Promise<boolean>;
  loadProject: () => Promise<unknown>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
