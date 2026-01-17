import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { pathToFileURL } from 'url';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

// Register custom scheme as privileged BEFORE app is ready
// This MUST be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      bypassCSP: true,
      supportFetchAPI: true,
      standard: true,
      secure: true,
      corsEnabled: true,
      stream: true,
      allowServiceWorkers: false
    }
  }
]);

// Register custom protocol for local file access
function registerMediaProtocol() {
  protocol.handle('media', (request) => {
    // Simply replace media:// with file:// and let net.fetch handle the rest
    // Do NOT use decodeURIComponent - it breaks the URL
    const fileUrl = request.url.replace('media://', 'file://');
    console.log('[Protocol] Fetching:', fileUrl);
    return net.fetch(fileUrl);
  });
}

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
      // TEMPORARY: Disable web security for development to allow local file access
      // TODO: Fix custom protocol implementation before release
      webSecurity: false,
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

app.whenReady().then(() => {
  // Register custom protocol before creating window
  registerMediaProtocol();
  createWindow();
});

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

// Get video metadata (duration, dimensions)
// Returns the file path so renderer can load it in a video element to extract metadata
ipcMain.handle('get-video-metadata', async (_, filePath: string) => {
  try {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    return {
      path: filePath,
      fileSize: stats.size,
      format: ext.replace('.', '').toUpperCase(),
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

// Load project from specific path (for recent projects)
ipcMain.handle('load-project-from-path', async (_, projectPath: string) => {
  try {
    if (!fs.existsSync(projectPath)) {
      return null;
    }
    const data = fs.readFileSync(projectPath, 'utf-8');
    return {
      data: JSON.parse(data),
      path: projectPath,
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

// ============================================
// Vault Asset Sync Handlers
// ============================================

interface AssetIndexEntry {
  id: string;
  hash: string;
  filename: string;
  originalName: string;
  originalPath: string;
  type: 'image' | 'video';
  fileSize: number;
  importedAt: string;
}

interface AssetIndex {
  version: number;
  assets: AssetIndexEntry[];
}

// Calculate SHA256 hash of a file
ipcMain.handle('calculate-file-hash', async (_, filePath: string) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    return hash;
  } catch (error) {
    console.error('Failed to calculate file hash:', error);
    return null;
  }
});

// Ensure assets folder exists in vault
ipcMain.handle('ensure-assets-folder', async (_, vaultPath: string) => {
  try {
    const assetsPath = path.join(vaultPath, 'assets');
    if (!fs.existsSync(assetsPath)) {
      fs.mkdirSync(assetsPath, { recursive: true });
    }
    return assetsPath;
  } catch (error) {
    console.error('Failed to create assets folder:', error);
    return null;
  }
});

// Load asset index from vault
ipcMain.handle('load-asset-index', async (_, vaultPath: string) => {
  try {
    const indexPath = path.join(vaultPath, 'assets', '.index.json');
    if (fs.existsSync(indexPath)) {
      const data = fs.readFileSync(indexPath, 'utf-8');
      return JSON.parse(data) as AssetIndex;
    }
    return { version: 1, assets: [] } as AssetIndex;
  } catch (error) {
    console.error('Failed to load asset index:', error);
    return { version: 1, assets: [] } as AssetIndex;
  }
});

// Save asset index to vault
ipcMain.handle('save-asset-index', async (_, vaultPath: string, index: AssetIndex) => {
  try {
    const assetsPath = path.join(vaultPath, 'assets');
    if (!fs.existsSync(assetsPath)) {
      fs.mkdirSync(assetsPath, { recursive: true });
    }
    const indexPath = path.join(assetsPath, '.index.json');
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to save asset index:', error);
    return false;
  }
});

// Import asset to vault with hash-based naming
ipcMain.handle('import-asset-to-vault', async (_, sourcePath: string, vaultPath: string, assetId: string) => {
  try {
    // Calculate hash first
    const buffer = fs.readFileSync(sourcePath);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const shortHash = hash.substring(0, 12);

    // Determine file type and extension
    const ext = path.extname(sourcePath).toLowerCase();
    const mediaType = getMediaType(path.basename(sourcePath));
    if (!mediaType) {
      return { success: false, error: 'Unsupported file type' };
    }

    // Create hash-based filename: img_abc123.png or vid_abc123.mp4
    const prefix = mediaType === 'image' ? 'img' : 'vid';
    const newFilename = `${prefix}_${shortHash}${ext}`;

    // Ensure assets folder exists
    const assetsPath = path.join(vaultPath, 'assets');
    if (!fs.existsSync(assetsPath)) {
      fs.mkdirSync(assetsPath, { recursive: true });
    }

    const destPath = path.join(assetsPath, newFilename);
    const relativePath = `assets/${newFilename}`;

    // Check if file with same hash already exists
    if (fs.existsSync(destPath)) {
      // Verify it's the same file by comparing hashes
      const existingBuffer = fs.readFileSync(destPath);
      const existingHash = crypto.createHash('sha256').update(existingBuffer).digest('hex');

      if (existingHash === hash) {
        // Exact duplicate - return existing path
        return {
          success: true,
          vaultPath: destPath,
          relativePath,
          hash,
          isDuplicate: true,
        };
      }

      // Hash collision (very rare) - add suffix
      let counter = 1;
      let uniqueFilename = `${prefix}_${shortHash}_${counter}${ext}`;
      let uniquePath = path.join(assetsPath, uniqueFilename);
      while (fs.existsSync(uniquePath)) {
        counter++;
        uniqueFilename = `${prefix}_${shortHash}_${counter}${ext}`;
        uniquePath = path.join(assetsPath, uniqueFilename);
      }

      fs.copyFileSync(sourcePath, uniquePath);
      return {
        success: true,
        vaultPath: uniquePath,
        relativePath: `assets/${uniqueFilename}`,
        hash,
        isDuplicate: false,
      };
    }

    // Copy file to vault
    fs.copyFileSync(sourcePath, destPath);

    // Update asset index
    const indexPath = path.join(assetsPath, '.index.json');
    let index: AssetIndex = { version: 1, assets: [] };
    if (fs.existsSync(indexPath)) {
      try {
        index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      } catch {
        // Use default empty index
      }
    }

    // Add entry to index
    const indexEntry: AssetIndexEntry = {
      id: assetId,
      hash,
      filename: newFilename,
      originalName: path.basename(sourcePath),
      originalPath: sourcePath,
      type: mediaType,
      fileSize: buffer.length,
      importedAt: new Date().toISOString(),
    };

    index.assets.push(indexEntry);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    return {
      success: true,
      vaultPath: destPath,
      relativePath,
      hash,
      isDuplicate: false,
    };
  } catch (error) {
    console.error('Failed to import asset to vault:', error);
    return { success: false, error: String(error) };
  }
});

// Verify vault assets - check for missing files
ipcMain.handle('verify-vault-assets', async (_, vaultPath: string) => {
  try {
    const assetsPath = path.join(vaultPath, 'assets');
    const indexPath = path.join(assetsPath, '.index.json');

    if (!fs.existsSync(indexPath)) {
      return { valid: true, missing: [], orphaned: [] };
    }

    const index: AssetIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const missing: string[] = [];
    const existingFiles = new Set<string>();

    // Check each indexed asset
    for (const entry of index.assets) {
      const assetPath = path.join(assetsPath, entry.filename);
      if (!fs.existsSync(assetPath)) {
        missing.push(entry.filename);
      } else {
        existingFiles.add(entry.filename);
      }
    }

    // Find orphaned files (not in index)
    const orphaned: string[] = [];
    if (fs.existsSync(assetsPath)) {
      const files = fs.readdirSync(assetsPath);
      for (const file of files) {
        if (file === '.index.json') continue;
        if (!existingFiles.has(file) && !index.assets.some(a => a.filename === file)) {
          orphaned.push(file);
        }
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      orphaned,
    };
  } catch (error) {
    console.error('Failed to verify vault assets:', error);
    return { valid: false, missing: [], orphaned: [], error: String(error) };
  }
});

// Resolve relative path to absolute path
ipcMain.handle('resolve-vault-path', async (_, vaultPath: string, relativePath: string) => {
  try {
    const absolutePath = path.join(vaultPath, relativePath);
    const exists = fs.existsSync(absolutePath);
    return { absolutePath, exists };
  } catch (error) {
    return { absolutePath: null, exists: false, error: String(error) };
  }
});

// Get relative path from vault
ipcMain.handle('get-relative-path', async (_, vaultPath: string, absolutePath: string) => {
  try {
    const relativePath = path.relative(vaultPath, absolutePath);
    // Ensure forward slashes for consistency
    return relativePath.replace(/\\/g, '/');
  } catch (error) {
    return null;
  }
});

// Check if path is inside vault
ipcMain.handle('is-path-in-vault', async (_, vaultPath: string, checkPath: string) => {
  try {
    const normalizedVault = path.normalize(vaultPath);
    const normalizedCheck = path.normalize(checkPath);
    return normalizedCheck.startsWith(normalizedVault);
  } catch {
    return false;
  }
});

// ============================================
// Video Clip Finalization (ffmpeg)
// ============================================

interface FinalizeClipOptions {
  sourcePath: string;
  outputPath: string;
  inPoint: number;
  outPoint: number;
}

// Show save dialog for clip export
ipcMain.handle('show-save-clip-dialog', async (_, defaultName: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Save Video Clip',
    defaultPath: defaultName,
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  return result.filePath;
});

// Finalize video clip using ffmpeg
ipcMain.handle('finalize-clip', async (_, options: FinalizeClipOptions) => {
  const { sourcePath, outputPath, inPoint, outPoint } = options;

  // Get ffmpeg path - it can be null if not found
  const ffmpegBinary = ffmpegPath as string | null;
  if (!ffmpegBinary) {
    return { success: false, error: 'ffmpeg not found' };
  }

  return new Promise<{ success: boolean; outputPath?: string; fileSize?: number; error?: string }>((resolve) => {
    // Calculate duration
    const duration = outPoint - inPoint;

    // Build ffmpeg arguments
    // -ss before -i for fast seeking (input seeking)
    // -t for duration
    // -c copy for fast stream copy (no re-encoding)
    const args = [
      '-y',                    // Overwrite output file
      '-ss', inPoint.toString(), // Seek to start position
      '-i', sourcePath,        // Input file
      '-t', duration.toString(), // Duration
      '-c', 'copy',            // Copy streams without re-encoding
      '-avoid_negative_ts', 'make_zero', // Fix timestamp issues
      outputPath
    ];

    console.log('[ffmpeg] Running:', ffmpegBinary, args.join(' '));

    const ffmpegProcess = spawn(ffmpegBinary, args);

    let stderr = '';

    ffmpegProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
      console.log('[ffmpeg]', data.toString());
    });

    ffmpegProcess.on('close', (code: number | null) => {
      if (code === 0) {
        // Verify output file exists
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          resolve({
            success: true,
            outputPath,
            fileSize: stats.size,
          });
        } else {
          resolve({
            success: false,
            error: 'Output file was not created',
          });
        }
      } else {
        resolve({
          success: false,
          error: `ffmpeg exited with code ${code}: ${stderr}`,
        });
      }
    });

    ffmpegProcess.on('error', (err: Error) => {
      resolve({
        success: false,
        error: `Failed to start ffmpeg: ${err.message}`,
      });
    });
  });
});

// Extract video frame as image using ffmpeg
interface ExtractFrameOptions {
  sourcePath: string;
  outputPath: string;
  timestamp: number;  // Time in seconds
}

interface ExtractFrameResult {
  success: boolean;
  outputPath?: string;
  fileSize?: number;
  error?: string;
}

// ============================================
// Sequence Export (ffmpeg)
// ============================================

interface SequenceItem {
  type: 'image' | 'video';
  path: string;
  duration: number;  // Duration in seconds
  inPoint?: number;  // For video clips
  outPoint?: number; // For video clips
}

interface ExportSequenceOptions {
  items: SequenceItem[];
  outputPath: string;
  width: number;
  height: number;
  fps: number;
}

interface ExportSequenceResult {
  success: boolean;
  outputPath?: string;
  fileSize?: number;
  error?: string;
}

// Show save dialog for sequence export
ipcMain.handle('show-save-sequence-dialog', async (_, defaultName: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Export Sequence as MP4',
    defaultPath: defaultName,
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  return result.filePath;
});

// Helper function to run ffmpeg process
function runFfmpeg(ffmpegBinary: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[ffmpeg] Running:', args.join(' '));
    const proc = spawn(ffmpegBinary, args);
    let stderr = '';
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });
    proc.on('error', reject);
  });
}

// Export sequence to MP4 using ffmpeg
ipcMain.handle('export-sequence', async (_, options: ExportSequenceOptions): Promise<ExportSequenceResult> => {
  const { items, outputPath, width, height, fps } = options;

  const ffmpegBinary = ffmpegPath as string | null;
  if (!ffmpegBinary) {
    return { success: false, error: 'ffmpeg not found' };
  }

  // Create a temporary directory for intermediate files
  const tempDir = app.getPath('temp');
  const sessionId = Date.now();
  const tempFiles: string[] = [];

  try {
    // Step 1: Convert each item to a standardized video segment
    const segmentFiles: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const segmentFile = path.join(tempDir, `segment_${sessionId}_${i}.mp4`);
      tempFiles.push(segmentFile);

      if (item.type === 'image') {
        // Convert image to video with specified duration
        const imageArgs = [
          '-y',
          '-loop', '1',
          '-i', item.path,
          '-t', item.duration.toString(),
          '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p`,
          '-r', fps.toString(),
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '18',
          '-pix_fmt', 'yuv420p',
          segmentFile
        ];

        await runFfmpeg(ffmpegBinary, imageArgs);
      } else {
        // Video: extract segment and re-encode to consistent format
        const inPoint = item.inPoint ?? 0;
        const duration = item.outPoint !== undefined
          ? item.outPoint - inPoint
          : item.duration;

        const videoArgs = [
          '-y',
          '-ss', inPoint.toString(),
          '-i', item.path,
          '-t', duration.toString(),
          '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p`,
          '-r', fps.toString(),
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '18',
          '-pix_fmt', 'yuv420p',
          '-an',  // Remove audio for now (can be added later)
          segmentFile
        ];

        await runFfmpeg(ffmpegBinary, videoArgs);
      }

      segmentFiles.push(segmentFile);
    }

    // Step 2: Create concat list file
    const listFile = path.join(tempDir, `concat_${sessionId}.txt`);
    tempFiles.push(listFile);

    const concatLines = segmentFiles.map(f => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
    fs.writeFileSync(listFile, concatLines.join('\n'), 'utf-8');

    // Step 3: Concatenate all segments
    const concatArgs = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-c', 'copy',
      '-movflags', '+faststart',
      outputPath
    ];

    console.log('[ffmpeg] Concatenating segments...');

    return new Promise<ExportSequenceResult>((resolve) => {
      const ffmpegProcess = spawn(ffmpegBinary, concatArgs);

      let stderr = '';

      ffmpegProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        console.log('[ffmpeg]', data.toString());
      });

      ffmpegProcess.on('close', (code: number | null) => {
        // Clean up temp files
        for (const tempFile of tempFiles) {
          try {
            if (fs.existsSync(tempFile)) {
              fs.unlinkSync(tempFile);
            }
          } catch (e) {
            console.warn('Failed to clean up temp file:', tempFile, e);
          }
        }

        if (code === 0) {
          if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            resolve({
              success: true,
              outputPath,
              fileSize: stats.size,
            });
          } else {
            resolve({
              success: false,
              error: 'Output file was not created',
            });
          }
        } else {
          resolve({
            success: false,
            error: `ffmpeg exited with code ${code}: ${stderr}`,
          });
        }
      });

      ffmpegProcess.on('error', (err: Error) => {
        // Clean up temp files
        for (const tempFile of tempFiles) {
          try {
            if (fs.existsSync(tempFile)) {
              fs.unlinkSync(tempFile);
            }
          } catch (e) {
            console.warn('Failed to clean up temp file:', tempFile, e);
          }
        }

        resolve({
          success: false,
          error: `Failed to start ffmpeg: ${err.message}`,
        });
      });
    });
  } catch (error) {
    // Clean up temp files on error
    for (const tempFile of tempFiles) {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (e) {
        console.warn('Failed to clean up temp file:', tempFile, e);
      }
    }

    return {
      success: false,
      error: `Export failed: ${String(error)}`,
    };
  }
});

ipcMain.handle('extract-video-frame', async (_, options: ExtractFrameOptions): Promise<ExtractFrameResult> => {
  const { sourcePath, outputPath, timestamp } = options;

  // Get ffmpeg path
  const ffmpegBinary = ffmpegPath as string | null;
  if (!ffmpegBinary) {
    return { success: false, error: 'ffmpeg not found' };
  }

  return new Promise<ExtractFrameResult>((resolve) => {
    // Build ffmpeg arguments for frame extraction
    // -ss for seeking to timestamp
    // -vframes 1 to extract single frame
    // -q:v 2 for high quality JPEG (1-31, lower is better)
    const args = [
      '-y',                      // Overwrite output file
      '-ss', timestamp.toString(), // Seek to timestamp
      '-i', sourcePath,          // Input file
      '-vframes', '1',           // Extract single frame
      '-q:v', '2',               // High quality
      outputPath
    ];

    console.log('[ffmpeg] Extracting frame:', ffmpegBinary, args.join(' '));

    const ffmpegProcess = spawn(ffmpegBinary, args);

    let stderr = '';

    ffmpegProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    ffmpegProcess.on('close', (code: number | null) => {
      if (code === 0) {
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          resolve({
            success: true,
            outputPath,
            fileSize: stats.size,
          });
        } else {
          resolve({
            success: false,
            error: 'Output file was not created',
          });
        }
      } else {
        resolve({
          success: false,
          error: `ffmpeg exited with code ${code}: ${stderr}`,
        });
      }
    });

    ffmpegProcess.on('error', (err: Error) => {
      resolve({
        success: false,
        error: `Failed to start ffmpeg: ${err.message}`,
      });
    });
  });
});
