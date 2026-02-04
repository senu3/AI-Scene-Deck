import { useMemo } from 'react';
import type { Scene } from '../types';
import { formatTimeCode } from '../hooks/useTimelinePosition';
import styles from './TimelineBar.module.css';

interface TimelineBarProps {
  scenes: Scene[];
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
}

export default function TimelineBar({ scenes, selectedSceneId, onSelectScene }: TimelineBarProps) {
  const sceneDurations = useMemo(
    () =>
      scenes.map((scene) =>
        scene.cuts.reduce((acc, cut) => acc + (isFinite(cut.displayTime) ? cut.displayTime : 0), 0)
      ),
    [scenes]
  );

  const segmentWeights = useMemo(
    () =>
      sceneDurations.map((duration) => (duration > 0 ? duration : 1)),
    [sceneDurations]
  );

  const totalDuration = useMemo(
    () => sceneDurations.reduce((acc, duration) => acc + duration, 0),
    [sceneDurations]
  );

  if (scenes.length === 0) {
    return (
      <div className={styles.timelineBar} aria-label="Timeline">
        <div className={styles.empty}>No scenes</div>
      </div>
    );
  }

  return (
    <div className={styles.timelineBar} role="list" aria-label="Timeline">
      {scenes.map((scene, index) => {
        const duration = sceneDurations[index];
        const isSelected = selectedSceneId === scene.id;
        const title = `${scene.name} • ${formatTimeCode(duration)} • ${scene.cuts.length} cuts`;

        return (
          <button
            key={scene.id}
            className={`${styles.segment} ${isSelected ? styles.segmentSelected : ''}`}
            style={{ flexGrow: segmentWeights[index] }}
            onClick={() => onSelectScene(scene.id)}
            title={title}
            aria-pressed={isSelected}
            type="button"
          >
            <span className={styles.segmentLabel}>{scene.name}</span>
          </button>
        );
      })}
      <div className={styles.total} title={`Total • ${formatTimeCode(totalDuration)}`}>
        {formatTimeCode(totalDuration)}
      </div>
    </div>
  );
}
