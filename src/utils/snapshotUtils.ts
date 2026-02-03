import type { Scene } from '../types';

export function cloneScenes(scenes: Scene[]): Scene[] {
  if (typeof structuredClone === 'function') {
    return structuredClone(scenes);
  }
  return JSON.parse(JSON.stringify(scenes)) as Scene[];
}
