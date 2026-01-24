import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, pointerWithin, useDroppable, useSensors, useSensor, PointerSensor } from '@dnd-kit/core';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from './store/useStore';
import { useHistoryStore } from './store/historyStore';
import { AddCutCommand, ReorderCutsCommand, MoveCutBetweenScenesCommand, MoveCutsToSceneCommand, PasteCutsCommand, RemoveCutCommand, UpdateClipPointsCommand } from './store/commands';
import Sidebar from './components/Sidebar';
import Storyline from './components/Storyline';
import DetailsPanel from './components/DetailsPanel';
import PlaybackControls from './components/PlaybackControls';
import PreviewModal from './components/PreviewModal';
import Header from './components/Header';
import StartupModal from './components/StartupModal';
import { Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Asset } from './types';
import { importFileToVault } from './utils/assetPath';
import { extractVideoMetadata, generateVideoThumbnail } from './utils/videoUtils';
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

// Helper to check if other cuts reference the same asset
function hasOtherCutsWithSameAsset(
  scenes: Array<{ cuts: Array<{ id: string; assetId: string }> }>,
  excludeCutId: string,
  assetId: string
): boolean {
  for (const scene of scenes) {
    for (const cut of scene.cuts) {
      if (cut.id !== excludeCutId && cut.assetId === assetId) {
        return true;
      }
    }
  }
  return false;
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
    videoPreviewCutId,
    closeVideoPreview,
    cacheAsset,
    updateCutAsset,
    addLoadingCutToScene,
    updateCutWithAsset,
    refreshAllSourceFolders,
  } = useStore();

  const { executeCommand, undo, redo } = useHistoryStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'cut' | 'scene' | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isWorkspaceDragOver, setIsWorkspaceDragOver] = useState(false);
  const [exportResolution, setExportResolution] = useState({ name: 'Free', width: 0, height: 0 });
  const [isExporting, setIsExporting] = useState(false);
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
      // Dropped outside timeline - just remove cut from timeline (keep file in assets)
      if (activeData.type === 'cut' && activeData.sceneId) {
        const cutId = active.id as string;
        removeCut(activeData.sceneId, cutId);
        // Don't move file to trash - just remove from timeline
      }
      return;
    }

    const overData = over.data.current as { sceneId?: string; index?: number; type?: string } | undefined;

    // Handle trash drop - move file to .trash folder
    if (overData?.type === 'trash' && activeData.type === 'cut' && activeData.sceneId) {
      const cutId = active.id as string;
      const cutToRemove = scenes.flatMap(s => s.cuts).find(c => c.id === cutId);

      // Only move file to trash if no other cuts reference the same asset
      const shouldDeleteFile = cutToRemove?.assetId &&
        !hasOtherCutsWithSameAsset(scenes, cutId, cutToRemove.assetId);

      const removedCut = removeCut(activeData.sceneId, cutId);

      // Move file to trash if we have the API and no other cuts use this asset
      if (shouldDeleteFile && removedCut?.asset?.path && trashPath && window.electronAPI) {
        await window.electronAPI.moveToTrash(removedCut.asset.path, trashPath);
        // Refresh sidebar after moving to trash
        refreshAllSourceFolders();
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

    // Check if this is an internal drag (from Sidebar) - if so, skip file processing
    // Internal drags use application/json data and are handled by Timeline's drop handler
    const jsonData = e.dataTransfer.getData('application/json');
    if (jsonData) {
      // This is an internal drag from Sidebar, let Timeline handle it
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    const targetSceneId = selectedSceneId || scenes[0]?.id;

    if (!targetSceneId) return;

    for (const file of files) {
      const mediaType = getMediaType(file.name);
      // Skip files without a valid path (browser-generated thumbnails, etc.)
      const filePath = (file as File & { path?: string }).path;
      if (!filePath) {
        console.warn('Skipping file without path:', file.name);
        continue;
      }
      if (!mediaType) continue; // Skip non-media files
      const assetId = uuidv4();

      // Create empty loading cut card immediately
      const cutId = addLoadingCutToScene(targetSceneId, assetId, file.name);

      // Import file in background
      (async () => {
        try {
          // Extract video metadata and thumbnail if it's a video
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
            // Generate thumbnail from first frame (timeOffset=0)
            const thumb = await generateVideoThumbnail(filePath, 0);
            if (thumb) {
              thumbnail = thumb;
            }
          }

          let asset: Asset;

          // Get file size
          const fileSize = file.size;

          // If vault path is set, import to vault first (always copy now)
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
              // Fallback to original path if import fails
              console.warn('Failed to import to vault, using original path');
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
            // No vault set, use original path
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

          // Update the loading cut with actual asset data
          const displayTime = mediaType === 'video' && duration ? duration : 1.0;
          updateCutWithAsset(targetSceneId, cutId, asset, displayTime);

          // Refresh sidebar to show new file in assets folder
          refreshAllSourceFolders();
        } catch (error) {
          console.error('Failed to import file:', error);
          // Remove the loading cut on error
          removeCut(targetSceneId, cutId);
        }
      })();
    }
  }, [selectedSceneId, scenes, vaultPath, addLoadingCutToScene, updateCutWithAsset, refreshAllSourceFolders, removeCut]);

  // Export sequence from PlaybackControls
  const handleExportFromControls = useCallback(async () => {
    if (!window.electronAPI || isExporting) return;

    setIsExporting(true);

    try {
      // Build sequence items
      const sequenceItems = scenes.flatMap(scene =>
        scene.cuts.map(cut => ({
          type: cut.asset?.type || 'image' as const,
          path: cut.asset?.path || '',
          duration: cut.displayTime,
          inPoint: cut.isClip ? cut.inPoint : undefined,
          outPoint: cut.isClip ? cut.outPoint : undefined,
        }))
      ).filter(item => item.path);

      if (sequenceItems.length === 0) {
        alert('No items to export. Add some cuts to the timeline first.');
        setIsExporting(false);
        return;
      }

      // Show save dialog
      const outputPath = await window.electronAPI.showSaveSequenceDialog('sequence_export.mp4');
      if (!outputPath) {
        setIsExporting(false);
        return;
      }

      // Use selected resolution (default FHD)
      const width = exportResolution.width > 0 ? exportResolution.width : 1920;
      const height = exportResolution.height > 0 ? exportResolution.height : 1080;

      const result = await window.electronAPI.exportSequence({
        items: sequenceItems,
        outputPath,
        width,
        height,
        fps: 30,
      });

      if (result.success) {
        alert(`Export complete!\nFile: ${result.outputPath}\nSize: ${(result.fileSize! / 1024 / 1024).toFixed(2)} MB`);
      } else {
        alert(`Export failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Export error: ${String(error)}`);
    } finally {
      setIsExporting(false);
    }
  }, [scenes, exportResolution, isExporting]);

  // Find cut data for Single Mode preview modal
  const previewCutData = useCallback(() => {
    if (!videoPreviewCutId) return null;
    for (const scene of scenes) {
      const cut = scene.cuts.find(c => c.id === videoPreviewCutId);
      if (cut && cut.asset) {
        return { scene, cut, asset: cut.asset };
      }
    }
    return null;
  }, [videoPreviewCutId, scenes]);

  const previewData = previewCutData();

  // Handle clip save from video preview modal
  const handleVideoPreviewClipSave = useCallback(async (inPoint: number, outPoint: number) => {
    if (!previewData) return;
    const { scene, cut, asset } = previewData;

    // Update cut with clip points
    await executeCommand(new UpdateClipPointsCommand(scene.id, cut.id, inPoint, outPoint));

    // Regenerate thumbnail at IN point
    if (asset.path) {
      const newThumbnail = await generateVideoThumbnail(asset.path, inPoint);
      if (newThumbnail) {
        // Update both the cut's asset and the cache
        updateCutAsset(scene.id, cut.id, { thumbnail: newThumbnail });
        cacheAsset({ ...asset, thumbnail: newThumbnail });
      }
    }
  }, [previewData, executeCommand, cacheAsset, updateCutAsset]);

  // Handle frame capture from video preview modal
  const handleVideoPreviewFrameCapture = useCallback(async (timestamp: number) => {
    if (!previewData || !vaultPath) {
      alert('Cannot capture frame: missing required data');
      return;
    }

    const { scene, asset } = previewData;

    if (!window.electronAPI?.extractVideoFrame || !window.electronAPI?.ensureAssetsFolder) {
      alert('Frame capture requires app restart after update.');
      return;
    }

    try {
      const assetsFolder = await window.electronAPI.ensureAssetsFolder(vaultPath);
      if (!assetsFolder) {
        alert('Failed to access assets folder');
        return;
      }

      const baseName = asset.name.replace(/\.[^/.]+$/, '');
      const timeStr = timestamp.toFixed(2).replace('.', '_');
      const uniqueId = uuidv4().substring(0, 8);
      const frameFileName = `${baseName}_frame_${timeStr}_${uniqueId}.png`;
      const outputPath = `${assetsFolder}/${frameFileName}`.replace(/\\/g, '/');

      const result = await window.electronAPI.extractVideoFrame({
        sourcePath: asset.path,
        outputPath,
        timestamp,
      });

      if (!result.success) {
        alert(`Failed to capture frame: ${result.error}`);
        return;
      }

      const thumbnailBase64 = await window.electronAPI.readFileAsBase64(outputPath);

      const newAssetId = uuidv4();
      const newAsset: Asset = {
        id: newAssetId,
        name: frameFileName,
        path: outputPath,
        type: 'image',
        thumbnail: thumbnailBase64 || undefined,
        vaultRelativePath: `assets/${frameFileName}`,
      };

      cacheAsset(newAsset);
      await executeCommand(new AddCutCommand(scene.id, newAsset));

      alert(`Frame captured!\n\nFile: ${frameFileName}`);
    } catch (error) {
      console.error('Frame capture failed:', error);
      alert(`Failed to capture frame: ${error}`);
    }
  }, [previewData, vaultPath, cacheAsset, executeCommand]);

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
            <Storyline activeId={activeId} activeType={activeType} />
            <PlaybackControls
              onPreview={() => setShowPreview(true)}
              onExport={handleExportFromControls}
              isExporting={isExporting}
            />
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
        {showPreview && (
          <PreviewModal
            onClose={() => setShowPreview(false)}
            exportResolution={exportResolution}
            onResolutionChange={setExportResolution}
          />
        )}
        {previewData && (
          <PreviewModal
            asset={previewData.asset}
            onClose={closeVideoPreview}
            initialInPoint={previewData.cut.inPoint}
            initialOutPoint={previewData.cut.outPoint}
            onClipSave={handleVideoPreviewClipSave}
            onFrameCapture={handleVideoPreviewFrameCapture}
            exportResolution={exportResolution}
            onResolutionChange={setExportResolution}
          />
        )}
      </div>
    </DndContext>
  );
}

export default App;
