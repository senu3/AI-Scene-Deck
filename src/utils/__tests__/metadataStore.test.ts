import { describe, expect, it } from 'vitest';
import {
  attachAudio,
  detachAudio,
  updateAudioOffset,
  syncSceneMetadata,
  updateLipSyncSettings,
  removeLipSyncSettings,
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
    const sceneMetadata = synced.sceneMetadata || {};
    expect(sceneMetadata['scene-1']?.name).toBe('Scene 1');
    expect(sceneMetadata['scene-1']?.notes.length).toBe(1);
    expect(sceneMetadata['scene-2']?.name).toBe('Scene 2');
  });

  it('sets and removes lip sync settings', () => {
    const settings = {
      baseImageAssetId: 'img-closed',
      variantAssetIds: ['img-half1', 'img-half2', 'img-open'],
      rmsSourceAudioAssetId: 'aud-1',
      thresholds: { t1: 0.1, t2: 0.2, t3: 0.3 },
      fps: 60,
      version: 1,
    };

    const withLipSync = updateLipSyncSettings(baseStore, 'asset-1', settings as any);
    expect(withLipSync.metadata['asset-1']?.lipSync?.baseImageAssetId).toBe('img-closed');
    expect(withLipSync.metadata['asset-1']?.lipSync?.variantAssetIds.length).toBe(3);

    const removed = removeLipSyncSettings(withLipSync, 'asset-1');
    expect(removed.metadata['asset-1']).toBeUndefined();
  });
});
