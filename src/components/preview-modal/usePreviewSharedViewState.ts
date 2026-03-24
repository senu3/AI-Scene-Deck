import { useEffect, useMemo } from 'react';
import type { Asset, Cut, PreviewableAsset } from '../../types';
import type { ExportSequenceItem } from '../../utils/exportSequence';
import { EXPORT_FRAMING_DEFAULTS } from '../../constants/framing';
import {
  buildPreviewViewportFramingStyle,
  buildPreviewViewportFramingStyleFromResolved,
} from '../../utils/previewFraming';
import { useAssetMetadataHydration } from '../../features/metadata/useAssetMetadataHydration';
import type { PreviewItem, ResolutionPreset } from './types';

interface UsePreviewSharedViewStateBaseInput {
  isDragging: boolean;
  items: PreviewItem[];
  currentIndex: number;
  cacheAsset?: (asset: Asset) => void;
  previewSequenceItemByCutId: Map<string, ExportSequenceItem>;
  resolveAssetForCut: (cut: Cut | null | undefined) => Asset | null;
  selectedResolution: ResolutionPreset;
  globalVolume: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  progressFillRef: React.RefObject<HTMLDivElement>;
  progressHandleRef: React.RefObject<HTMLDivElement>;
}

interface UsePreviewSharedViewStateSingleInput extends UsePreviewSharedViewStateBaseInput {
  mode: 'single';
  mediaType: PreviewableAsset['type'];
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  asset: PreviewableAsset;
  focusCut: Cut | null;
  shouldMuteEmbeddedAudio: (cut: Cut | null | undefined) => boolean;
}

interface UsePreviewSharedViewStateSequenceInput extends UsePreviewSharedViewStateBaseInput {
  mode: 'sequence';
  playbackIndex: number;
  totalDuration: number;
  getGlobalProgress: () => number;
  getAbsoluteTime: () => number;
  getLiveAbsoluteTime: () => number;
  isPlaying: boolean;
}

type UsePreviewSharedViewStateInput =
  | UsePreviewSharedViewStateSingleInput
  | UsePreviewSharedViewStateSequenceInput;

export function usePreviewSharedViewState(input: UsePreviewSharedViewStateInput) {
  const {
    isDragging,
    items,
    currentIndex,
    cacheAsset,
    previewSequenceItemByCutId,
    resolveAssetForCut,
    selectedResolution,
    globalVolume,
    videoRef,
    progressFillRef,
    progressHandleRef,
  } = input;

  const currentItem = items[currentIndex];
  const globalProgress = input.mode === 'sequence' ? input.getGlobalProgress() : 0;
  const sequenceTotalDuration = input.mode === 'sequence' ? input.totalDuration : 0;
  const sequenceCurrentTime = input.mode === 'sequence' ? input.getAbsoluteTime() : 0;
  const playbackDuration = input.mode === 'single' ? input.duration : input.totalDuration;
  const playbackTime = input.mode === 'single' ? input.currentTime : input.getAbsoluteTime();
  const resolutionTargetAsset = input.mode === 'single'
    ? input.asset
    : resolveAssetForCut(currentItem?.cut);

  const { asset: hydratedResolutionAsset } = useAssetMetadataHydration({
    asset: resolutionTargetAsset,
    requirements: resolutionTargetAsset?.type === 'video' || resolutionTargetAsset?.type === 'image'
      ? { dimensions: true }
      : {},
    cacheAsset,
  });

  const previewResolutionLabel = useMemo(() => {
    const width = hydratedResolutionAsset?.metadata?.width;
    const height = hydratedResolutionAsset?.metadata?.height;
    if (typeof width === 'number' && typeof height === 'number') {
      return `${width}×${height}`;
    }
    return null;
  }, [hydratedResolutionAsset?.metadata?.width, hydratedResolutionAsset?.metadata?.height]);

  const currentFraming = useMemo(() => {
    const targetCut = input.mode === 'single' ? input.focusCut : currentItem?.cut;
    if (targetCut) {
      const fromSequenceSpec = previewSequenceItemByCutId.get(targetCut.id);
      if (fromSequenceSpec) {
        return buildPreviewViewportFramingStyleFromResolved(
          fromSequenceSpec.framingMode,
          fromSequenceSpec.framingAnchor,
        );
      }
    }
    return buildPreviewViewportFramingStyle(targetCut?.framing, EXPORT_FRAMING_DEFAULTS);
  }, [input, currentItem?.cut, previewSequenceItemByCutId]);

  const playbackProgressPercent = playbackDuration > 0
    ? (playbackTime / playbackDuration) * 100
    : 0;
  const progressPercent = input.mode === 'single' ? playbackProgressPercent : globalProgress;
  const isFreeResolution = selectedResolution.width === 0;
  const previewDisplayClassName = isFreeResolution
    ? 'preview-display'
    : 'preview-display preview-display--expanded';

  useEffect(() => {
    if (!videoRef.current) return;

    videoRef.current.volume = globalVolume;
    const activeCut = input.mode === 'single'
      ? (input.focusCut ?? null)
      : (items[input.playbackIndex]?.cut ?? null);
    videoRef.current.muted = input.mode === 'single'
      ? input.shouldMuteEmbeddedAudio(activeCut)
      : true;
  }, [videoRef, globalVolume, input, items]);

  useEffect(() => {
    if (progressFillRef.current) {
      progressFillRef.current.style.width = `${progressPercent}%`;
    }
    if (progressHandleRef.current) {
      progressHandleRef.current.style.left = `${progressPercent}%`;
    }
  }, [progressFillRef, progressHandleRef, progressPercent]);

  useEffect(() => {
    if (input.mode !== 'sequence' || !input.isPlaying || isDragging) return;

    let rafId = 0;
    const update = () => {
      const totalDuration = input.totalDuration;
      if (totalDuration > 0) {
        const liveTime = input.getLiveAbsoluteTime();
        const percent = Math.max(0, Math.min(100, (liveTime / totalDuration) * 100));
        if (progressFillRef.current) {
          progressFillRef.current.style.width = `${percent}%`;
        }
        if (progressHandleRef.current) {
          progressHandleRef.current.style.left = `${percent}%`;
        }
      }
      rafId = window.requestAnimationFrame(update);
    };

    rafId = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(rafId);
  }, [input, isDragging, progressFillRef, progressHandleRef]);

  useEffect(() => {
    if (input.mode !== 'single' || input.mediaType !== 'video' || !input.isPlaying || isDragging) return;

    let rafId = 0;
    const update = () => {
      const duration = input.duration;
      const liveTime = videoRef.current?.currentTime ?? input.currentTime;
      const percent = duration > 0
        ? Math.max(0, Math.min(100, (liveTime / duration) * 100))
        : 0;
      if (progressFillRef.current) {
        progressFillRef.current.style.width = `${percent}%`;
      }
      if (progressHandleRef.current) {
        progressHandleRef.current.style.left = `${percent}%`;
      }
      rafId = window.requestAnimationFrame(update);
    };

    rafId = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(rafId);
  }, [input, isDragging, videoRef, progressFillRef, progressHandleRef]);

  return {
    currentItem,
    globalProgress,
    sequenceTotalDuration,
    sequenceCurrentTime,
    playbackDuration,
    playbackTime,
    previewResolutionLabel,
    currentFraming,
    playbackProgressPercent,
    previewDisplayClassName,
  };
}
