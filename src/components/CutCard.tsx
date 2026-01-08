import { useDraggable } from '@dnd-kit/core';
import { useState, useEffect } from 'react';
import { Film, Image, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { Asset } from '../types';
import './CutCard.css';

interface CutCardProps {
  cut: {
    id: string;
    assetId: string;
    asset?: Asset;
    displayTime: number;
    order: number;
  };
  sceneId: string;
  index: number;
  isDragging: boolean;
}

export default function CutCard({ cut, sceneId, index, isDragging }: CutCardProps) {
  const { selectedCutId, selectCut, getAsset } = useStore();
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({
    id: cut.id,
    data: {
      type: 'cut',
      sceneId,
      index,
    },
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  const asset = cut.asset || getAsset(cut.assetId);
  const isSelected = selectedCutId === cut.id;
  const isVideo = asset?.type === 'video';

  useEffect(() => {
    const loadThumbnail = async () => {
      if (asset?.thumbnail) {
        setThumbnail(asset.thumbnail);
        return;
      }

      if (asset?.path && window.electronAPI) {
        try {
          const base64 = await window.electronAPI.readFileAsBase64(asset.path);
          if (base64) {
            setThumbnail(base64);
          }
        } catch {
          // Failed to load thumbnail
        }
      }
    };

    loadThumbnail();
  }, [asset]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectCut(cut.id);
  };

  const getBadgeColor = () => {
    // Generate a consistent color based on asset type
    if (isVideo) return 'var(--accent-purple)';
    return 'var(--accent-primary)';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cut-card ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={handleClick}
    >
      <div className="cut-thumbnail-container">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={asset?.name || 'Cut'}
            className="cut-thumbnail"
          />
        ) : (
          <div className="cut-thumbnail placeholder">
            {isVideo ? (
              <Film size={24} className="placeholder-icon" />
            ) : (
              <Image size={24} className="placeholder-icon" />
            )}
          </div>
        )}

        <div className="cut-badge" style={{ backgroundColor: getBadgeColor() }}>
          {isVideo ? 'S:VID' : 'S:IMG'}
        </div>

        <div className="cut-duration">
          <Clock size={10} />
          <span>{cut.displayTime.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}
