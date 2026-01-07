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

const electronAPI = {
  selectFolder: (): Promise<FolderSelection | null> =>
    ipcRenderer.invoke('select-folder'),

  getFolderContents: (folderPath: string): Promise<FileItem[]> =>
    ipcRenderer.invoke('get-folder-contents', folderPath),

  getFileInfo: (filePath: string): Promise<FileInfo | null> =>
    ipcRenderer.invoke('get-file-info', filePath),

  readFileAsBase64: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('read-file-as-base64', filePath),

  saveProject: (projectData: string): Promise<boolean> =>
    ipcRenderer.invoke('save-project', projectData),

  loadProject: (): Promise<unknown> =>
    ipcRenderer.invoke('load-project'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
