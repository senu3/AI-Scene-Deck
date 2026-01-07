import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, pointerWithin, useDroppable } from '@dnd-kit/core';
import { useState, useRef } from 'react';
import { useStore } from './store/useStore';
import Sidebar from './components/Sidebar';
import Timeline from './components/Timeline';
import DetailsPanel from './components/DetailsPanel';
import PlaybackControls from './components/PlaybackControls';
import PreviewModal from './components/PreviewModal';
import Header from './components/Header';
import StartupModal from './components/StartupModal';
import { Trash2 } from 'lucide-react';
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

function App() {
  const {
    projectLoaded,
    moveCutBetweenScenes,
    reorderCuts,
    reorderScenes,
    scenes,
    removeCut,
    trashPath,
  } = useStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'cut' | 'scene' | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const dragDataRef = useRef<{ sceneId?: string; index?: number; type?: string }>({});

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

    // Handle scene reordering
    if (activeData.type === 'scene' && overData?.type === 'scene') {
      const fromIndex = scenes.findIndex(s => s.id === active.id);
      const toIndex = scenes.findIndex(s => s.id === over.id);
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        reorderScenes(fromIndex, toIndex);
      }
      return;
    }

    // Handle cut reordering
    if (activeData.type === 'cut' && activeData.sceneId && overData?.sceneId) {
      const fromSceneId = activeData.sceneId;
      const toSceneId = overData.sceneId;
      const cutId = active.id as string;

      if (fromSceneId === toSceneId) {
        // Reorder within same scene
        const scene = scenes.find(s => s.id === fromSceneId);
        if (!scene) return;

        const fromIndex = scene.cuts.findIndex(c => c.id === cutId);
        const toIndex = overData.type === 'dropzone' ? scene.cuts.length : (overData.index ?? 0);

        if (fromIndex !== toIndex) {
          reorderCuts(fromSceneId, fromIndex, toIndex);
        }
      } else {
        // Move between scenes
        const toIndex = overData.type === 'dropzone' ?
          (scenes.find(s => s.id === toSceneId)?.cuts.length || 0) :
          (overData.index ?? 0);
        moveCutBetweenScenes(fromSceneId, toSceneId, cutId, toIndex);
      }
    }
  };

  // Show startup modal if no project is loaded
  if (!projectLoaded) {
    return <StartupModal />;
  }

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="app">
        <Header />
        <div className="app-content">
          <Sidebar />
          <main className="main-area">
            <Timeline activeId={activeId} activeType={activeType} />
            <PlaybackControls onPreview={() => setShowPreview(true)} />
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
