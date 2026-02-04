import { describe, expect, it } from 'vitest';
import {
  attachAudio,
  detachAudio,
  updateAudioOffset,
  syncSceneMetadata,
} from '../metadataStore';

const baseStore = {
  version: 1,
  metadata: {},
  sceneMetadata: {},
};

describe('metadataStore', () => {
  it('attaches and detaches audio metadata', () => {
    const withAudio = attachAudio(baseStore, 'asset-1', 'audio-1', 'audio.wav', 1.25);
    expect(withAudio.metadata['asset-1']?.attachedAudioId).toBe('audio-1');
    expect(withAudio.metadata['asset-1']?.attachedAudioOffset).toBe(1.25);

    const detached = detachAudio(withAudio, 'asset-1');
    expect(detached.metadata['asset-1']).toBeUndefined();
  });

  it('updates audio offset only when audio is attached', () => {
    const withAudio = attachAudio(baseStore, 'asset-1', 'audio-1', 'audio.wav', 0);
    const updated = updateAudioOffset(withAudio, 'asset-1', 2.5);
    expect(updated.metadata['asset-1']?.attachedAudioOffset).toBe(2.5);

    const noChange = updateAudioOffset(baseStore, 'asset-1', 5);
    expect(noChange.metadata['asset-1']).toBeUndefined();
  });

  it('syncs scene metadata names and notes', () => {
    const scenes = [
      { id: 'scene-1', name: 'Scene 1', notes: [{ id: 'n1', content: 'note', createdAt: 't' }] },
      { id: 'scene-2', name: 'Scene 2', notes: [] },
    ];

    const synced = syncSceneMetadata(baseStore, scenes as any);
    expect(synced.sceneMetadata['scene-1']?.name).toBe('Scene 1');
    expect(synced.sceneMetadata['scene-1']?.notes.length).toBe(1);
    expect(synced.sceneMetadata['scene-2']?.name).toBe('Scene 2');
  });
});
