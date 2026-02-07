import { describe, expect, it } from 'vitest';
import { useStore } from '../useStore';
import { resetElectronMocks } from '../../test/setup.renderer';

describe('lip sync store integration', () => {
  it('persists lip sync settings to metadata store payload', () => {
    resetElectronMocks();
    const initialState = useStore.getState();

    useStore.setState({
      ...initialState,
      vaultPath: 'C:/vault',
      metadataStore: { version: 1, metadata: {}, sceneMetadata: {} },
    }, false);

    const settings = {
      baseImageAssetId: 'img-closed',
      variantAssetIds: ['img-half1', 'img-half2', 'img-open'],
      rmsSourceAudioAssetId: 'aud-1',
      thresholds: { t1: 0.1, t2: 0.2, t3: 0.3 },
      fps: 60,
      version: 1,
    };

    useStore.getState().setLipSyncForAsset('asset-1', settings as any);

    const store = useStore.getState();
    expect(store.metadataStore?.metadata['asset-1']?.lipSync?.baseImageAssetId).toBe('img-closed');

    const saveProject = window.electronAPI?.saveProject as unknown as { mock: { calls: any[] } };
    expect(saveProject?.mock.calls.length).toBeGreaterThan(0);
    const lastPayload = saveProject.mock.calls.at(-1)?.[0];
    const parsed = JSON.parse(lastPayload);
    expect(parsed.metadata['asset-1'].lipSync.rmsSourceAudioAssetId).toBe('aud-1');

    useStore.setState(initialState, true);
  });
});
