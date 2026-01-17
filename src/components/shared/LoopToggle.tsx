import { Repeat } from 'lucide-react';
import './timeline-common.css';

interface LoopToggleProps {
  isLooping: boolean;
  onToggle: () => void;
}

export function LoopToggle({ isLooping, onToggle }: LoopToggleProps) {
  return (
    <button
      className={`control-btn icon-btn ${isLooping ? 'active' : ''}`}
      onClick={onToggle}
      title={`Loop (L) - ${isLooping ? 'On' : 'Off'}`}
    >
      <Repeat size={18} />
    </button>
  );
}
