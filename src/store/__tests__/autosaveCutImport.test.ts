import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useStore } from '../useStore';
import { createAutosaveController, subscribeProjectChanges } from '../../utils/autosave';
import { buildAssetForCut } from '../../utils/cutImport';

vi.mock('../../utils/cutImport', () => ({
  buildAssetForCut: vi.fn(async () => ({
    asset: {
      id: 'asset-1',
      name: 'img.png',
      path: 'C:/vault/assets/img.png',
      type: 'image',
      vaultRelativePath: 'assets/img.png',
    },
    displayTime: 1,
  })),
}));

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('autosave + cut import', () => {
  beforeEach(() => {
    useStore.getState().clearProject();
    useStore.getState().initializeProject({
      name: 'Test',
      vaultPath: 'C:/vault',
      scenes: [{ id: 'scene-1', name: 'Scene 1', cuts: [], order: 0, notes: [] }],
    });
  });

  it('triggers autosave after cut import updates project state', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => {});
    const controller = createAutosaveController({ debounceMs: 1, save });
    const unsubscribe = subscribeProjectChanges(useStore as any, () => controller.schedule());

    await useStore.getState().createCutFromImport('scene-1', {
      assetId: 'asset-1',
      name: 'img.png',
      sourcePath: 'C:/src/img.png',
      type: 'image',
    });

    vi.advanceTimersByTime(1);
    await flushPromises();

    expect(buildAssetForCut).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);

    unsubscribe();
    vi.useRealTimers();
  });
});
