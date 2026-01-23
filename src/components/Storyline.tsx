import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, MoreHorizontal, Circle, Edit2, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useHistoryStore } from '../store/historyStore';
import { AddCutCommand, AddSceneCommand, RemoveSceneCommand, RenameSceneCommand } from '../store/commands';
import CutCard from './CutCard';
import type { Asset } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { importFileToVault } from '../utils/assetPath';
import { extractVideoMetadata, generateVideoThumbnail } from '../utils/videoUtils';
import './Storyline.css';

interface StorylineProps {
  activeId: string | null;
  activeType: 'cut' | 'scene' | null;
}

export default function Storyline({ activeId }: StorylineProps) {
  const { scenes, selectedSceneId, selectScene, vaultPath, addLoadingCutToScene, updateCutWithAsset, refreshAllSourceFolders, removeCut } = useStore();
  const { executeCommand } = useHistoryStore();

  const handleDrop = async (sceneId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drop-active');

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
          const cutId = addLoadingCutToScene(sceneId, asset.id, asset.name);

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
          await executeCommand(new AddCutCommand(sceneId, asset, displayTime));
        }
      }
    } catch (error) {
      console.error('Failed to add cut:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('drop-active');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drop-active');
  };

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
            onDrop={(e) => handleDrop(scene.id, e)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            activeId={activeId}
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
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  activeId: string | null;
}

function SceneColumn({
  sceneId,
  sceneName,
  cuts,
  isSelected,
  onSelect,
  onDrop,
  onDragOver,
  onDragLeave,
  activeId,
}: SceneColumnProps) {
  const { scenes } = useStore();
  const { executeCommand } = useHistoryStore();
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(sceneName);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Droppable for cuts
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `dropzone-${sceneId}`,
    data: {
      sceneId,
      type: 'dropzone',
      index: cuts.length,
    },
  });


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
          ref={setDroppableRef}
          className="scene-cuts"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          {cuts.map((cut, index) => (
            <CutCard
              key={cut.id}
              cut={cut}
              sceneId={sceneId}
              index={index}
              isDragging={activeId === cut.id}
            />
          ))}

          <div className="drop-placeholder">
            <Plus size={20} />
          </div>
        </div>
      </SortableContext>
    </div>
  );
}
