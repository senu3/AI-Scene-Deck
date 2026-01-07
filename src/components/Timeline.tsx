import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, MoreHorizontal, Circle } from 'lucide-react';
import { useStore } from '../store/useStore';
import CutCard from './CutCard';
import type { Asset } from '../types';
import { v4 as uuidv4 } from 'uuid';
import './Timeline.css';

interface TimelineProps {
  activeId: string | null;
}

export default function Timeline({ activeId }: TimelineProps) {
  const { scenes, addScene, selectedSceneId, selectScene, addCutToScene } = useStore();

  const handleDrop = (sceneId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drop-active');

    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const asset: Asset = JSON.parse(data);
        // Ensure the asset has a unique ID
        if (!asset.id) {
          asset.id = uuidv4();
        }
        addCutToScene(sceneId, asset);
      }
    } catch {
      // Invalid data, ignore
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

        <button className="add-scene-btn" onClick={addScene}>
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
  const { setNodeRef } = useDroppable({
    id: `dropzone-${sceneId}`,
    data: {
      sceneId,
      type: 'dropzone',
      index: cuts.length,
    },
  });

  return (
    <div
      className={`scene-column ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="scene-header">
        <div className="scene-indicator">
          <Circle size={16} />
        </div>
        <span className="scene-name">{sceneName.toUpperCase()}</span>
        <button className="scene-menu-btn">
          <MoreHorizontal size={16} />
        </button>
      </div>

      <SortableContext
        items={cuts.map(c => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
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
