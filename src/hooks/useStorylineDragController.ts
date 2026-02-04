import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { v4 as uuidv4 } from 'uuid';
import { AddCutCommand } from '../store/commands';
import type { Command } from '../store/historyStore';
import type { CutImportSource } from '../utils/cutImport';
import type { Asset, Scene } from '../types';

// --- DND: placeholder state ---
// Placeholder state for external file drops and cross-scene moves
export interface PlaceholderState {
  sceneId: string;
  insertIndex: number;
  type: 'external' | 'move' | 'asset';
}

// --- DND: native (external / asset) ---
type DragKind = 'asset' | 'externalFiles' | 'none';

// Helper to detect media type from filename
function getMediaType(filename: string): 'image' | 'video' | 'audio' | null {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
  const audioExts = ['mp3', 'wav', 'm4a', 'ogg', 'flac'];
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
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

interface UseStorylineDragControllerOptions {
  scenes: Scene[];
  active: DragStartEvent['active'] | null;
  over: DragEndEvent['over'] | null;
  vaultPath: string | null;
  createCutFromImport: (
    sceneId: string,
    source: CutImportSource,
    insertIndex?: number,
    vaultPathOverride?: string | null
  ) => Promise<string>;
  closeDetailsPanel: () => void;
  executeCommand: (command: Command) => Promise<void>;
}

export function useStorylineDragController({
  scenes,
  active,
  over,
  vaultPath,
  createCutFromImport,
  closeDetailsPanel,
  executeCommand,
}: UseStorylineDragControllerOptions) {
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

  return {
    placeholder,
    sourceSceneId,
    isOverDifferentScene,
    handleStorylineDragEnter,
    handleStorylineDragOver,
    handleStorylineDragLeave,
    handleInboundDrop,
  };
}
