import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Asset } from '../../types';
import { ImportAddCutCommand } from '../commands';
import { useHistoryStore } from '../historyStore';
import { useStore } from '../useStore';

const IMPORTED_ASSET: Asset = {
  id: 'asset-imported',
  name: 'imported.png',
  path: 'C:/vault/assets/imported.png',
  type: 'image',
};

describe('ImportAddCutCommand', () => {
  const initialState = useStore.getState();

  beforeEach(() => {
    useHistoryStore.getState().clear();
    useStore.setState(initialState, true);
    useStore.getState().initializeProject({
      name: 'Test',
      vaultPath: 'C:/vault',
      scenes: [{ id: 'scene-1', name: 'Scene 1', notes: [], cuts: [] }],
    });
  });

  it('adds imported cut and supports undo/redo without re-importing', async () => {
    const resolveImport = vi.fn().mockResolvedValue({
      asset: IMPORTED_ASSET,
      displayTime: 3,
    });

    await useHistoryStore.getState().executeCommand(new ImportAddCutCommand({
      sceneId: 'scene-1',
      source: {
        assetId: IMPORTED_ASSET.id,
        name: 'imported.png',
        sourcePath: 'C:/source/imported.png',
        type: 'image',
      },
      resolveImport,
    }));

    let scene = useStore.getState().scenes.find((entry) => entry.id === 'scene-1');
    expect(scene?.cuts).toHaveLength(1);
    expect(scene?.cuts[0]?.assetId).toBe(IMPORTED_ASSET.id);
    expect(scene?.cuts[0]?.displayTime).toBe(3);

    await useHistoryStore.getState().undo();
    scene = useStore.getState().scenes.find((entry) => entry.id === 'scene-1');
    expect(scene?.cuts).toHaveLength(0);

    await useHistoryStore.getState().redo();
    scene = useStore.getState().scenes.find((entry) => entry.id === 'scene-1');
    expect(scene?.cuts).toHaveLength(1);
    expect(scene?.cuts[0]?.assetId).toBe(IMPORTED_ASSET.id);
    expect(scene?.cuts[0]?.displayTime).toBe(3);
    expect(resolveImport).toHaveBeenCalledTimes(1);
  });

  it('keeps group membership aligned when undoing imported derived cut', async () => {
    const resolveImport = vi.fn().mockResolvedValue({
      asset: {
        ...IMPORTED_ASSET,
        id: 'asset-derived',
        name: 'derived.png',
        path: 'C:/vault/assets/derived.png',
      },
      displayTime: 2,
    });

    useStore.getState().initializeProject({
      name: 'Group Test',
      vaultPath: 'C:/vault',
      scenes: [{
        id: 'scene-1',
        name: 'Scene 1',
        notes: [],
        cuts: [
          {
            id: 'cut-source',
            assetId: 'asset-source',
            asset: {
              id: 'asset-source',
              name: 'source.png',
              path: 'C:/vault/assets/source.png',
              type: 'image',
            },
            displayTime: 1,
            order: 0,
            audioBindings: [],
          },
          {
            id: 'cut-other',
            assetId: 'asset-other',
            asset: {
              id: 'asset-other',
              name: 'other.png',
              path: 'C:/vault/assets/other.png',
              type: 'image',
            },
            displayTime: 1,
            order: 1,
            audioBindings: [],
          },
        ],
        groups: [{ id: 'group-1', name: 'Group 1', cutIds: ['cut-source', 'cut-other'], isCollapsed: false }],
      }],
    });

    await useHistoryStore.getState().executeCommand(new ImportAddCutCommand({
      sceneId: 'scene-1',
      source: {
        assetId: 'asset-derived',
        name: 'derived.png',
        sourcePath: 'C:/source/derived.png',
        type: 'image',
      },
      insertIndex: 1,
      syncGroupWithSourceCutId: 'cut-source',
      resolveImport,
    }));

    let scene = useStore.getState().scenes.find((entry) => entry.id === 'scene-1');
    const groupAfterExecute = scene?.groups?.find((group) => group.id === 'group-1');
    expect(scene?.cuts).toHaveLength(3);
    expect(groupAfterExecute?.cutIds).toHaveLength(3);
    expect(groupAfterExecute?.cutIds[0]).toBe('cut-source');
    expect(groupAfterExecute?.cutIds[2]).toBe('cut-other');

    await useHistoryStore.getState().undo();
    scene = useStore.getState().scenes.find((entry) => entry.id === 'scene-1');
    const groupAfterUndo = scene?.groups?.find((group) => group.id === 'group-1');
    expect(scene?.cuts.map((cut) => cut.id)).toEqual(['cut-source', 'cut-other']);
    expect(groupAfterUndo?.cutIds).toEqual(['cut-source', 'cut-other']);

    await useHistoryStore.getState().redo();
    scene = useStore.getState().scenes.find((entry) => entry.id === 'scene-1');
    const groupAfterRedo = scene?.groups?.find((group) => group.id === 'group-1');
    expect(scene?.cuts).toHaveLength(3);
    expect(groupAfterRedo?.cutIds).toHaveLength(3);
    expect(groupAfterRedo?.cutIds[0]).toBe('cut-source');
    expect(groupAfterRedo?.cutIds[2]).toBe('cut-other');
    expect(resolveImport).toHaveBeenCalledTimes(1);
  });
});
