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
  type: 'image' | 'video' | 'audio';
  thumbnail?: string;
  duration?: number;
  metadata?: ImageMetadata;
  fileSize?: number;
  // Vault sync fields
  vaultRelativePath?: string;  // Relative path within assets/ folder
  originalPath?: string;       // Original source path before import
  hash?: string;               // SHA256 hash for duplicate detection
}

// Asset index entry for vault
export interface AssetIndexEntry {
  id: string;
  hash: string;
  filename: string;           // e.g., "img_abc123.png"
  originalName: string;       // e.g., "my_photo.png"
  originalPath: string;       // Original source path
  type: 'image' | 'video' | 'audio';
  fileSize: number;
  importedAt: string;
}

// Asset index stored in assets/.index.json
export interface AssetIndex {
  version: number;
  assets: AssetIndexEntry[];
}

// Result of importing asset to vault
export interface VaultImportResult {
  success: boolean;
  vaultPath?: string;         // Absolute path in vault
  relativePath?: string;      // Relative path from vault root
  hash?: string;
  isDuplicate?: boolean;
  existingAssetId?: string;   // If duplicate, the existing asset ID
  error?: string;
}

export interface Cut {
  id: string;
  assetId: string;
  asset?: Asset;
  displayTime: number;
  order: number;
  // Video clip fields (for non-destructive trimming)
  inPoint?: number;   // Start time in seconds
  outPoint?: number;  // End time in seconds
  isClip?: boolean;   // True if this cut has custom IN/OUT points
  // Loading state (for background import)
  isLoading?: boolean;  // True while asset is being imported
  loadingName?: string; // Name to display while loading
}

export interface ClipData {
  sourceAssetId: string;
  inPoint: number;
  outPoint: number;
  duration: number;
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

// Source panel view mode
export type SourceViewMode = 'list' | 'grid';

// Source folder stored in project
export interface SourceFolderState {
  path: string;
  name: string;
}

// Source panel state stored in project
export interface SourcePanelState {
  folders: SourceFolderState[];
  expandedPaths: string[];
  viewMode: SourceViewMode;
}

export interface Project {
  id: string;
  name: string;
  vaultPath: string;
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
  version?: number;  // 1 = absolute paths, 2 = relative paths with vault sync
  // Source panel state (v3+)
  sourcePanel?: SourcePanelState;
}

export interface FavoriteFolder {
  path: string;
  name: string;
}

export type PlaybackMode = 'stopped' | 'playing' | 'paused';
export type PreviewMode = 'scene' | 'all';
export type SelectionType = 'scene' | 'cut' | null;

// Asset metadata for multi-file attachment (.metadata.json persistence)
export interface AssetMetadata {
  assetId: string;              // Target asset ID
  attachedAudioId?: string;     // Attached audio Asset ID
  attachedAudioOffset?: number; // Audio offset in seconds (positive = delay, negative = earlier)
  // Future expansion
  attachedImageIds?: string[];  // Multiple image attachments
}

// Metadata store (file structure)
export interface MetadataStore {
  version: number;
  metadata: { [assetId: string]: AssetMetadata };
}
