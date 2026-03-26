import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DetailsPanel from "../DetailsPanel";
import { useStore } from "../../store/useStore";
import type { Asset, Scene } from "../../types";

const initialState = useStore.getState();
const mockResolveCutThumbnailFromCache = vi.fn();
const mockGetAssetThumbnail = vi.fn();

vi.mock("../../features/metadata/useAssetMetadataHydration", () => ({
  useAssetMetadataHydration: ({ asset }: { asset: Asset | null }) => ({
    asset,
    status: "idle" as const,
  }),
}));

vi.mock("../../features/thumbnails/api", () => ({
  getAssetThumbnail: (...args: unknown[]) => mockGetAssetThumbnail(...args),
  resolveCutThumbnailFromCache: (...args: unknown[]) => mockResolveCutThumbnailFromCache(...args),
}));

vi.mock("../PreviewModal", () => ({
  default: () => null,
}));

vi.mock("../AssetModal", () => ({
  default: () => null,
}));

function buildScene(overrides?: Partial<Scene["cuts"][0]>): Scene {
  return {
    id: "scene-1",
    name: "Scene 1",
    order: 0,
    notes: [],
    groups: [],
    cuts: [
      {
        id: "cut-1",
        assetId: "asset-1",
        displayTime: 3,
        order: 0,
        isClip: true,
        inPoint: 1,
        outPoint: 4,
        useEmbeddedAudio: true,
        audioBindings: [],
        ...overrides,
      },
    ],
  };
}

describe("DetailsPanel", () => {
  beforeEach(() => {
    mockResolveCutThumbnailFromCache.mockReset();
    mockGetAssetThumbnail.mockReset();
    mockResolveCutThumbnailFromCache.mockImplementation((profile, input) => {
      void profile;
      if (input.assetType === "image") {
        return "thumb-image";
      }
      return `thumb-${input.inPointSec}-${input.outPointSec}`;
    });
    mockGetAssetThumbnail.mockResolvedValue(null);

    const asset: Asset = {
      id: "asset-1",
      name: "clip.mp4",
      path: "/tmp/clip.mp4",
      type: "video",
      thumbnail: "asset-thumb",
    };

    useStore.setState(initialState, true);
    useStore.setState({
      scenes: [buildScene()],
      sceneOrder: ["scene-1"],
      assetCache: new Map([[asset.id, asset]]),
      selectedSceneId: null,
      selectedCutId: "cut-1",
      selectedCutIds: new Set(["cut-1"]),
      selectedGroupId: null,
      selectionType: "cut",
    });
  });

  afterEach(() => {
    useStore.setState(initialState, true);
  });

  it("updates clip in/out display while keeping the existing thumb for same-cut updates", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    await act(async () => {
      root.render(<DetailsPanel />);
    });

    const initialImage = host.querySelector(".details-preview img") as HTMLImageElement | null;
    expect(initialImage).not.toBeNull();
    expect(initialImage?.getAttribute("src")).toBe("thumb-1-4");

    const initialClipValues = Array.from(host.querySelectorAll(".clip-time-value"))
      .map((node) => node.textContent?.trim());
    expect(initialClipValues).toEqual(["0:01.00", "0:04.00"]);

    await act(async () => {
      useStore.setState((state) => ({
        scenes: state.scenes.map((scene) => (
          scene.id !== "scene-1"
            ? scene
            : {
                ...scene,
                cuts: scene.cuts.map((cut) => (
                  cut.id !== "cut-1"
                    ? cut
                    : {
                        ...cut,
                        inPoint: 2,
                        outPoint: 5,
                      }
                )),
              }
        )),
      }));
    });

    const updatedClipValues = Array.from(host.querySelectorAll(".clip-time-value"))
      .map((node) => node.textContent?.trim());
    expect(updatedClipValues).toEqual(["0:02.00", "0:05.00"]);

    const updatedImage = host.querySelector(".details-preview img") as HTMLImageElement | null;
    expect(updatedImage?.getAttribute("src")).toBe("thumb-1-4");
    expect(mockResolveCutThumbnailFromCache).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("routes image cuts through the single-cut panel path", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const imageAsset: Asset = {
      id: "asset-1",
      name: "still.png",
      path: "/tmp/still.png",
      type: "image",
      thumbnail: "asset-thumb",
    };

    useStore.setState(initialState, true);
    useStore.setState({
      scenes: [buildScene({
        isClip: false,
        inPoint: undefined,
        outPoint: undefined,
      })],
      sceneOrder: ["scene-1"],
      assetCache: new Map([[imageAsset.id, imageAsset]]),
      selectedSceneId: null,
      selectedCutId: "cut-1",
      selectedCutIds: new Set(["cut-1"]),
      selectedGroupId: null,
      selectionType: "cut",
    });

    await act(async () => {
      root.render(<DetailsPanel />);
    });

    expect(host.textContent).toContain("Scene 1 / Cut 1");
    expect(host.querySelector(".details-preview.clickable")).not.toBeNull();
    expect(host.querySelector(".preview-play-overlay")).not.toBeNull();

    const previewImage = host.querySelector(".details-preview img") as HTMLImageElement | null;
    expect(previewImage?.getAttribute("src")).toBe("thumb-image");

    await act(async () => {
      root.unmount();
    });
  });
});
