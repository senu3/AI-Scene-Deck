import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, pointerWithin, useDroppable, useSensors, useSensor, PointerSensor } from '@dnd-kit/core';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from './store/useStore';
import { useHistoryStore } from './store/historyStore';
import { AddCutCommand, ReorderCutsCommand, MoveCutBetweenScenesCommand, MoveCutsToSceneCommand, PasteCutsCommand, RemoveCutCommand, UpdateClipPointsCommand } from './store/commands';
import AssetDrawer from './components/AssetDrawer';
import Sidebar from './components/Sidebar';
import SceneChipBar from './components/SceneChipBar';
import Storyline from './components/Storyline';
import DetailsPanel from './components/DetailsPanel';
import PlaybackControls from './components/PlaybackControls';
import PreviewModal from './components/PreviewModal';
import Header from './components/Header';
import StartupModal from './components/StartupModal';
import ExportModal, { type ExportSettings } from './components/ExportModal';
import { Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Asset } from './types';
import { generateVideoThumbnail } from './utils/videoUtils';
import { importFileToVault } from './utils/assetPath';
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
    createCutFromImport,
    refreshAllSourceFolders,
    toggleAssetDrawer,
    sidebarOpen,
    toggleSidebar,
    getCutGroup,
    removeCutFromGroup,
    updateGroupCutOrder,
  } = useStore();

  const { executeCommand, undo, redo } = useHistoryStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'cut' | 'scene' | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportResolution, setExportResolution] = useState({ name: 'Free', width: 0, height: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const dragDataRef = useRef<{ sceneId?: string; index?: number; type?: string }>({});

  const insertCutsIntoGroup = useCallback((sceneId: string, groupId: string, cutIds: string[], insertIndex?: number) => {
    const scene = scenes.find(s => s.id === sceneId);
    const group = scene?.groups?.find(g => g.id === groupId);
    if (!group) return;

    const incoming = cutIds.filter(id => !group.cutIds.includes(id));
    if (incoming.length === 0) return;

    const nextOrder = [...group.cutIds];
    const safeIndex = insertIndex !== undefined
      ? Math.min(Math.max(insertIndex, 0), nextOrder.length)
      : nextOrder.length;
    nextOrder.splice(safeIndex, 0, ...incoming);
    updateGroupCutOrder(sceneId, groupId, nextOrder);
  }, [scenes, updateGroupCutOrder]);

  const removeCutsFromGroups = useCallback((sceneId: string, cutIds: string[], keepGroupId?: string) => {
    for (const cutId of cutIds) {
      const group = getCutGroup(sceneId, cutId);
      if (group && group.id !== keepGroupId) {
        removeCutFromGroup(sceneId, group.id, cutId);
      }
    }
  }, [getCutGroup, removeCutFromGroup]);

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

      // Tab key to toggle asset drawer
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggleAssetDrawer();
        return;
      }

      // Ctrl+B or Cmd+B to toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, copySelectedCuts, canPaste, selectedSceneId, scenes, executeCommand, getSelectedCutIds, getSelectedCuts, clearCutSelection, toggleAssetDrawer, toggleSidebar]);

  // App menu shortcut (native menubar)
  useEffect(() => {
    if (!window.electronAPI?.onToggleSidebar) return undefined;
    const unsubscribe = window.electronAPI.onToggleSidebar(() => {
      toggleSidebar();
    });
    return () => unsubscribe();
  }, [toggleSidebar]);

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
    const activeData = dragDataRef.current as { sceneId?: string; index?: number; type?: string; groupId?: string; cutIds?: string[] };

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

    const overData = over.data.current as { sceneId?: string; index?: number; type?: string; groupId?: string } | undefined;

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
        const assetId = removedCut.asset.id || removedCut.assetId;
        if (window.electronAPI.moveToTrashWithMeta) {
          await window.electronAPI.moveToTrashWithMeta(removedCut.asset.path, trashPath, {
            assetId,
            originRefs: [{ sceneId: activeData.sceneId, cutId }],
            reason: 'trash-drop',
          });
        } else {
          await window.electronAPI.moveToTrash(removedCut.asset.path, trashPath);
        }
        // Refresh sidebar after moving to trash
        refreshAllSourceFolders();
      }
      return;
    }

    // Handle group drag - move all cuts in the group together
    if (activeData.type === 'group' && activeData.sceneId && activeData.cutIds && overData?.sceneId) {
      const fromSceneId = activeData.sceneId;
      const toSceneId = overData.sceneId;
      const cutIds = activeData.cutIds;

      // Groups can only be moved within the same scene
      if (fromSceneId !== toSceneId) {
        console.warn('Groups cannot be moved between scenes');
        return;
      }

      const toIndex = overData.type === 'dropzone' ?
        (scenes.find(s => s.id === toSceneId)?.cuts.length || 0) :
        (overData.index ?? 0);

      // Move all cuts in the group together
      executeCommand(new MoveCutsToSceneCommand(cutIds, toSceneId, toIndex)).catch((error) => {
        console.error('Failed to move group cuts:', error);
      });
      return;
    }

    // Handle cut reordering
    if (activeData.type === 'cut' && activeData.sceneId && overData?.sceneId) {
      const fromSceneId = activeData.sceneId;
      const toSceneId = overData.sceneId;
      const cutId = active.id as string;

      // Check if this cut is in a group
      const cutGroup = getCutGroup(fromSceneId, cutId);

      // Check if the drop target is inside a group
      const overId = over.id as string;
      const overCutGroup = overData.type !== 'dropzone' && overData.type !== 'group'
        ? getCutGroup(toSceneId, overId)
        : undefined;

      const targetGroupId = overCutGroup?.id || overData.groupId;
      const targetGroupInsertIndex = overCutGroup
        ? Math.max(0, overCutGroup.cutIds.indexOf(overId))
        : undefined;
      const isMovingOutOfGroup = cutGroup && (!targetGroupId || targetGroupId !== cutGroup.id);

      // Check if this is a multi-select drag
      const selectedIds = getSelectedCutIds();
      const isMultiDrag = selectedIds.length > 1 && selectedIds.includes(cutId);

      if (isMultiDrag) {
        // Multi-select drag: move all selected cuts together
        const toIndex = overData.type === 'dropzone' ?
          (scenes.find(s => s.id === toSceneId)?.cuts.length || 0) :
          (overData.index ?? 0);

        try {
          await executeCommand(new MoveCutsToSceneCommand(selectedIds, toSceneId, toIndex));
        } catch (error) {
          console.error('Failed to move cuts:', error);
        }

        // Remove from group if moving out
        if (isMovingOutOfGroup) {
          removeCutsFromGroups(fromSceneId, selectedIds, targetGroupId);
        }

        if (targetGroupId) {
          insertCutsIntoGroup(toSceneId, targetGroupId, selectedIds, targetGroupInsertIndex);
        }
      } else if (fromSceneId === toSceneId) {
        // Single drag: Reorder within same scene
        const scene = scenes.find(s => s.id === fromSceneId);
        if (!scene) return;

        const fromIndex = scene.cuts.findIndex(c => c.id === cutId);
        const toIndex = overData.type === 'dropzone' ? scene.cuts.length : (overData.index ?? 0);

        if (fromIndex !== toIndex) {
          try {
            await executeCommand(new ReorderCutsCommand(fromSceneId, cutId, toIndex, fromIndex));
          } catch (error) {
            console.error('Failed to reorder cuts:', error);
          }
        }

        // Remove from group if moving out of the group
        if (isMovingOutOfGroup && cutGroup) {
          removeCutFromGroup(fromSceneId, cutGroup.id, cutId);
        }

        if (targetGroupId && targetGroupId !== cutGroup?.id) {
          insertCutsIntoGroup(toSceneId, targetGroupId, [cutId], targetGroupInsertIndex);
        }
      } else {
        // Single drag: Move between scenes (automatically removes from group in store)
        const toIndex = overData.type === 'dropzone' ?
          (scenes.find(s => s.id === toSceneId)?.cuts.length || 0) :
          (overData.index ?? 0);
        try {
          await executeCommand(new MoveCutBetweenScenesCommand(fromSceneId, toSceneId, cutId, toIndex));
        } catch (error) {
          console.error('Failed to move cut between scenes:', error);
        }

        if (targetGroupId) {
          insertCutsIntoGroup(toSceneId, targetGroupId, [cutId], targetGroupInsertIndex);
        }
      }
    }
  };

  // Handle native file drop from OS (fallback when not dropping on a scene)
  const handleWorkspaceDragOver = useCallback((e: React.DragEvent) => {
    // Check if files are being dragged
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handleWorkspaceDragLeave = useCallback((_e: React.DragEvent) => {
    // No-op, kept for consistency
  }, []);

  const handleWorkspaceDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

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
      createCutFromImport(targetSceneId, {
        assetId,
        name: file.name,
        sourcePath: filePath,
        type: mediaType,
        fileSize: file.size,
      }).catch(() => {});
    }
  }, [selectedSceneId, scenes, createCutFromImport]);

  // Open export modal from PlaybackControls
  const handleExportFromControls = useCallback(() => {
    if (isExporting) return;
    setShowExportModal(true);
  }, [isExporting]);

  // Handle export from ExportModal
  const handleExport = useCallback(async (settings: ExportSettings) => {
    if (!window.electronAPI || isExporting) return;

    setShowExportModal(false);
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

      // For now, use existing MP4 export logic
      // TODO: Implement AviUtl export based on settings.format
      if (settings.format === 'aviutl') {
        // Placeholder: AviUtl export not yet implemented
        alert(`AviUtl export to:\n${settings.outputPath}\n\nRounding: ${settings.aviutl.roundingMode}\nCopy media: ${settings.aviutl.copyMedia}\n\n(Export logic not yet implemented)`);
        setIsExporting(false);
        return;
      }

      // MP4 export (existing logic)
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
      const baseAsset: Asset = {
        id: newAssetId,
        name: frameFileName,
        path: outputPath,
        type: 'image',
        thumbnail: thumbnailBase64 || undefined,
        vaultRelativePath: `assets/${frameFileName}`,
      };

      const importedAsset = await importFileToVault(outputPath, vaultPath, newAssetId, baseAsset);
      const finalAsset = importedAsset ?? baseAsset;

      cacheAsset(finalAsset);
      await executeCommand(new AddCutCommand(scene.id, finalAsset));

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
        <AssetDrawer />
        <Header />
        <div className="app-content">
          {sidebarOpen && <Sidebar />}
          <main
            className="main-area"
            onDragOver={handleWorkspaceDragOver}
            onDragLeave={handleWorkspaceDragLeave}
            onDrop={handleWorkspaceDrop}
          >
            <SceneChipBar />
            <Storyline activeId={activeId} activeType={activeType} />
            <PlaybackControls
              onPreview={() => setShowPreview(true)}
              onExport={handleExportFromControls}
              isExporting={isExporting}
            />
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
        <ExportModal
          open={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />
      </div>
    </DndContext>
  );
}

export default App;
