import { useState, useCallback } from 'react';
import {
  Search,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Star,
  Image,
  Film,
  RefreshCw,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import type { FileItem, Asset } from '../types';
import { v4 as uuidv4 } from 'uuid';
import './Sidebar.css';

export default function Sidebar() {
  const {
    rootFolder,
    setRootFolder,
    expandedFolders,
    toggleFolderExpanded,
    favorites,
    addFavorite,
    removeFavorite,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [thumbnailCache, setThumbnailCache] = useState<Map<string, string>>(new Map());

  const handleSelectFolder = async () => {
    if (!window.electronAPI) {
      alert('File system access is only available in the desktop app.');
      // For demo purposes, create a mock structure
      setRootFolder({
        path: '/demo',
        name: 'generated_images',
        structure: [
          {
            name: 'landscapes',
            path: '/demo/landscapes',
            isDirectory: true,
            children: [],
          },
          {
            name: 'characters',
            path: '/demo/characters',
            isDirectory: true,
            children: [],
          },
          {
            name: 'favorites',
            path: '/demo/favorites',
            isDirectory: true,
            children: [],
          },
        ],
      });
      return;
    }

    const result = await window.electronAPI.selectFolder();
    if (result) {
      setRootFolder(result);
    }
  };

  const handleRefreshFolder = async () => {
    if (!rootFolder || !window.electronAPI) return;
    const structure = await window.electronAPI.getFolderContents(rootFolder.path);
    setRootFolder({ ...rootFolder, structure });
  };

  const loadThumbnail = useCallback(async (filePath: string) => {
    if (thumbnailCache.has(filePath)) {
      return thumbnailCache.get(filePath);
    }

    if (!window.electronAPI) return null;

    const base64 = await window.electronAPI.readFileAsBase64(filePath);
    if (base64) {
      setThumbnailCache(prev => new Map(prev).set(filePath, base64));
      return base64;
    }
    return null;
  }, [thumbnailCache]);

  const getMediaType = (filename: string): 'image' | 'video' | null => {
    const ext = filename.toLowerCase().split('.').pop() || '';
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
    const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];

    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    return null;
  };

  const isFavorite = (path: string) => favorites.some(f => f.path === path);

  const toggleFavorite = (path: string, name: string) => {
    if (isFavorite(path)) {
      removeFavorite(path);
    } else {
      addFavorite({ path, name });
    }
  };

  const filterItems = (items: FileItem[]): FileItem[] => {
    if (!searchQuery) return items;

    return items.reduce<FileItem[]>((acc, item) => {
      if (item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        acc.push(item);
      } else if (item.isDirectory && item.children) {
        const filteredChildren = filterItems(item.children);
        if (filteredChildren.length > 0) {
          acc.push({ ...item, children: filteredChildren });
        }
      }
      return acc;
    }, []);
  };

  const renderFileItem = (item: FileItem, depth: number = 0) => {
    const isExpanded = expandedFolders.has(item.path);
    const mediaType = getMediaType(item.name);

    if (item.isDirectory) {
      return (
        <div key={item.path} className="folder-item">
          <div
            className="folder-header"
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={() => toggleFolderExpanded(item.path)}
          >
            <span className="folder-chevron">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            {isExpanded ? (
              <FolderOpen size={16} className="folder-icon open" />
            ) : (
              <Folder size={16} className="folder-icon" />
            )}
            <span className="folder-name truncate">{item.name}</span>
            <button
              className={`favorite-btn ${isFavorite(item.path) ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(item.path, item.name);
              }}
            >
              <Star size={12} />
            </button>
          </div>
          {isExpanded && item.children && (
            <div className="folder-children">
              {item.children.map(child => renderFileItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <FileItemComponent
        key={item.path}
        item={item}
        depth={depth}
        mediaType={mediaType}
        loadThumbnail={loadThumbnail}
        thumbnailCache={thumbnailCache}
      />
    );
  };

  const displayItems = rootFolder ? filterItems(rootFolder.structure) : [];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="sidebar-section">
        <div className="section-header">
          <span>Source</span>
          <div className="section-actions">
            <button className="action-btn" onClick={handleRefreshFolder} title="Refresh">
              <RefreshCw size={14} />
            </button>
            <button className="action-btn" onClick={handleSelectFolder} title="Add Folder">
              <FolderPlus size={14} />
            </button>
          </div>
        </div>

        {rootFolder ? (
          <div className="folder-tree">
            <div
              className="folder-header root"
              onClick={() => toggleFolderExpanded(rootFolder.path)}
            >
              <span className="folder-chevron">
                {expandedFolders.has(rootFolder.path) ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
              </span>
              <Folder size={16} className="folder-icon" />
              <span className="folder-name truncate">{rootFolder.name}</span>
            </div>
            {expandedFolders.has(rootFolder.path) && (
              <div className="folder-children">
                {displayItems.map(item => renderFileItem(item))}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <FolderPlus size={32} className="empty-icon" />
            <p>No folder selected</p>
            <button className="select-folder-btn" onClick={handleSelectFolder}>
              Select Folder
            </button>
          </div>
        )}
      </div>

      {favorites.length > 0 && (
        <div className="sidebar-section">
          <div className="section-header">
            <span>Favorites</span>
          </div>
          <div className="favorites-list">
            {favorites.map(fav => (
              <div key={fav.path} className="favorite-item">
                <Star size={14} className="favorite-star" />
                <span className="favorite-name truncate">{fav.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

interface FileItemComponentProps {
  item: FileItem;
  depth: number;
  mediaType: 'image' | 'video' | null;
  loadThumbnail: (path: string) => Promise<string | null | undefined>;
  thumbnailCache: Map<string, string>;
}

function FileItemComponent({ item, depth, mediaType, loadThumbnail, thumbnailCache }: FileItemComponentProps) {
  const { scenes, addCutToScene, selectedSceneId } = useStore();
  const [thumbnail, setThumbnail] = useState<string | null>(
    thumbnailCache.get(item.path) || null
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadThumbnail = async () => {
    if (thumbnail || isLoading) return;
    setIsLoading(true);
    const result = await loadThumbnail(item.path);
    if (result) {
      setThumbnail(result);
    }
    setIsLoading(false);
  };

  const handleAddToTimeline = () => {
    const targetSceneId = selectedSceneId || scenes[0]?.id;
    if (!targetSceneId) return;

    const asset: Asset = {
      id: uuidv4(),
      name: item.name,
      path: item.path,
      type: mediaType || 'image',
      thumbnail: thumbnail || undefined,
    };

    addCutToScene(targetSceneId, asset);
  };

  const handleDragStart = (e: React.DragEvent) => {
    const asset: Asset = {
      id: uuidv4(),
      name: item.name,
      path: item.path,
      type: mediaType || 'image',
      thumbnail: thumbnail || undefined,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      className="file-item"
      style={{ paddingLeft: `${12 + depth * 16}px` }}
      draggable
      onDragStart={handleDragStart}
      onMouseEnter={handleLoadThumbnail}
      onDoubleClick={handleAddToTimeline}
    >
      <div className="file-icon">
        {mediaType === 'video' ? (
          <Film size={16} />
        ) : (
          <Image size={16} />
        )}
      </div>
      {thumbnail ? (
        <img src={thumbnail} alt={item.name} className="file-thumbnail" />
      ) : (
        <div className="file-thumbnail placeholder">
          {isLoading ? '...' : ''}
        </div>
      )}
      <span className="file-name truncate">{item.name}</span>
    </div>
  );
}
