import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#1a1d21',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    frame: process.platform !== 'darwin',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers for file system operations

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileItem[];
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
}

function getMediaType(filename: string): 'image' | 'video' | null {
  const ext = path.extname(filename).toLowerCase();
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
  const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  return null;
}

function scanDirectory(dirPath: string, depth: number = 0, maxDepth: number = 5): FileItem[] {
  if (depth > maxDepth) return [];

  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const result: FileItem[] = [];

    for (const item of items) {
      if (item.name.startsWith('.')) continue;

      const fullPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        result.push({
          name: item.name,
          path: fullPath,
          isDirectory: true,
          children: scanDirectory(fullPath, depth + 1, maxDepth),
        });
      } else if (getMediaType(item.name)) {
        result.push({
          name: item.name,
          path: fullPath,
          isDirectory: false,
        });
      }
    }

    return result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

// Parse PNG metadata for AI generation parameters
function parsePngMetadata(buffer: Buffer): ImageMetadata {
  const metadata: ImageMetadata = {};

  try {
    // PNG signature check
    if (buffer.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      return metadata;
    }

    let offset = 8;
    while (offset < buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.slice(offset + 4, offset + 8).toString('ascii');

      if (type === 'IHDR') {
        metadata.width = buffer.readUInt32BE(offset + 8);
        metadata.height = buffer.readUInt32BE(offset + 12);
      }

      if (type === 'tEXt' || type === 'iTXt') {
        const data = buffer.slice(offset + 8, offset + 8 + length);
        const nullIndex = data.indexOf(0);
        if (nullIndex > 0) {
          const key = data.slice(0, nullIndex).toString('ascii');
          let value = '';

          if (type === 'tEXt') {
            value = data.slice(nullIndex + 1).toString('utf-8');
          } else {
            // iTXt has more complex structure
            const rest = data.slice(nullIndex + 1);
            const compressionFlag = rest[0];
            if (compressionFlag === 0) {
              // Find the text after null terminators
              let textStart = 1;
              for (let i = 1; i < rest.length && textStart < rest.length; i++) {
                if (rest[i] === 0) textStart = i + 1;
              }
              value = rest.slice(textStart).toString('utf-8');
            }
          }

          // Common keys used by AI image generators
          if (key === 'parameters' || key === 'prompt') {
            // Parse A1111/ComfyUI style parameters
            const lines = value.split('\n');
            for (const line of lines) {
              if (line.startsWith('Negative prompt:')) {
                metadata.negativePrompt = line.replace('Negative prompt:', '').trim();
              } else if (line.includes('Steps:')) {
                const match = line.match(/Steps:\s*(\d+)/);
                if (match) metadata.steps = parseInt(match[1]);
                const seedMatch = line.match(/Seed:\s*(\d+)/);
                if (seedMatch) metadata.seed = parseInt(seedMatch[1]);
                const samplerMatch = line.match(/Sampler:\s*([^,]+)/);
                if (samplerMatch) metadata.sampler = samplerMatch[1].trim();
                const cfgMatch = line.match(/CFG scale:\s*([\d.]+)/);
                if (cfgMatch) metadata.cfg = parseFloat(cfgMatch[1]);
                const modelMatch = line.match(/Model:\s*([^,]+)/);
                if (modelMatch) metadata.model = modelMatch[1].trim();
              } else if (!metadata.prompt && line.trim()) {
                metadata.prompt = line.trim();
              }
            }
          } else if (key === 'Description' || key === 'Comment') {
            if (!metadata.prompt) {
              try {
                const json = JSON.parse(value);
                if (json.prompt) metadata.prompt = json.prompt;
                if (json.negative_prompt) metadata.negativePrompt = json.negative_prompt;
              } catch {
                metadata.prompt = value;
              }
            }
          } else if (key === 'Software') {
            metadata.software = value;
          }
        }
      }

      if (type === 'IEND') break;
      offset += 12 + length;
    }
  } catch {
    // Ignore parsing errors
  }

  return metadata;
}

// Parse JPEG EXIF/XMP for metadata
function parseJpegMetadata(buffer: Buffer): ImageMetadata {
  const metadata: ImageMetadata = {};

  try {
    // Look for XMP data
    const xmpMarker = buffer.indexOf('http://ns.adobe.com/xap/1.0/');
    if (xmpMarker > 0) {
      const xmpEnd = buffer.indexOf('<?xpacket end', xmpMarker);
      if (xmpEnd > xmpMarker) {
        const xmpData = buffer.slice(xmpMarker, xmpEnd).toString('utf-8');

        // Simple extraction of description
        const descMatch = xmpData.match(/<dc:description[^>]*>[\s\S]*?<rdf:li[^>]*>([^<]+)/);
        if (descMatch) {
          metadata.prompt = descMatch[1].trim();
        }
      }
    }

    // Try to find dimensions from SOF markers
    let offset = 2;
    while (offset < buffer.length - 10) {
      if (buffer[offset] === 0xff) {
        const marker = buffer[offset + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          metadata.height = buffer.readUInt16BE(offset + 5);
          metadata.width = buffer.readUInt16BE(offset + 7);
          break;
        }
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      } else {
        offset++;
      }
    }
  } catch {
    // Ignore parsing errors
  }

  return metadata;
}

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const folderPath = result.filePaths[0];
  const structure = scanDirectory(folderPath);

  return {
    path: folderPath,
    name: path.basename(folderPath),
    structure,
  };
});

ipcMain.handle('get-folder-contents', async (_, folderPath: string) => {
  return scanDirectory(folderPath);
});

ipcMain.handle('get-file-info', async (_, filePath: string) => {
  try {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    return {
      name: path.basename(filePath),
      path: filePath,
      size: stats.size,
      modified: stats.mtime,
      type: getMediaType(path.basename(filePath)),
      extension: ext,
    };
  } catch {
    return null;
  }
});

ipcMain.handle('read-file-as-base64', async (_, filePath: string) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
});

// Read image metadata
ipcMain.handle('read-image-metadata', async (_, filePath: string) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const stats = fs.statSync(filePath);

    let metadata: ImageMetadata = {};

    if (ext === '.png') {
      metadata = parsePngMetadata(buffer);
    } else if (ext === '.jpg' || ext === '.jpeg') {
      metadata = parseJpegMetadata(buffer);
    }

    metadata.format = ext.replace('.', '').toUpperCase();

    return {
      ...metadata,
      fileSize: stats.size,
    };
  } catch {
    return null;
  }
});

// Create vault folder structure
ipcMain.handle('create-vault', async (_, vaultPath: string, projectName: string) => {
  try {
    const projectPath = path.join(vaultPath, projectName);

    // Create main project folder
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    // Create trash folder
    const trashPath = path.join(projectPath, '.trash');
    if (!fs.existsSync(trashPath)) {
      fs.mkdirSync(trashPath);
    }

    // Create project config file
    const configPath = path.join(projectPath, 'project.json');
    const config = {
      name: projectName,
      createdAt: new Date().toISOString(),
      version: '1.0',
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    return {
      path: projectPath,
      trashPath,
      configPath,
    };
  } catch (error) {
    console.error('Failed to create vault:', error);
    return null;
  }
});

// Select or create vault folder
ipcMain.handle('select-vault', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select or Create Vault Folder',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// Create scene folder in vault
ipcMain.handle('create-scene-folder', async (_, vaultPath: string, sceneName: string) => {
  try {
    // Sanitize scene name for folder
    const safeName = sceneName.replace(/[<>:"/\\|?*]/g, '_');
    const scenePath = path.join(vaultPath, safeName);

    if (!fs.existsSync(scenePath)) {
      fs.mkdirSync(scenePath, { recursive: true });
    }

    return scenePath;
  } catch {
    return null;
  }
});

// Move file to vault
ipcMain.handle('move-to-vault', async (_, sourcePath: string, destFolder: string, newName?: string) => {
  try {
    const fileName = newName || path.basename(sourcePath);
    let destPath = path.join(destFolder, fileName);

    // Handle duplicate names
    let counter = 1;
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    while (fs.existsSync(destPath)) {
      destPath = path.join(destFolder, `${baseName}_${counter}${ext}`);
      counter++;
    }

    // Copy then delete (safer than move for cross-device)
    fs.copyFileSync(sourcePath, destPath);

    return destPath;
  } catch (error) {
    console.error('Failed to move file:', error);
    return null;
  }
});

// Move file to trash folder
ipcMain.handle('move-to-trash', async (_, filePath: string, trashPath: string) => {
  try {
    const fileName = path.basename(filePath);
    let destPath = path.join(trashPath, fileName);

    // Handle duplicate names
    let counter = 1;
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    while (fs.existsSync(destPath)) {
      destPath = path.join(trashPath, `${baseName}_${counter}${ext}`);
      counter++;
    }

    fs.renameSync(filePath, destPath);
    return destPath;
  } catch (error) {
    console.error('Failed to move to trash:', error);
    return null;
  }
});

// Save project data
ipcMain.handle('save-project', async (_, projectData: string, projectPath?: string) => {
  let savePath = projectPath;

  if (!savePath) {
    const result = await dialog.showSaveDialog(mainWindow!, {
      filters: [{ name: 'Scene Deck Project', extensions: ['sdp'] }],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }
    savePath = result.filePath;
  }

  try {
    fs.writeFileSync(savePath, projectData, 'utf-8');
    return savePath;
  } catch {
    return null;
  }
});

// Load project data
ipcMain.handle('load-project', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    filters: [{ name: 'Scene Deck Project', extensions: ['sdp'] }],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  try {
    const data = fs.readFileSync(result.filePaths[0], 'utf-8');
    return {
      data: JSON.parse(data),
      path: result.filePaths[0],
    };
  } catch {
    return null;
  }
});

// Check if path exists
ipcMain.handle('path-exists', async (_, checkPath: string) => {
  return fs.existsSync(checkPath);
});

// Get recent projects (from app data)
ipcMain.handle('get-recent-projects', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const recentPath = path.join(userDataPath, 'recent-projects.json');

    if (fs.existsSync(recentPath)) {
      const data = fs.readFileSync(recentPath, 'utf-8');
      return JSON.parse(data);
    }
    return [];
  } catch {
    return [];
  }
});

// Save recent projects
ipcMain.handle('save-recent-projects', async (_, projects: Array<{ name: string; path: string; date: string }>) => {
  try {
    const userDataPath = app.getPath('userData');
    const recentPath = path.join(userDataPath, 'recent-projects.json');
    fs.writeFileSync(recentPath, JSON.stringify(projects.slice(0, 10), null, 2));
    return true;
  } catch {
    return false;
  }
});

// Save scene notes
ipcMain.handle('save-scene-notes', async (_, scenePath: string, notes: string) => {
  try {
    const notesPath = path.join(scenePath, '.notes.json');
    fs.writeFileSync(notesPath, notes, 'utf-8');
    return true;
  } catch {
    return false;
  }
});

// Load scene notes
ipcMain.handle('load-scene-notes', async (_, scenePath: string) => {
  try {
    const notesPath = path.join(scenePath, '.notes.json');
    if (fs.existsSync(notesPath)) {
      const data = fs.readFileSync(notesPath, 'utf-8');
      return JSON.parse(data);
    }
    return [];
  } catch {
    return [];
  }
});
