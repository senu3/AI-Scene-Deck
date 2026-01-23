import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useEffect, useRef } from 'react';
import { Film, Image, Clock, Copy, Trash2, ArrowRightLeft, Clipboard, Scissors, Download, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { Asset, Scene } from '../types';
import './CutCard.css';

interface CutCardProps {
  cut: {
    id: string;
    assetId: string;
    asset?: Asset;
    displayTime: number;
    order: number;
    // Video clip fields
    inPoint?: number;
    outPoint?: number;
    isClip?: boolean;
    // Loading state
    isLoading?: boolean;
    loadingName?: string;
  };
  sceneId: string;
  index: number;
  isDragging: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  isMultiSelect: boolean;
  selectedCount: number;
  scenes: Scene[];
  currentSceneId: string;
  canPaste: boolean;
  isClip: boolean;
  onClose: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onMoveToScene: (sceneId: string) => void;
  onFinalizeClip?: () => void;
}

function CutContextMenu({
  x,
  y,
  isMultiSelect,
  selectedCount,
  scenes,
  currentSceneId,
  canPaste,
  isClip,
  onClose,
  onCopy,
  onPaste,
  onDelete,
  onMoveToScene,
  onFinalizeClip,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Filter out current scene from move options
  const otherScenes = scenes.filter(s => s.id !== currentSceneId);

  return (
    <div
      ref={menuRef}
      className="cut-context-menu"
      style={{ left: x, top: y }}
    >
      <div className="context-menu-header">
        {isMultiSelect ? `${selectedCount} cuts selected` : 'Cut options'}
      </div>

      <button onClick={onCopy}>
        <Copy size={14} />
        Copy{isMultiSelect ? ` (${selectedCount})` : ''}
      </button>

      {canPaste && (
        <button onClick={onPaste}>
          <Clipboard size={14} />
          Paste
        </button>
      )}

      {otherScenes.length > 0 && (
        <div
          className="context-menu-item-with-submenu"
          onMouseEnter={() => setShowMoveSubmenu(true)}
          onMouseLeave={() => setShowMoveSubmenu(false)}
        >
          <button>
            <ArrowRightLeft size={14} />
            Move to Scene
            <span className="submenu-arrow">▶</span>
          </button>

          {showMoveSubmenu && (
            <div className="context-submenu">
              {otherScenes.map(scene => (
                <button
                  key={scene.id}
                  onClick={() => onMoveToScene(scene.id)}
                >
                  {scene.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Finalize Clip option - only for clips */}
      {isClip && !isMultiSelect && onFinalizeClip && (
        <>
          <div className="context-menu-divider" />
          <button onClick={onFinalizeClip} className="finalize">
            <Download size={14} />
            Finalize Clip (Export MP4)
          </button>
        </>
      )}

      <div className="context-menu-divider" />

      <button onClick={onDelete} className="danger">
        <Trash2 size={14} />
        Delete{isMultiSelect ? ` (${selectedCount})` : ''}
      </button>
    </div>
  );
}

export default function CutCard({ cut, sceneId, index, isDragging }: CutCardProps) {
  const {
    selectedCutId,
    selectedCutIds,
    selectCut,
    toggleCutSelection,
    selectCutRange,
    getAsset,
    scenes,
    getSelectedCutIds,
    moveCutsToScene,
    removeCut,
    copySelectedCuts,
    canPaste,
    pasteCuts,
    vaultPath,
    openVideoPreview,
  } = useStore();
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showLoadingSpinner, setShowLoadingSpinner] = useState(false);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Show spinner after 1 second of loading
  useEffect(() => {
    if (cut.isLoading) {
      loadingTimerRef.current = setTimeout(() => {
        setShowLoadingSpinner(true);
      }, 1000);
    } else {
      setShowLoadingSpinner(false);
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    }

    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, [cut.isLoading]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: cut.id,
    data: {
      type: 'cut',
      sceneId,
      index,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const asset = cut.asset || getAsset(cut.assetId);
  const isSelected = selectedCutIds.has(cut.id) || selectedCutId === cut.id;
  const isMultiSelected = selectedCutIds.size > 1 && selectedCutIds.has(cut.id);
  const isVideo = asset?.type === 'video';

  useEffect(() => {
    const loadThumbnail = async () => {
      if (asset?.thumbnail) {
        setThumbnail(asset.thumbnail);
        return;
      }

      if (asset?.path && window.electronAPI) {
        try {
          const base64 = await window.electronAPI.readFileAsBase64(asset.path);
          if (base64) {
            setThumbnail(base64);
          }
        } catch {
          // Failed to load thumbnail
        }
      }
    };

    loadThumbnail();
  }, [asset]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Ctrl/Cmd + click: toggle selection
    if (e.ctrlKey || e.metaKey) {
      toggleCutSelection(cut.id);
      return;
    }

    // Shift + click: range selection
    if (e.shiftKey) {
      selectCutRange(cut.id);
      return;
    }

    // Normal click: single selection
    selectCut(cut.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Open Single Mode preview for both video and image assets
    if (asset) {
      openVideoPreview(cut.id);
    }
  };

  const getBadgeColor = () => {
    // Generate a consistent color based on asset type
    if (isVideo) return 'var(--accent-purple)';
    return 'var(--accent-primary)';
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If right-clicking on a non-selected card, select it first
    if (!selectedCutIds.has(cut.id)) {
      selectCut(cut.id);
    }

    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCopy = () => {
    copySelectedCuts();
    setContextMenu(null);
  };

  const handlePaste = () => {
    // Paste after the current cut's position
    pasteCuts(sceneId, index + 1);
    setContextMenu(null);
  };

  const handleDelete = () => {
    const cutIds = getSelectedCutIds();
    // Delete all selected cuts
    for (const cutId of cutIds) {
      // Find which scene contains this cut
      for (const scene of scenes) {
        if (scene.cuts.some(c => c.id === cutId)) {
          removeCut(scene.id, cutId);
          break;
        }
      }
    }
    setContextMenu(null);
  };

  const handleMoveToScene = (targetSceneId: string) => {
    const cutIds = getSelectedCutIds();
    // Get target scene's cut count for append position
    const targetScene = scenes.find(s => s.id === targetSceneId);
    const toIndex = targetScene?.cuts.length || 0;
    moveCutsToScene(cutIds, targetSceneId, toIndex);
    setContextMenu(null);
  };

  const handleFinalizeClip = async () => {
    if (!cut.isClip || cut.inPoint === undefined || cut.outPoint === undefined || !asset?.path) {
      setContextMenu(null);
      return;
    }

    if (!window.electronAPI) {
      alert('electronAPI not available. Please restart the app.');
      setContextMenu(null);
      return;
    }

    // Check if vault path is set
    if (!vaultPath) {
      alert('Vault path not set. Please set up a vault first.');
      setContextMenu(null);
      return;
    }

    // Check if the API methods exist
    if (typeof window.electronAPI.finalizeClip !== 'function' ||
        typeof window.electronAPI.ensureAssetsFolder !== 'function') {
      alert('Finalize Clip feature requires app restart after update.\nPlease restart the Electron app.');
      setContextMenu(null);
      return;
    }

    try {
      // Ensure assets folder exists
      const assetsFolder = await window.electronAPI.ensureAssetsFolder(vaultPath);
      if (!assetsFolder) {
        alert('Failed to access assets folder in vault.');
        setContextMenu(null);
        return;
      }

      // Generate unique filename: {original_name}_clip_{timestamp}.mp4
      const baseName = asset.name.replace(/\.[^/.]+$/, ''); // Remove extension
      const timestamp = Date.now();
      const clipFileName = `${baseName}_clip_${timestamp}.mp4`;
      const outputPath = `${assetsFolder}/${clipFileName}`.replace(/\\/g, '/');

      // Finalize the clip (auto-save to vault assets)
      const result = await window.electronAPI.finalizeClip({
        sourcePath: asset.path,
        outputPath,
        inPoint: cut.inPoint,
        outPoint: cut.outPoint,
      });

      if (result.success) {
        alert(`Clip exported to vault!\n\nFile: ${clipFileName}\nSize: ${(result.fileSize! / 1024 / 1024).toFixed(2)} MB`);
      } else {
        alert(`Failed to export clip: ${result.error}`);
      }
    } catch (error) {
      alert(`Error finalizing clip: ${error}`);
    }

    setContextMenu(null);
  };

  // If loading, show loading card
  if (cut.isLoading) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`cut-card loading ${isDragging ? 'dragging' : ''}`}
      >
        <div className="cut-thumbnail-container">
          <div className="cut-thumbnail placeholder loading-placeholder">
            {showLoadingSpinner && (
              <Loader2 size={24} className="loading-spinner" />
            )}
          </div>
          <div className="cut-loading-name" title={cut.loadingName}>
            {cut.loadingName}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cut-card ${isSelected ? 'selected' : ''} ${isMultiSelected ? 'multi-selected' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <div className="cut-thumbnail-container">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={asset?.name || 'Cut'}
            className="cut-thumbnail"
          />
        ) : (
          <div className="cut-thumbnail placeholder">
            {isVideo ? (
              <Film size={24} className="placeholder-icon" />
            ) : (
              <Image size={24} className="placeholder-icon" />
            )}
          </div>
        )}

        <div className="cut-badge" style={{ backgroundColor: getBadgeColor() }}>
          {isVideo ? 'S:VID' : 'S:IMG'}
        </div>

        {/* Clip indicator for trimmed videos */}
        {cut.isClip && (
          <div className="clip-indicator" title={`Clip: ${cut.inPoint?.toFixed(1)}s - ${cut.outPoint?.toFixed(1)}s`}>
            <Scissors size={12} />
          </div>
        )}

        <div className="cut-duration">
          <Clock size={10} />
          <span>{cut.displayTime.toFixed(1)}s</span>
        </div>
      </div>
    </div>

    {contextMenu && (
      <CutContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        isMultiSelect={isMultiSelected}
        selectedCount={selectedCutIds.size}
        scenes={scenes}
        currentSceneId={sceneId}
        canPaste={canPaste()}
        isClip={!!cut.isClip}
        onClose={() => setContextMenu(null)}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={handleDelete}
        onMoveToScene={handleMoveToScene}
        onFinalizeClip={handleFinalizeClip}
      />
    )}
    </>
  );
}
