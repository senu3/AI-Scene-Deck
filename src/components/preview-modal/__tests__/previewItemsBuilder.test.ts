import { describe, expect, it, vi } from 'vitest';
import { asCanonicalDurationSec } from '../../../utils/storyTiming';
import { buildPreviewItems } from '../previewItemsBuilder';
import type { Asset, Cut, Scene } from '../../../types';

function createImageAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-image-1',
    name: 'still.png',
    path: '/tmp/still.png',
    type: 'image',
    ...overrides,
  };
}

function createCut(asset: Asset, overrides: Partial<Cut> = {}): Cut {
  return {
    id: 'cut-1',
    assetId: asset.id,
    asset,
    displayTime: 4.5,
    order: 0,
    ...overrides,
  };
}

function createScene(cut: Cut): Scene {
  return {
    id: 'scene-1',
    name: 'Scene 1',
    cuts: [cut],
    notes: [],
  };
}

describe('buildPreviewItems', () => {
  it('uses the focused cut as the single-image preview source when cut context exists', async () => {
    const asset = createImageAsset();
    const cut = createCut(asset, { displayTime: 7.25 });
    const scene = createScene(cut);
    const resolveCutDisplayTimeSec = vi.fn(() => asCanonicalDurationSec(7.25));

    const items = await buildPreviewItems({
      isSingleMode: true,
      isSingleModeVideo: false,
      isSingleModeImage: true,
      asset,
      singleModeImageData: 'data:image/png;base64,abc',
      orderedScenes: [scene],
      previewMode: 'all',
      selectedSceneId: null,
      getAsset: () => asset,
      getDisplayTimeForAsset: () => 2,
      focusCutData: {
        scene,
        sceneIndex: 0,
        cut,
        cutIndex: 0,
      },
      missingFocusedCut: false,
      resolveAssetForCut: () => asset,
      resolveClipSnapshotThumbnail: () => null,
      resolveCutDisplayTimeSec,
    });

    expect(resolveCutDisplayTimeSec).toHaveBeenCalledWith(cut);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      cut,
      sceneId: scene.id,
      sceneName: scene.name,
      sceneIndex: 0,
      cutIndex: 0,
      normalizedDisplayTime: asCanonicalDurationSec(7.25),
      thumbnail: 'data:image/png;base64,abc',
    });
  });

  it('falls back to an asset-backed pseudo cut for asset-only single-image preview', async () => {
    const asset = createImageAsset();
    const resolveCutDisplayTimeSec = vi.fn(() => asCanonicalDurationSec(2));

    const items = await buildPreviewItems({
      isSingleMode: true,
      isSingleModeVideo: false,
      isSingleModeImage: true,
      asset,
      singleModeImageData: 'data:image/png;base64,abc',
      orderedScenes: [],
      previewMode: 'all',
      selectedSceneId: null,
      getAsset: () => asset,
      getDisplayTimeForAsset: () => 2,
      focusCutData: null,
      missingFocusedCut: false,
      resolveAssetForCut: () => asset,
      resolveClipSnapshotThumbnail: () => null,
      resolveCutDisplayTimeSec,
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.cut.id).toBe(`single-${asset.id}`);
    expect(items[0]?.normalizedDisplayTime).toBe(asCanonicalDurationSec(2));
  });
});
