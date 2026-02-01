import { Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useHistoryStore } from '../store/historyStore';
import { AddSceneCommand } from '../store/commands';
import './SceneChipBar.css';

interface SceneChipBarProps {
  className?: string;
}

export default function SceneChipBar({ className }: SceneChipBarProps) {
  const { scenes, selectedSceneId, selectScene } = useStore();
  const { executeCommand } = useHistoryStore();

  const handleSceneClick = (sceneId: string) => {
    selectScene(sceneId);

    // Scroll the scene into view in the storyline
    const sceneElement = document.querySelector(`[data-scene-id="${sceneId}"]`);
    if (sceneElement) {
      sceneElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const handleAddScene = async () => {
    try {
      const sceneName = `Scene ${scenes.length + 1}`;
      await executeCommand(new AddSceneCommand(sceneName));
    } catch (error) {
      console.error('Failed to add scene:', error);
    }
  };

  return (
    <div className={`scene-chip-bar ${className || ''}`}>
      {scenes.map((scene) => (
        <button
          key={scene.id}
          className={`scene-chip ${selectedSceneId === scene.id ? 'active' : ''}`}
          onClick={() => handleSceneClick(scene.id)}
          title={`${scene.name} - ${scene.cuts.length} cuts`}
        >
          <span className="scene-chip-name">{scene.name}</span>
          <span className="scene-chip-count">{scene.cuts.length}</span>
        </button>
      ))}
      <button
        className="scene-chip-add"
        onClick={handleAddScene}
        title="Add Scene"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
