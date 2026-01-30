import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  X,
  ChevronRight,
  Image,
  Film,
  Music,
  Filter,
  ArrowUpDown,
  Layers,
  Link2,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import type { Asset, Scene, MetadataStore, AssetIndexEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { generateVideoThumbnail } from '../utils/videoUtils';
import './AssetDrawer.css';

type SortMode = 'name' | 'type' | 'used' | 'unused';
type FilterType = 'all' | 'image' | 'video' | 'audio';

interface AssetInfo {
  id: string;
  name: string;           // File name
  sourceName: string;     // Original name from .index.json (display name)
  path: string;
  type: 'image' | 'video' | 'audio';
  thumbnail?: string;
  usageCount: number;
  usageType: 'cut' | 'audio' | 'both' | null;
}

// Build a map of used assets from scenes and metadata
function buildUsedAssetsMap(
  scenes: Scene[],
  metadataStore: MetadataStore | null
): Map<string, { count: number; type: 'cut' | 'audio' | 'both' }> {
  const used = new Map<string, { count: number; type: 'cut' | 'audio' | 'both' }>();

  // 1. Assets used in cuts
  for (const scene of scenes) {
    for (const cut of scene.cuts) {
      if (cut.asset?.id) {
        const existing = used.get(cut.asset.id);
        if (existing) {
          existing.count += 1;
        } else {
          used.set(cut.asset.id, { count: 1, type: 'cut' });
        }
      }
    }
  }

  // 2. Audio assets attached via metadata
  if (metadataStore) {
    for (const meta of Object.values(metadataStore.metadata)) {
      if (meta.attachedAudioId) {
        const existing = used.get(meta.attachedAudioId);
        if (existing) {
          if (existing.type === 'cut') {
            existing.type = 'both';
          }
          existing.count += 1;
        } else {
          used.set(meta.attachedAudioId, { count: 1, type: 'audio' });
        }
      }
    }
  }

  return used;
}

// Get media type from filename
function getMediaType(filename: string): 'image' | 'video' | 'audio' | null {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  return null;
}

// Audio placeholder component with animated waveform
function AudioPlaceholder() {
  return (
    <div className="audio-placeholder">
      <Music size={24} />
      <div className="waveform">
        <div className="waveform-bar" />
        <div className="waveform-bar" />
        <div className="waveform-bar" />
        <div className="waveform-bar" />
        <div className="waveform-bar" />
      </div>
    </div>
  );
}

export default function AssetDrawer() {
  const {
    assetDrawerOpen,
    closeAssetDrawer,
    toggleAssetDrawer,
    vaultPath,
    scenes,
    metadataStore,
    selectedSceneId,
    createCutFromImport,
    assetCache,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [thumbnailCache, setThumbnailCache] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Build usage map
  const usedAssetsMap = useMemo(
    () => buildUsedAssetsMap(scenes, metadataStore),
    [scenes, metadataStore]
  );

  // Load asset index from .index.json
  const loadAssetIndex = useCallback(async (): Promise<Map<string, AssetIndexEntry>> => {
    const indexMap = new Map<string, AssetIndexEntry>();
    if (!vaultPath || !window.electronAPI) return indexMap;

    try {
      const index = await window.electronAPI.loadAssetIndex(vaultPath);
      if (index && index.assets) {
        for (const entry of index.assets) {
          // Map by filename for lookup
          indexMap.set(entry.filename, entry);
        }
      }
    } catch (error) {
      console.error('Failed to load asset index:', error);
    }

    return indexMap;
  }, [vaultPath]);

  // Load assets from vault/assets folder
  const loadAssets = useCallback(async () => {
    if (!vaultPath || !window.electronAPI) return;

    setIsLoading(true);
    try {
      const assetsPath = `${vaultPath}/assets`.replace(/\\/g, '/');
      const exists = await window.electronAPI.pathExists(assetsPath);
      if (!exists) {
        setAssets([]);
        return;
      }

      // Load asset index for source names
      const assetIndex = await loadAssetIndex();

      const structure = await window.electronAPI.getFolderContents(assetsPath);
      const assetList: AssetInfo[] = [];

      // Flatten folder structure and get all files
      const processItems = (items: Array<{ name: string; path: string; isDirectory: boolean; children?: unknown[] }>) => {
        for (const item of items) {
          if (item.isDirectory) {
            if (item.children) {
              processItems(item.children as Array<{ name: string; path: string; isDirectory: boolean; children?: unknown[] }>);
            }
          } else {
            // Skip .index.json
            if (item.name === '.index.json') continue;

            const mediaType = getMediaType(item.name);
            if (mediaType) {
              // Look up source name from index
              const indexEntry = assetIndex.get(item.name);
              const sourceName = indexEntry?.originalName || item.name;

              // Use asset ID from index if available
              const assetId = indexEntry?.id || `asset-${item.path.replace(/[^a-zA-Z0-9]/g, '-')}`;

              // Check if asset is cached
              const cachedAsset = assetCache.get(assetId);
              const usage = usedAssetsMap.get(assetId) || usedAssetsMap.get(cachedAsset?.id || '');

              assetList.push({
                id: cachedAsset?.id || assetId,
                name: item.name,
                sourceName,
                path: item.path,
                type: mediaType,
                thumbnail: cachedAsset?.thumbnail,
                usageCount: usage?.count || 0,
                usageType: usage?.type || null,
              });
            }
          }
        }
      };

      processItems(structure);
      setAssets(assetList);
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [vaultPath, assetCache, usedAssetsMap, loadAssetIndex]);

  // Load assets when drawer opens
  useEffect(() => {
    if (assetDrawerOpen) {
      loadAssets();
    }
  }, [assetDrawerOpen, loadAssets]);

  // Load thumbnail for an asset
  const loadThumbnail = useCallback(async (asset: AssetInfo) => {
    if (thumbnailCache.has(asset.path)) return;
    if (asset.type === 'audio') return; // Audio has placeholder

    try {
      let thumbnail: string | null = null;
      if (asset.type === 'video') {
        thumbnail = await generateVideoThumbnail(asset.path);
      } else if (window.electronAPI) {
        thumbnail = await window.electronAPI.readFileAsBase64(asset.path);
      }

      if (thumbnail) {
        setThumbnailCache((prev) => new Map(prev).set(asset.path, thumbnail!));
      }
    } catch (error) {
      console.error('Failed to load thumbnail:', error);
    }
  }, [thumbnailCache]);

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    let result = [...assets];

    // Apply search filter (search both sourceName and filename)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.sourceName.toLowerCase().includes(query) ||
          a.name.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      result = result.filter((a) => a.type === filterType);
    }

    // Apply sort
    switch (sortMode) {
      case 'name':
        result.sort((a, b) => a.sourceName.localeCompare(b.sourceName));
        break;
      case 'type':
        const typeOrder = { image: 0, video: 1, audio: 2 };
        result.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
        break;
      case 'used':
        result.sort((a, b) => b.usageCount - a.usageCount);
        break;
      case 'unused':
        result.sort((a, b) => a.usageCount - b.usageCount);
        break;
    }

    return result;
  }, [assets, searchQuery, filterType, sortMode]);

  // Handle drag start - close drawer when leaving
  const handleDragStart = (e: React.DragEvent, asset: AssetInfo) => {
    setIsDragging(true);
    const dragAsset: Asset = {
      id: uuidv4(),
      name: asset.sourceName, // Use source name
      path: asset.path,
      type: asset.type,
      thumbnail: thumbnailCache.get(asset.path) || asset.thumbnail,
      originalPath: asset.path,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragAsset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Close drawer when dragging out of it
  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!isDragging) return;
      if (!drawerRef.current) return;

      // Check if we're leaving the drawer area
      const rect = drawerRef.current.getBoundingClientRect();
      const { clientX, clientY } = e;

      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        closeAssetDrawer();
      }
    },
    [isDragging, closeAssetDrawer]
  );

  // Handle double-click to add to timeline
  const handleDoubleClick = async (asset: AssetInfo) => {
    const targetSceneId = selectedSceneId || scenes[0]?.id;
    if (!targetSceneId) return;

    const assetId = uuidv4();
    try {
      await createCutFromImport(targetSceneId, {
        assetId,
        name: asset.sourceName, // Use source name
        sourcePath: asset.path,
        type: asset.type,
        preferredThumbnail: thumbnailCache.get(asset.path) || asset.thumbnail,
      });
    } catch (error) {
      console.error('Failed to add asset to timeline:', error);
    }
  };

  const sortLabels: Record<SortMode, string> = {
    name: 'Name',
    type: 'Type',
    used: 'Most Used',
    unused: 'Unused First',
  };

  return (
    <>
      {/* Edge trigger button - visible when drawer is closed */}
      {!assetDrawerOpen && (
        <button
          className="drawer-edge-trigger"
          onClick={toggleAssetDrawer}
          title="Open Assets (Tab)"
        >
          <ChevronRight size={20} />
        </button>
      )}

      {/* Main drawer */}
      <div
        ref={drawerRef}
        className={`asset-drawer ${assetDrawerOpen ? 'open' : ''}`}
        onDragLeave={handleDragLeave}
      >
        <div className="drawer-content">
          {/* Header */}
          <div className="drawer-header">
            <h2>Assets</h2>
            <button className="drawer-close-btn" onClick={closeAssetDrawer}>
              <X size={20} />
            </button>
          </div>

          {/* Toolbar */}
          <div className="drawer-toolbar">
            {/* Search box */}
            <div className="drawer-search">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Sort and filter row */}
            <div className="drawer-filters">
              {/* Sort dropdown */}
              <div className="sort-dropdown-container">
                <button
                  className="filter-btn"
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                >
                  <ArrowUpDown size={14} />
                  <span>{sortLabels[sortMode]}</span>
                </button>
                {showSortDropdown && (
                  <div className="sort-dropdown">
                    {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
                      <button
                        key={mode}
                        className={sortMode === mode ? 'active' : ''}
                        onClick={() => {
                          setSortMode(mode);
                          setShowSortDropdown(false);
                        }}
                      >
                        {sortLabels[mode]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Type filter chips */}
              <div className="type-filters">
                <button
                  className={`type-chip ${filterType === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterType('all')}
                >
                  <Filter size={12} />
                  All
                </button>
                <button
                  className={`type-chip ${filterType === 'image' ? 'active' : ''}`}
                  onClick={() => setFilterType('image')}
                >
                  <Image size={12} />
                </button>
                <button
                  className={`type-chip ${filterType === 'video' ? 'active' : ''}`}
                  onClick={() => setFilterType('video')}
                >
                  <Film size={12} />
                </button>
                <button
                  className={`type-chip ${filterType === 'audio' ? 'active' : ''}`}
                  onClick={() => setFilterType('audio')}
                >
                  <Music size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Asset grid */}
          <div className="asset-grid">
            {isLoading ? (
              <div className="asset-grid-loading">Loading assets...</div>
            ) : filteredAssets.length === 0 ? (
              <div className="asset-grid-empty">
                {assets.length === 0 ? 'No assets in vault' : 'No matching assets'}
              </div>
            ) : (
              filteredAssets.map((asset) => (
                <AssetCard
                  key={asset.path}
                  asset={asset}
                  thumbnail={thumbnailCache.get(asset.path) || asset.thumbnail}
                  onLoadThumbnail={() => loadThumbnail(asset)}
                  onDragStart={(e) => handleDragStart(e, asset)}
                  onDragEnd={handleDragEnd}
                  onDoubleClick={() => handleDoubleClick(asset)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Backdrop for closing */}
      {assetDrawerOpen && (
        <div className="drawer-backdrop" onClick={closeAssetDrawer} />
      )}
    </>
  );
}

interface AssetCardProps {
  asset: AssetInfo;
  thumbnail?: string;
  onLoadThumbnail: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDoubleClick: () => void;
}

function AssetCard({
  asset,
  thumbnail,
  onLoadThumbnail,
  onDragStart,
  onDragEnd,
  onDoubleClick,
}: AssetCardProps) {
  // Load thumbnail on mount
  useEffect(() => {
    if (!thumbnail && asset.type !== 'audio') {
      onLoadThumbnail();
    }
  }, [thumbnail, asset.type, onLoadThumbnail]);

  // Determine usage badge style
  const getUsageBadgeClass = () => {
    if (!asset.usageType) return '';
    if (asset.usageType === 'both') return 'usage-both';
    if (asset.usageType === 'audio') return 'usage-audio';
    return 'usage-cut';
  };

  return (
    <div
      className={`asset-card ${asset.usageCount > 0 ? 'used' : ''} ${asset.usageType ? `usage-${asset.usageType}` : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDoubleClick={onDoubleClick}
      title={`${asset.sourceName}\n(${asset.name})`}
    >
      <div className="asset-card-thumbnail">
        {asset.type === 'audio' ? (
          <AudioPlaceholder />
        ) : thumbnail ? (
          <img src={thumbnail} alt={asset.sourceName} />
        ) : (
          <div className="asset-card-placeholder">
            {asset.type === 'video' ? <Film size={24} /> : <Image size={24} />}
          </div>
        )}

        {/* Type badge */}
        {asset.type === 'video' && (
          <div className="asset-type-badge video">
            <Film size={10} />
          </div>
        )}
        {asset.type === 'audio' && (
          <div className="asset-type-badge audio">
            <Music size={10} />
          </div>
        )}

        {/* Usage indicator - more prominent */}
        {asset.usageCount > 0 && (
          <div className={`asset-usage-badge ${getUsageBadgeClass()}`} title={
            asset.usageType === 'cut'
              ? `Used in ${asset.usageCount} cut(s)`
              : asset.usageType === 'audio'
              ? `Attached as audio ${asset.usageCount} time(s)`
              : `Used in cuts and as audio (${asset.usageCount} total)`
          }>
            {asset.usageType === 'cut' && <Layers size={10} />}
            {asset.usageType === 'audio' && <Link2 size={10} />}
            {asset.usageType === 'both' && <><Layers size={10} /><Link2 size={10} /></>}
            <span>{asset.usageCount}</span>
          </div>
        )}
      </div>
      <span className="asset-card-name">{asset.sourceName}</span>
    </div>
  );
}
