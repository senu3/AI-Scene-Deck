import { create } from 'zustand';
import type { Scene } from '../types';
import { cloneScenes } from '../utils/snapshotUtils';

export type SnapshotSlot = 'manual-save' | 'initial-load';

export interface SceneSnapshot {
  slot: SnapshotSlot;
  createdAt: string;
  label: string;
  reason: string;
  scenes: Scene[];
}

interface SnapshotState {
  snapshots: Record<SnapshotSlot, SceneSnapshot | null>;
  setSnapshot: (slot: SnapshotSlot, snapshot: Omit<SceneSnapshot, 'slot'>) => void;
  getSnapshot: (slot: SnapshotSlot) => SceneSnapshot | null;
  clearSnapshot: (slot: SnapshotSlot) => void;
}

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  snapshots: {
    'manual-save': null,
    'initial-load': null,
  },
  setSnapshot: (slot, snapshot) => {
    const safeSnapshot: SceneSnapshot = {
      ...snapshot,
      slot,
      scenes: cloneScenes(snapshot.scenes),
    };
    set((state) => ({
      snapshots: {
        ...state.snapshots,
        [slot]: safeSnapshot,
      },
    }));
  },
  getSnapshot: (slot) => get().snapshots[slot],
  clearSnapshot: (slot) => {
    set((state) => ({
      snapshots: {
        ...state.snapshots,
        [slot]: null,
      },
    }));
  },
}));
