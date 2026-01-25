import { useDroppable, useDndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, MoreHorizontal, Circle, Edit2, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useHistoryStore } from '../store/historyStore';
import { AddCutCommand, AddSceneCommand, RemoveSceneCommand, RenameSceneCommand } from '../store/commands';
import CutCard from './CutCard';
import type { Asset } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { importFileToVault } from '../utils/assetPath';
import { extractVideoMetadata, generateVideoThumbnail } from '../utils/videoUtils';
import './Storyline.css';

// Placeholder state for external file drops and cross-scene moves
interface PlaceholderState {
  sceneId: string;
  insertIndex: number;
  type: 'external' | 'move';
}

// Helper to detect media type from filename
function getMediaType(filename: string): 'image' | 'video' | null {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  return null;
}

interface StorylineProps {
  activeId: string | null;
  activeType: 'cut' | 'scene' | null;
}

export default function Storyline({ activeId }: StorylineProps) {
  const { scenes, selectedSceneId, selectScene, vaultPath, addLoadingCutToScene, updateCutWithAsset, refreshAllSourceFolders, removeCut } = useStore();
  const { executeCommand } = useHistoryStore();
  const { active, over } = useDndContext();

  // Placeholder state for cross-scene moves and external file drops
  const [placeholder, setPlaceholder] = useState<PlaceholderState | null>(null);
  const [externalDragFiles, setExternalDragFiles] = useState<File[] | null>(null);

  // Track the source scene for the active drag (for cross-scene detection)
  const activeData = active?.data?.current as { sceneId?: string; type?: string } | undefined;
  const sourceSceneId = activeData?.sceneId;
  const isDraggingCut = activeData?.type === 'cut';

  // Determine if we're hovering over a different scene than the source
  const overData = over?.data?.current as { sceneId?: string; index?: number; type?: string } | undefined;
  const overSceneId = overData?.sceneId;
  const isOverDifferentScene = isDraggingCut && sourceSceneId && overSceneId && sourceSceneId !== overSceneId;

  // Extract specific values from overData to avoid reference changes triggering re-renders
  const overDataType = overData?.type;
  const overDataIndex = overData?.index;

  // Update placeholder for cross-scene CutCard moves
  useEffect(() => {
    if (isOverDifferentScene && overSceneId) {
      const targetScene = scenes.find(s => s.id === overSceneId);
      const insertIndex = overDataType === 'dropzone'
        ? (targetScene?.cuts.length || 0)
        : (overDataIndex ?? targetScene?.cuts.length ?? 0);

      setPlaceholder(prev => {
        // Only update if something changed to prevent infinite loops
        if (prev?.sceneId === overSceneId && prev?.insertIndex === insertIndex && prev?.type === 'move') {
          return prev;
        }
        return {
          sceneId: overSceneId,
          insertIndex,
          type: 'move',
        };
      });
    } else if (isDraggingCut && !externalDragFiles) {
      // Clear placeholder when back to source scene or not dragging
      setPlaceholder(prev => prev === null ? prev : null);
    }
  }, [isOverDifferentScene, overSceneId, overDataType, overDataIndex, scenes, isDraggingCut, externalDragFiles]);

  // Clear placeholder when drag ends
  useEffect(() => {
    if (!active) {
      setPlaceholder(null);
      setExternalDragFiles(null);
    }
  }, [active]);

  // Handle drop for sidebar assets
  const handleDrop = async (sceneId: string, e: React.DragEvent, insertIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();

    // Clear placeholder state
    setPlaceholder(null);
    setExternalDragFiles(null);

    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        let asset: Asset = JSON.parse(data);
        // Ensure the asset has a unique ID
        if (!asset.id) {
          asset.id = uuidv4();
        }

        // If vault path is set and asset has originalPath (dragged from Sidebar), import to vault first
        if (vaultPath && asset.originalPath && !asset.vaultRelativePath) {
          // Create empty loading cut card immediately
          const cutId = addLoadingCutToScene(sceneId, asset.id, asset.name, insertIndex);

          // Import file in background
          (async () => {
            try {
              // Extract video metadata if it's a video
              let duration: number | undefined = asset.duration;
              let videoWidth: number | undefined;
              let videoHeight: number | undefined;
              let thumbnail: string | undefined = asset.thumbnail;

              if (asset.type === 'video' && !duration) {
                const videoMeta = await extractVideoMetadata(asset.originalPath!);
                if (videoMeta) {
                  duration = videoMeta.duration;
                  videoWidth = videoMeta.width;
                  videoHeight = videoMeta.height;
                }
                if (!thumbnail) {
                  const thumb = await generateVideoThumbnail(asset.originalPath!, 0);
                  if (thumb) {
                    thumbnail = thumb;
                  }
                }
              }

              const importedAsset = await importFileToVault(
                asset.originalPath!,
                vaultPath,
                asset.id,
                {
                  name: asset.name,
                  type: asset.type,
                  thumbnail,
                  duration,
                  metadata: videoWidth && videoHeight ? { width: videoWidth, height: videoHeight } : asset.metadata,
                }
              );

              let finalAsset = asset;
              if (importedAsset) {
                finalAsset = importedAsset;
              } else {
                console.warn('Failed to import to vault, using original path');
              }

              // Update the loading cut with actual asset data
              const displayTime = finalAsset.type === 'video' && (finalAsset.duration || duration) ? (finalAsset.duration || duration || 1.0) : 1.0;
              updateCutWithAsset(sceneId, cutId, finalAsset, displayTime);

              // Refresh sidebar to show new file in assets folder
              refreshAllSourceFolders();
            } catch (error) {
              console.error('Failed to import file:', error);
              // Remove the loading cut on error
              removeCut(sceneId, cutId);
            }
          })();
        } else {
          // Asset already in vault or no vault set - add directly
          // Use command for undo/redo support
          // For videos, set displayTime to video duration
          const displayTime = asset.type === 'video' && asset.duration ? asset.duration : undefined;
          await executeCommand(new AddCutCommand(sceneId, asset, displayTime, insertIndex));
        }
        return;
      }

      // Handle external file drop
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        const mediaType = getMediaType(file.name);
        const filePath = (file as File & { path?: string }).path;
        if (!filePath || !mediaType) continue;

        const assetId = uuidv4();
        const cutId = addLoadingCutToScene(sceneId, assetId, file.name, insertIndex);

        // Import file in background
        (async () => {
          try {
            let duration: number | undefined;
            let thumbnail: string | undefined;
            let videoWidth: number | undefined;
            let videoHeight: number | undefined;

            if (mediaType === 'video') {
              const videoMeta = await extractVideoMetadata(filePath);
              if (videoMeta) {
                duration = videoMeta.duration;
                videoWidth = videoMeta.width;
                videoHeight = videoMeta.height;
              }
              const thumb = await generateVideoThumbnail(filePath, 0);
              if (thumb) {
                thumbnail = thumb;
              }
            }

            let asset: Asset;
            const fileSize = file.size;

            if (vaultPath) {
              const importedAsset = await importFileToVault(
                filePath,
                vaultPath,
                assetId,
                {
                  name: file.name,
                  type: mediaType,
                  duration,
                  thumbnail,
                  fileSize,
                  metadata: videoWidth && videoHeight ? { width: videoWidth, height: videoHeight } : undefined,
                }
              );

              if (importedAsset) {
                asset = importedAsset;
              } else {
                asset = {
                  id: assetId,
                  name: file.name,
                  path: filePath,
                  type: mediaType,
                  duration,
                  thumbnail,
                  fileSize,
                  metadata: videoWidth && videoHeight ? { width: videoWidth, height: videoHeight } : undefined,
                };
              }
            } else {
              asset = {
                id: assetId,
                name: file.name,
                path: filePath,
                type: mediaType,
                duration,
                thumbnail,
                fileSize,
                metadata: videoWidth && videoHeight ? { width: videoWidth, height: videoHeight } : undefined,
              };
            }

            const displayTime = mediaType === 'video' && duration ? duration : 1.0;
            updateCutWithAsset(sceneId, cutId, asset, displayTime);
            refreshAllSourceFolders();
          } catch (error) {
            console.error('Failed to import file:', error);
            removeCut(sceneId, cutId);
          }
        })();
      }
    } catch (error) {
      console.error('Failed to add cut:', error);
    }
  };

  // Calculate insertion index from mouse position
  const calculateInsertIndex = useCallback((sceneId: string, clientY: number, cutsContainer: HTMLElement): number => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return 0;

    const cutElements = cutsContainer.querySelectorAll('.cut-card:not(.placeholder-card)');
    if (cutElements.length === 0) return 0;

    for (let i = 0; i < cutElements.length; i++) {
      const rect = cutElements[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY < midY) {
        return i;
      }
    }
    return scene.cuts.length;
  }, [scenes]);

  // External file drag handlers for scenes
  const handleExternalDragEnter = useCallback((_sceneId: string, e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.items)
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((f): f is File => f !== null && getMediaType(f.name) !== null);

    if (files.length > 0) {
      setExternalDragFiles(files);
    }
  }, []);

  const handleExternalDragOver = useCallback((sceneId: string, e: React.DragEvent, cutsContainer: HTMLElement) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();

    const insertIndex = calculateInsertIndex(sceneId, e.clientY, cutsContainer);
    setPlaceholder(prev => {
      // Only update if something changed to avoid unnecessary re-renders
      if (prev?.sceneId === sceneId && prev?.insertIndex === insertIndex && prev?.type === 'external') {
        return prev;
      }
      return {
        sceneId,
        insertIndex,
        type: 'external',
      };
    });
  }, [calculateInsertIndex]);

  const handleExternalDragLeave = useCallback((sceneId: string, e: React.DragEvent) => {
    // Only clear if truly leaving the scene (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;

    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      if (placeholder?.sceneId === sceneId && placeholder?.type === 'external') {
        setPlaceholder(null);
        setExternalDragFiles(null);
      }
    }
  }, [placeholder]);

  return (
    <div className="timeline">
      <div className="timeline-content">
        {scenes.map((scene) => (
          <SceneColumn
            key={scene.id}
            sceneId={scene.id}
            sceneName={scene.name}
            cuts={scene.cuts}
            isSelected={selectedSceneId === scene.id}
            onSelect={() => selectScene(scene.id)}
            onDrop={(e, insertIndex) => handleDrop(scene.id, e, insertIndex)}
            activeId={activeId}
            placeholder={placeholder?.sceneId === scene.id ? placeholder : null}
            onExternalDragEnter={(e) => handleExternalDragEnter(scene.id, e)}
            onExternalDragOver={(e, container) => handleExternalDragOver(scene.id, e, container)}
            onExternalDragLeave={(e) => handleExternalDragLeave(scene.id, e)}
            sourceSceneId={sourceSceneId}
            isOverDifferentScene={!!isOverDifferentScene}
          />
        ))}

        <button className="add-scene-btn" onClick={() => {
          const sceneName = `Scene ${scenes.length + 1}`;
          executeCommand(new AddSceneCommand(sceneName)).catch((error) => {
            console.error('Failed to add scene:', error);
          });
        }}>
          <Plus size={24} />
          <span>Add Scene</span>
        </button>
      </div>
    </div>
  );
}

interface SceneColumnProps {
  sceneId: string;
  sceneName: string;
  cuts: Array<{
    id: string;
    assetId: string;
    asset?: Asset;
    displayTime: number;
    order: number;
  }>;
  isSelected: boolean;
  onSelect: () => void;
  onDrop: (e: React.DragEvent, insertIndex?: number) => void;
  activeId: string | null;
  placeholder: PlaceholderState | null;
  onExternalDragEnter: (e: React.DragEvent) => void;
  onExternalDragOver: (e: React.DragEvent, cutsContainer: HTMLElement) => void;
  onExternalDragLeave: (e: React.DragEvent) => void;
  sourceSceneId?: string;
  isOverDifferentScene?: boolean;
}

function SceneColumn({
  sceneId,
  sceneName,
  cuts,
  isSelected,
  onSelect,
  onDrop,
  activeId,
  placeholder,
  onExternalDragEnter,
  onExternalDragOver,
  onExternalDragLeave,
  sourceSceneId,
  isOverDifferentScene,
}: SceneColumnProps) {
  const { scenes } = useStore();
  const { executeCommand } = useHistoryStore();
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(sceneName);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cutsContainerRef = useRef<HTMLDivElement>(null);

  // Droppable for cuts
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `dropzone-${sceneId}`,
    data: {
      sceneId,
      type: 'dropzone',
      index: cuts.length,
    },
  });

  // Check if this is the source scene and a cut is being dragged to a different scene
  const isSourceScene = sourceSceneId === sceneId;
  const shouldHideDraggedCard = isSourceScene && isOverDifferentScene;

  // Handle drag over for external files
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      if (cutsContainerRef.current) {
        onExternalDragOver(e, cutsContainerRef.current);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const insertIndex = placeholder?.insertIndex;
    onDrop(e, insertIndex);
  };


  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleRename = () => {
    if (editName.trim() && editName !== sceneName) {
      executeCommand(new RenameSceneCommand(sceneId, editName.trim())).catch((error) => {
        console.error('Failed to rename scene:', error);
      });
    } else {
      setEditName(sceneName);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditName(sceneName);
      setIsEditing(false);
    }
  };

  const handleDelete = () => {
    if (scenes.length > 1 && confirm(`Delete "${sceneName}"? All cuts will be removed.`)) {
      executeCommand(new RemoveSceneCommand(sceneId)).catch((error) => {
        console.error('Failed to remove scene:', error);
      });
    }
    setShowMenu(false);
  };


  // Build the list of items including placeholder
  const renderItems = () => {
    const items: React.ReactNode[] = [];
    const placeholderElement = placeholder ? (
      <div key="placeholder" className="cut-card placeholder-card">
        <div className="placeholder-content">
          <Plus size={20} />
        </div>
      </div>
    ) : null;

    for (let i = 0; i < cuts.length; i++) {
      const cut = cuts[i];
      // Insert placeholder before this cut if needed
      if (placeholder && placeholder.insertIndex === i) {
        items.push(placeholderElement);
      }

      // Hide the card if it's being dragged to another scene
      const isHidden = shouldHideDraggedCard && activeId === cut.id;

      items.push(
        <CutCard
          key={cut.id}
          cut={cut}
          sceneId={sceneId}
          index={i}
          isDragging={activeId === cut.id}
          isHidden={isHidden}
        />
      );
    }

    // Add placeholder at the end if needed
    if (placeholder && placeholder.insertIndex >= cuts.length) {
      items.push(placeholderElement);
    }

    return items;
  };

  // Combine refs for the cuts container
  const setCombinedRef = (node: HTMLDivElement | null) => {
    setDroppableRef(node);
    (cutsContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  return (
    <div
      className={`scene-column ${isSelected ? 'selected' : ''}`}
    >
      <div
        className="scene-header"
        onClick={onSelect}
      >
        <div className="scene-indicator">
          <Circle size={16} />
        </div>

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="scene-name-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="scene-name">{sceneName.toUpperCase()}</span>
        )}

        <div className="scene-menu-container" ref={menuRef}>
          <button
            className="scene-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <MoreHorizontal size={16} />
          </button>

          {showMenu && (
            <div className="scene-menu">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                  setShowMenu(false);
                }}
              >
                <Edit2 size={14} />
                Rename
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="danger"
                disabled={scenes.length <= 1}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <SortableContext
        items={cuts.map(c => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setCombinedRef}
          className={`scene-cuts ${placeholder ? 'has-placeholder' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={onExternalDragEnter}
          onDragLeave={onExternalDragLeave}
        >
          {renderItems()}

          {!placeholder && (
            <div className="drop-placeholder">
              <Plus size={20} />
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
