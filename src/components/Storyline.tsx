import { useDroppable, useDndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, MoreHorizontal, Circle, Edit2, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useHistoryStore } from '../store/historyStore';
import { AddCutCommand, AddSceneCommand, RemoveSceneCommand, RenameSceneCommand } from '../store/commands';
import CutCard from './CutCard';
import CutGroupCard, { ExpandedGroupContainer } from './CutGroupCard';
import type { Asset, CutGroup, Cut } from '../types';
import { v4 as uuidv4 } from 'uuid';
import './Storyline.css';

// --- DND: placeholder state ---
// Placeholder state for external file drops and cross-scene moves
interface PlaceholderState {
  sceneId: string;
  insertIndex: number;
  type: 'external' | 'move' | 'asset';
}

// --- DND: native (external / asset) ---
type DragKind = 'asset' | 'externalFiles' | 'none';

// Helper to detect media type from filename
function getMediaType(filename: string): 'image' | 'video' | null {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  return null;
}

function getSupportedMediaFiles(dataTransfer: DataTransfer): File[] {
  const items = Array.from(dataTransfer.items || []);
  if (items.length > 0) {
    return items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((file): file is File => !!file && getMediaType(file.name) !== null);
  }

  return Array.from(dataTransfer.files || [])
    .filter(file => getMediaType(file.name) !== null);
}

function hasSupportedMediaDrag(dataTransfer: DataTransfer): boolean {
  const items = Array.from(dataTransfer.items || []);
  if (items.length > 0) {
    for (const item of items) {
      if (item.kind !== 'file') continue;
      if (item.type?.startsWith('image/') || item.type?.startsWith('video/')) {
        return true;
      }
      const file = item.getAsFile();
      if (file && getMediaType(file.name) !== null) {
        return true;
      }
    }
    return false;
  }

  return Array.from(dataTransfer.files || []).some(file => getMediaType(file.name) !== null);
}

function hasAssetPanelDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes('text/scene-deck-asset')
    || dataTransfer.types.includes('application/json');
}

function getDragKind(dataTransfer: DataTransfer): DragKind {
  if (hasAssetPanelDrag(dataTransfer)) return 'asset';
  if (dataTransfer.types.includes('Files')) {
    if (hasSupportedMediaDrag(dataTransfer) || getSupportedMediaFiles(dataTransfer).length > 0) {
      return 'externalFiles';
    }
  }
  return 'none';
}

interface StorylineProps {
  activeId: string | null;
  activeType: 'cut' | 'scene' | null;
}

export default function Storyline({ activeId }: StorylineProps) {
  const { scenes, selectedSceneId, selectScene, vaultPath, createCutFromImport, closeDetailsPanel } = useStore();
  const { executeCommand } = useHistoryStore();
  // --- DND: dnd-kit (reorder) ---
  const { active, over } = useDndContext();

  // Placeholder state for cross-scene moves and external file drops
  const [placeholder, setPlaceholder] = useState<PlaceholderState | null>(null);
  const [externalDragFiles, setExternalDragFiles] = useState<File[] | null>(null);
  const dragDepthRef = useRef(0);

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
          createCutFromImport(sceneId, {
            assetId: asset.id,
            name: asset.name,
            sourcePath: asset.originalPath,
            type: asset.type,
            existingAsset: asset,
          }, insertIndex, vaultPath).catch(() => {});
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
        createCutFromImport(sceneId, {
          assetId,
          name: file.name,
          sourcePath: filePath,
          type: mediaType,
          fileSize: file.size,
        }, insertIndex, vaultPath).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to add cut:', error);
    }
  };

  const findSceneFromPoint = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const sceneColumn = element?.closest('.scene-column') as HTMLElement | null;
    if (!sceneColumn) return null;
    const sceneId = sceneColumn.getAttribute('data-scene-id');
    const cutsContainer = sceneColumn.querySelector('.scene-cuts') as HTMLElement | null;
    if (!sceneId || !cutsContainer) return null;
    return { sceneId, cutsContainer };
  };

  // Calculate insertion index from mouse position
  const calculateInsertIndex = useCallback((sceneId: string, clientY: number, cutsContainer: HTMLElement): number => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return 0;

    const cutElements = cutsContainer.querySelectorAll('.cut-card:not(.placeholder-card), .cut-group-card');
    if (cutElements.length === 0) return 0;

    for (let i = 0; i < cutElements.length; i++) {
      const rect = cutElements[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY < midY) return i;
    }
    return scene.cuts.length;
  }, [scenes]);

  // --- DND: native (external / asset) ---
  const handleStorylineDragEnter = useCallback((e: React.DragEvent) => {
    const dragKind = getDragKind(e.dataTransfer);
    if (dragKind === 'none') return;
    e.preventDefault();
    e.stopPropagation();
    closeDetailsPanel();
    dragDepthRef.current += 1;

    if (dragKind === 'asset') {
      setExternalDragFiles(null);
      return;
    }

    if (dragKind === 'externalFiles') {
      const files = getSupportedMediaFiles(e.dataTransfer);
      if (files.length > 0) {
        setExternalDragFiles(files);
        return;
      }

      if (hasSupportedMediaDrag(e.dataTransfer)) {
        setExternalDragFiles([]);
      }
      return;
    }

  }, [closeDetailsPanel]);

  const handleStorylineDragOver = useCallback((e: React.DragEvent) => {
    const dragKind = getDragKind(e.dataTransfer);
    if (dragKind === 'none') return;
    e.preventDefault();
    e.stopPropagation();
    closeDetailsPanel();

    const sceneTarget = findSceneFromPoint(e.clientX, e.clientY);
    if (!sceneTarget) {
      setPlaceholder(prev => prev === null ? prev : null);
      return;
    }

    const { sceneId, cutsContainer } = sceneTarget;
    if (dragKind === 'asset') {
      const insertIndex = calculateInsertIndex(sceneId, e.clientY, cutsContainer);
      setPlaceholder(prev => {
        if (prev?.sceneId === sceneId && prev?.insertIndex === insertIndex && prev?.type === 'asset') {
          return prev;
        }
        return {
          sceneId,
          insertIndex,
          type: 'asset',
        };
      });
      return;
    }

    if (dragKind === 'externalFiles') {
      const supportedFiles = getSupportedMediaFiles(e.dataTransfer);
      if (supportedFiles.length === 0 && !hasSupportedMediaDrag(e.dataTransfer) && !externalDragFiles) {
        setPlaceholder(prev => (prev?.sceneId === sceneId && prev?.type === 'external') ? null : prev);
        setExternalDragFiles(null);
        return;
      }

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
      return;
    }

  }, [calculateInsertIndex, externalDragFiles, closeDetailsPanel]);

  const handleStorylineDragLeave = useCallback((e: React.DragEvent) => {
    const dragKind = getDragKind(e.dataTransfer);
    if (dragKind === 'none') return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setPlaceholder(null);
      setExternalDragFiles(null);
    }
  }, []);

  const handleBackgroundClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.cut-card')) return;
    if (target.closest('.scene-header')) return;
    if (target.closest('.scene-menu')) return;
    if (target.closest('.scene-menu-btn')) return;
    if (target.closest('.scene-name-input')) return;
    if (target.closest('.add-scene-btn')) return;
    selectScene(null);
  };

  const handleInboundDrop = useCallback((e: React.DragEvent) => {
    const dragKind = getDragKind(e.dataTransfer);
    if (dragKind === 'none') return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;

    const sceneTarget = findSceneFromPoint(e.clientX, e.clientY);
    if (!sceneTarget) {
      setPlaceholder(null);
      setExternalDragFiles(null);
      return;
    }

    const { sceneId, cutsContainer } = sceneTarget;
    const insertIndex = calculateInsertIndex(sceneId, e.clientY, cutsContainer);
    handleDrop(sceneId, e, insertIndex).catch(() => {});
  }, [calculateInsertIndex]);

  return (
    <div
      className="storyline"
      onClick={handleBackgroundClick}
      onDragEnter={handleStorylineDragEnter}
      onDragOver={handleStorylineDragOver}
      onDragLeave={handleStorylineDragLeave}
      onDrop={handleInboundDrop}
    >
      <div className="storyline-content">
        {scenes.map((scene) => (
          <SceneColumn
            key={scene.id}
            sceneId={scene.id}
            sceneName={scene.name}
            cuts={scene.cuts}
            groups={scene.groups || []}
            isSelected={selectedSceneId === scene.id}
            onSelect={() => selectScene(scene.id)}
            activeId={activeId}
            placeholder={placeholder?.sceneId === scene.id ? placeholder : null}
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
    isLipSync?: boolean;
    lipSyncFrameCount?: number;
  }>;
  groups: CutGroup[];
  isSelected: boolean;
  onSelect: () => void;
  activeId: string | null;
  placeholder: PlaceholderState | null;
  sourceSceneId?: string;
  isOverDifferentScene?: boolean;
}

function SceneColumn({
  sceneId,
  sceneName,
  cuts,
  groups,
  isSelected,
  onSelect,
  activeId,
  placeholder,
  sourceSceneId,
  isOverDifferentScene,
}: SceneColumnProps) {
  const { scenes, selectedGroupId, selectGroup, toggleGroupCollapsed } = useStore();
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


  // Helper to find which group a cut belongs to
  const findGroupForCut = (cutId: string): CutGroup | undefined => {
    return groups.find(g => g.cutIds.includes(cutId));
  };

  // Build the list of items including placeholder and groups
  const renderItems = () => {
    const items: React.ReactNode[] = [];
    const renderedGroups = new Set<string>();

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

      // Check if this cut belongs to a group
      const group = findGroupForCut(cut.id);

      if (group && !renderedGroups.has(group.id)) {
        // This is the first cut of a group we haven't rendered yet
        renderedGroups.add(group.id);

        // Get all cuts in this group (in group order)
        const groupCuts = group.cutIds
          .map(id => cuts.find(c => c.id === id))
          .filter((c): c is Cut => c !== undefined);

        if (group.isCollapsed) {
          // Render collapsed group card
          items.push(
            <CutGroupCard
              key={`group-${group.id}`}
              group={group}
              cuts={groupCuts}
              sceneId={sceneId}
              index={i}
              isDragging={activeId === `group-${group.id}`}
            />
          );
        } else {
          // Render expanded group container
          items.push(
            <ExpandedGroupContainer
              key={`group-${group.id}`}
              group={group}
              sceneId={sceneId}
              isSelected={selectedGroupId === group.id}
              onSelect={() => selectGroup(group.id)}
              onToggleCollapse={() => toggleGroupCollapsed(sceneId, group.id)}
            >
              {groupCuts.map((groupCut) => {
                const isHidden = shouldHideDraggedCard && activeId === groupCut.id;
                return (
                  <CutCard
                    key={groupCut.id}
                    cut={groupCut}
                    sceneId={sceneId}
                    index={cuts.findIndex(c => c.id === groupCut.id)}
                    isDragging={activeId === groupCut.id}
                    isHidden={isHidden}
                  />
                );
              })}
            </ExpandedGroupContainer>
          );
        }
      } else if (!group) {
        // Regular cut not in any group
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
      // If cut is in a group that was already rendered, skip it
    }

    // Add placeholder at the end if needed
    if (placeholder && placeholder.insertIndex >= cuts.length) {
      items.push(placeholderElement);
    }

    // === DEMO: Add lip sync cut card at the end of first scene ===
    if (sceneId === scenes[0]?.id) {
      items.push(
        <CutCard
          key="demo-lipsync"
          cut={{
            id: 'demo-lipsync-1',
            assetId: 'demo-asset',
            displayTime: 3.0,
            order: cuts.length,
            isLipSync: true,
            lipSyncFrameCount: 4,
          }}
          sceneId={sceneId}
          index={cuts.length}
          isDragging={false}
        />
      );
    }
    // === END DEMO ===

    return items;
  };

  // Combine refs for the cuts container
  const setCombinedRef = (node: HTMLDivElement | null) => {
    setDroppableRef(node);
    (cutsContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  const buildSortableItems = () => {
    const items: string[] = [];
    const renderedGroups = new Set<string>();

    for (let i = 0; i < cuts.length; i++) {
      const cut = cuts[i];
      const group = findGroupForCut(cut.id);

      if (group && !renderedGroups.has(group.id)) {
        renderedGroups.add(group.id);

        if (group.isCollapsed) {
          items.push(`group-${group.id}`);
        } else {
          const groupCuts = group.cutIds
            .map(id => cuts.find(c => c.id === id))
            .filter((c): c is Cut => c !== undefined);
          items.push(...groupCuts.map(c => c.id));
        }
      } else if (!group) {
        items.push(cut.id);
      }
    }

    return items;
  };

  const sortableItems = buildSortableItems();

  return (
    <div
      className={`scene-column ${isSelected ? 'selected' : ''}`}
      data-scene-id={sceneId}
    >
      <div
        className="scene-header"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
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
        items={sortableItems}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setCombinedRef}
          className={`scene-cuts ${placeholder ? 'has-placeholder' : ''}`}
        >
          {renderItems()}
        </div>
      </SortableContext>
    </div>
  );
}
