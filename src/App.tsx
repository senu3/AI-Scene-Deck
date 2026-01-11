import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, pointerWithin, useDroppable, useSensors, useSensor, PointerSensor } from '@dnd-kit/core';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from './store/useStore';
import { useHistoryStore } from './store/historyStore';
import { AddCutCommand, ReorderCutsCommand, MoveCutBetweenScenesCommand, MoveCutsToSceneCommand, PasteCutsCommand, RemoveCutCommand } from './store/commands';
import Sidebar from './components/Sidebar';
import Timeline from './components/Timeline';
import DetailsPanel from './components/DetailsPanel';
import PlaybackControls from './components/PlaybackControls';
import PreviewModal from './components/PreviewModal';
import Header from './components/Header';
import StartupModal from './components/StartupModal';
import { Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Asset } from './types';
import { importFileToVault } from './utils/assetPath';
import { extractVideoMetadata } from './utils/videoUtils';
import './styles/App.css';

function TrashZone({ isActive }: { isActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'trash-zone',
    data: { type: 'trash' },
  });

  if (!isActive) return null;

  return (
    <div
      ref={setNodeRef}
      className={`trash-zone ${isOver ? 'over' : ''}`}
    >
      <Trash2 size={24} />
      <span>Drop to remove</span>
    </div>
  );
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

function App() {
  const {
    projectLoaded,
    scenes,
    removeCut,
    trashPath,
    vaultPath,
    selectedSceneId,
    getSelectedCutIds,
    getSelectedCuts,
    copySelectedCuts,
    canPaste,
    clearCutSelection,
  } = useStore();

  const { executeCommand, undo, redo } = useHistoryStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'cut' | 'scene' | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isWorkspaceDragOver, setIsWorkspaceDragOver] = useState(false);
  const dragDataRef = useRef<{ sceneId?: string; index?: number; type?: string }>({});

  // Configure drag sensors with distance activation constraint
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  );

  // Global keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Ctrl+Z or Cmd+Z for Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        try {
          await undo();
        } catch (error) {
          console.error('Undo failed:', error);
        }
      }

      // Ctrl+Shift+Z or Cmd+Shift+Z for Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        try {
          await redo();
        } catch (error) {
          console.error('Redo failed:', error);
        }
      }

      // Ctrl+Y or Cmd+Y for Redo (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        try {
          await redo();
        } catch (error) {
          console.error('Redo failed:', error);
        }
      }

      // Ctrl+C or Cmd+C for Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selectedIds = getSelectedCutIds();
        if (selectedIds.length > 0) {
          e.preventDefault();
          copySelectedCuts();
        }
      }

      // Ctrl+V or Cmd+V for Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (canPaste()) {
          e.preventDefault();
          // Paste to currently selected scene or first scene
          const targetSceneId = selectedSceneId || scenes[0]?.id;
          if (targetSceneId) {
            try {
              await executeCommand(new PasteCutsCommand(targetSceneId));
            } catch (error) {
              console.error('Paste failed:', error);
            }
          }
        }
      }

      // Delete or Backspace to remove selected cuts
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedCuts = getSelectedCuts();
        if (selectedCuts.length > 0) {
          e.preventDefault();
          // Delete all selected cuts
          for (const { scene, cut } of selectedCuts) {
            try {
              await executeCommand(new RemoveCutCommand(scene.id, cut.id));
            } catch (error) {
              console.error('Delete failed:', error);
            }
          }
          clearCutSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, copySelectedCuts, canPaste, selectedSceneId, scenes, executeCommand, getSelectedCutIds, getSelectedCuts, clearCutSelection]);

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { type?: string; sceneId?: string; index?: number } | undefined;
    setActiveId(event.active.id as string);
    setActiveType(data?.type === 'scene' ? 'scene' : 'cut');
    dragDataRef.current = data || {};
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Handle drag over for visual feedback
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeData = dragDataRef.current;

    setActiveId(null);
    setActiveType(null);
    dragDataRef.current = {};

    if (!over) {
      // Dropped outside - check if it's a cut being removed
      if (activeData.type === 'cut' && activeData.sceneId) {
        const removedCut = removeCut(activeData.sceneId, active.id as string);

        // Move file to trash if we have the API
        if (removedCut?.asset?.path && trashPath && window.electronAPI) {
          await window.electronAPI.moveToTrash(removedCut.asset.path, trashPath);
        }
      }
      return;
    }

    const overData = over.data.current as { sceneId?: string; index?: number; type?: string } | undefined;

    // Handle trash drop
    if (overData?.type === 'trash' && activeData.type === 'cut' && activeData.sceneId) {
      const removedCut = removeCut(activeData.sceneId, active.id as string);

      // Move file to trash if we have the API
      if (removedCut?.asset?.path && trashPath && window.electronAPI) {
        await window.electronAPI.moveToTrash(removedCut.asset.path, trashPath);
      }
      return;
    }

    // Handle cut reordering
    if (activeData.type === 'cut' && activeData.sceneId && overData?.sceneId) {
      const fromSceneId = activeData.sceneId;
      const toSceneId = overData.sceneId;
      const cutId = active.id as string;

      // Check if this is a multi-select drag
      const selectedIds = getSelectedCutIds();
      const isMultiDrag = selectedIds.length > 1 && selectedIds.includes(cutId);

      if (isMultiDrag) {
        // Multi-select drag: move all selected cuts together
        const toIndex = overData.type === 'dropzone' ?
          (scenes.find(s => s.id === toSceneId)?.cuts.length || 0) :
          (overData.index ?? 0);

        executeCommand(new MoveCutsToSceneCommand(selectedIds, toSceneId, toIndex)).catch((error) => {
          console.error('Failed to move cuts:', error);
        });
      } else if (fromSceneId === toSceneId) {
        // Single drag: Reorder within same scene
        const scene = scenes.find(s => s.id === fromSceneId);
        if (!scene) return;

        const fromIndex = scene.cuts.findIndex(c => c.id === cutId);
        const toIndex = overData.type === 'dropzone' ? scene.cuts.length : (overData.index ?? 0);

        if (fromIndex !== toIndex) {
          executeCommand(new ReorderCutsCommand(fromSceneId, cutId, toIndex, fromIndex)).catch((error) => {
            console.error('Failed to reorder cuts:', error);
          });
        }
      } else {
        // Single drag: Move between scenes
        const toIndex = overData.type === 'dropzone' ?
          (scenes.find(s => s.id === toSceneId)?.cuts.length || 0) :
          (overData.index ?? 0);
        executeCommand(new MoveCutBetweenScenesCommand(fromSceneId, toSceneId, cutId, toIndex)).catch((error) => {
          console.error('Failed to move cut between scenes:', error);
        });
      }
    }
  };

  // Handle native file drop from OS
  const handleWorkspaceDragOver = useCallback((e: React.DragEvent) => {
    // Check if files are being dragged
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsWorkspaceDragOver(true);
    }
  }, []);

  const handleWorkspaceDragLeave = useCallback((e: React.DragEvent) => {
    // Only hide if leaving the main area (not entering a child)
    if (e.currentTarget === e.target) {
      setIsWorkspaceDragOver(false);
    }
  }, []);

  const handleWorkspaceDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWorkspaceDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const targetSceneId = selectedSceneId || scenes[0]?.id;

    if (!targetSceneId) return;

    for (const file of files) {
      const mediaType = getMediaType(file.name);
      if (!mediaType) continue; // Skip non-media files

      // Get file path - in Electron we can access the path
      const filePath = (file as File & { path?: string }).path || file.name;
      const assetId = uuidv4();

      // Extract video metadata if it's a video
      let duration: number | undefined;
      if (mediaType === 'video') {
        const videoMeta = await extractVideoMetadata(filePath);
        if (videoMeta) {
          duration = videoMeta.duration;
        }
      }

      let asset: Asset;

      // If vault path is set, import to vault first
      if (vaultPath) {
        const importedAsset = await importFileToVault(
          filePath,
          vaultPath,
          assetId,
          {
            name: file.name,
            type: mediaType,
            duration,
          }
        );

        if (importedAsset) {
          asset = importedAsset;
        } else {
          // Fallback to original path if import fails
          console.warn('Failed to import to vault, using original path');
          asset = {
            id: assetId,
            name: file.name,
            path: filePath,
            type: mediaType,
            duration,
          };
        }
      } else {
        // No vault set, use original path
        asset = {
          id: assetId,
          name: file.name,
          path: filePath,
          type: mediaType,
          duration,
        };
      }

      // Use command for undo/redo support
      executeCommand(new AddCutCommand(targetSceneId, asset)).catch((error) => {
        console.error('Failed to add cut:', error);
      });
    }
  }, [selectedSceneId, scenes, vaultPath, executeCommand]);

  // Show startup modal if no project is loaded
  if (!projectLoaded) {
    return <StartupModal />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="app">
        <Header />
        <div className="app-content">
          <Sidebar />
          <main
            className={`main-area ${isWorkspaceDragOver ? 'file-drag-over' : ''}`}
            onDragOver={handleWorkspaceDragOver}
            onDragLeave={handleWorkspaceDragLeave}
            onDrop={handleWorkspaceDrop}
          >
            <Timeline activeId={activeId} activeType={activeType} />
            <PlaybackControls onPreview={() => setShowPreview(true)} />
            {isWorkspaceDragOver && (
              <div className="file-drop-overlay">
                <div className="file-drop-content">
                  <span>Drop files to add to timeline</span>
                </div>
              </div>
            )}
          </main>
          <DetailsPanel />
        </div>
        <TrashZone isActive={activeType === 'cut'} />
        {showPreview && <PreviewModal onClose={() => setShowPreview(false)} />}
      </div>
    </DndContext>
  );
}

export default App;
