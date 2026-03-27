import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from '../Sidebar';
import { useHistoryStore } from '../../store/historyStore';
import { useStore } from '../../store/useStore';

const initialState = useStore.getState();
const mockResolveImportedCutAsset = vi.fn();
const mockGetAssetThumbnail = vi.fn();
const mockGetCachedAssetThumbnail = vi.fn();

vi.mock('../../features/cut/importAddCut', () => ({
  resolveImportedCutAsset: (...args: unknown[]) => mockResolveImportedCutAsset(...args),
}));

vi.mock('../../features/thumbnails/api', () => ({
  getAssetThumbnail: (...args: unknown[]) => mockGetAssetThumbnail(...args),
  getCachedAssetThumbnail: (...args: unknown[]) => mockGetCachedAssetThumbnail(...args),
}));

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Sidebar', () => {
  beforeEach(() => {
    useHistoryStore.getState().clear();
    mockResolveImportedCutAsset.mockReset();
    mockGetAssetThumbnail.mockReset();
    mockGetCachedAssetThumbnail.mockReset();
    mockGetAssetThumbnail.mockResolvedValue('sidebar-thumb');
    mockGetCachedAssetThumbnail.mockReturnValue('sidebar-thumb');

    useStore.setState(initialState, true);
    useStore.setState({
      scenes: [{ id: 'scene-1', name: 'Scene 1', order: 0, notes: [], cuts: [] }],
      sceneOrder: ['scene-1'],
      selectedSceneId: null,
      sourceFolders: [{
        path: 'C:/source',
        name: 'Source',
        structure: [{ name: 'shot.png', path: 'C:/source/shot.png', isDirectory: false }],
      }],
      expandedFolders: new Set(['C:/source']),
      sourceViewMode: 'list',
      assetCache: new Map(),
    });
  });

  afterEach(() => {
    useHistoryStore.getState().clear();
    useStore.setState(initialState, true);
  });

  it('adds imported cut from sidebar and removes it on undo', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);

    mockResolveImportedCutAsset.mockResolvedValue({
      asset: {
        id: 'asset-imported',
        name: 'shot.png',
        path: 'C:/vault/assets/shot.png',
        type: 'image' as const,
      },
      displayTime: 2,
    });

    await act(async () => {
      root.render(<Sidebar />);
      await flushPromises();
    });

    const fileItem = host.querySelector('.file-item');
    expect(fileItem).not.toBeNull();

    await act(async () => {
      fileItem?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await flushPromises();
    });

    expect(mockResolveImportedCutAsset).toHaveBeenCalledTimes(1);
    expect(useStore.getState().scenes[0]?.cuts).toHaveLength(1);
    expect(useStore.getState().scenes[0]?.cuts[0]?.assetId).toBe('asset-imported');
    expect(useStore.getState().scenes[0]?.cuts[0]?.displayTime).toBe(2);

    await act(async () => {
      await useHistoryStore.getState().undo();
      await flushPromises();
    });

    expect(useStore.getState().scenes[0]?.cuts).toHaveLength(0);

    await act(async () => {
      root.unmount();
    });
  });
});
