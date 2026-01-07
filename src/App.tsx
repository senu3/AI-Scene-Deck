import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, pointerWithin } from '@dnd-kit/core';
import { useState } from 'react';
import { useStore } from './store/useStore';
import Sidebar from './components/Sidebar';
import Timeline from './components/Timeline';
import DetailsPanel from './components/DetailsPanel';
import PlaybackControls from './components/PlaybackControls';
import PreviewModal from './components/PreviewModal';
import Header from './components/Header';
import './styles/App.css';

function App() {
  const { moveCutBetweenScenes, reorderCuts, scenes } = useStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Handle drag over for visual feedback
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeData = active.data.current as { sceneId: string; index: number } | undefined;
    const overData = over.data.current as { sceneId: string; index: number; type: string } | undefined;

    if (!activeData || !overData) return;

    const fromSceneId = activeData.sceneId;
    const toSceneId = overData.sceneId;
    const cutId = active.id as string;

    if (fromSceneId === toSceneId) {
      // Reorder within same scene
      const scene = scenes.find(s => s.id === fromSceneId);
      if (!scene) return;

      const fromIndex = scene.cuts.findIndex(c => c.id === cutId);
      const toIndex = overData.type === 'dropzone' ? scene.cuts.length : overData.index;

      if (fromIndex !== toIndex) {
        reorderCuts(fromSceneId, fromIndex, toIndex);
      }
    } else {
      // Move between scenes
      const toIndex = overData.type === 'dropzone' ?
        (scenes.find(s => s.id === toSceneId)?.cuts.length || 0) :
        overData.index;
      moveCutBetweenScenes(fromSceneId, toSceneId, cutId, toIndex);
    }
  };

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
            <Timeline activeId={activeId} />
            <PlaybackControls onPreview={() => setShowPreview(true)} />
          </main>
          <DetailsPanel />
        </div>
        {showPreview && <PreviewModal onClose={() => setShowPreview(false)} />}
      </div>
    </DndContext>
  );
}

export default App;
