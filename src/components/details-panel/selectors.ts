import type { AppState } from "../../store/stateTypes";
import type { Cut, Scene } from "../../types";
import { resolveCutAsset } from "../../utils/assetResolve";

export interface CutSelectionData {
  scene: Scene;
  cut: Cut;
}

export function findCutSelectionById(
  state: Pick<AppState, "scenes">,
  cutId: string,
): CutSelectionData | null {
  for (const scene of state.scenes) {
    const cut = scene.cuts.find((entry) => entry.id === cutId);
    if (cut) {
      return { scene, cut };
    }
  }
  return null;
}

export function makeSelectCutPanelBase(cutId: string) {
  return (state: AppState) => {
    const selected = findCutSelectionById(state, cutId);
    if (!selected) return null;

    const asset = resolveCutAsset(selected.cut, state.getAsset);
    return {
      sceneName: selected.scene.name,
      cutOrder: (selected.cut.order ?? 0) + 1,
      asset,
      assetId: selected.cut.assetId,
      assetName: asset?.name ?? "Unknown",
      assetPath: asset?.path ?? null,
      assetType: asset?.type ?? null,
      assetSnapshotThumbnail: asset?.thumbnail ?? null,
    };
  };
}

export function makeSelectCutInfoFields(cutId: string) {
  return (state: AppState) => {
    const selected = findCutSelectionById(state, cutId);
    if (!selected) return null;

    return {
      displayTime: selected.cut.displayTime,
      isClipDurationLocked: !!(
        selected.cut.isClip
        && typeof selected.cut.inPoint === "number"
        && typeof selected.cut.outPoint === "number"
      ),
    };
  };
}

export function makeSelectCutClipFields(cutId: string) {
  return (state: AppState) => {
    const selected = findCutSelectionById(state, cutId);
    if (!selected) return null;

    return {
      isClip: !!selected.cut.isClip,
      inPoint: selected.cut.inPoint,
      outPoint: selected.cut.outPoint,
    };
  };
}

export function makeSelectCutAudioFields(cutId: string) {
  return (state: AppState) => {
    const selected = findCutSelectionById(state, cutId);
    if (!selected) return null;

    const primaryAudioBinding = selected.cut.audioBindings?.[0];
    const attachedAudio = primaryAudioBinding?.audioAssetId
      ? state.assetCache.get(primaryAudioBinding.audioAssetId)
      : undefined;

    return {
      useEmbeddedAudio: selected.cut.useEmbeddedAudio ?? true,
      primaryAudioBinding,
      attachedAudio,
    };
  };
}
