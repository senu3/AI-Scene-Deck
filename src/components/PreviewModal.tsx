import { useState, useCallback, useRef, useMemo } from 'react';
import { useStore } from '../store/useStore';
import {
  selectScenes,
  selectSceneOrder,
  selectPreviewMode,
  selectSelectedSceneId,
  selectCacheAsset,
  selectGetAsset,
  selectGlobalVolume,
  selectGlobalMuted,
  selectToggleGlobalMute,
  selectMetadataStore,
  selectGetCutRuntime,
  selectSetCutRuntimeHold,
  selectClearCutRuntimeHold,
} from '../store/selectors';
import type { Cut, Scene } from '../types';
import { useSequencePlaybackController } from '../utils/previewPlaybackController';
import { getScenesInOrder } from '../utils/sceneOrder';
import { buildSequencePlan } from '../utils/sequencePlan';
import { slicePreviewAudioPlan } from '../utils/previewAudioPlanSlice';
import { EXPORT_FRAMING_DEFAULTS } from '../constants/framing';
import { useMiniToast } from '../ui';
import type {
  PreviewModalProps,
  ResolutionPreset,
  SequencePreviewModalProps,
  SinglePreviewModalProps,
} from './preview-modal/types';
import {
  FRAME_DURATION,
  INITIAL_PRELOAD_ITEMS,
  PLAY_SAFE_AHEAD,
  PRELOAD_AHEAD,
  RESOLUTION_PRESETS,
} from './preview-modal/constants';
import { revokeIfBlob } from './preview-modal/helpers';
import { PreviewModalSequenceView } from './preview-modal/PreviewModalSequenceView';
import { PreviewModalSingleView } from './preview-modal/PreviewModalSingleView';
import { hasValidRangeSpan } from './preview-modal/clipRangeOps';
import { useClipRangeState } from './preview-modal/useClipRangeState';
import { usePreviewSequenceDerived } from './preview-modal/usePreviewSequenceDerived';
import { usePreviewSingleAttachedAudio } from './preview-modal/usePreviewSingleAttachedAudio';
import { usePreviewExportActions } from './preview-modal/usePreviewExportActions';
import { usePreviewSharedViewState } from './preview-modal/usePreviewSharedViewState';
import { usePreviewSingleMediaAsset } from './preview-modal/usePreviewSingleMediaAsset';
import { usePreviewPlaybackControls } from './preview-modal/usePreviewPlaybackControls';
import { usePreviewInteractionCommands } from './preview-modal/usePreviewInteractionCommands';
import { usePreviewViewShell } from './preview-modal/usePreviewViewShell';
import { usePreviewInputs } from './preview-modal/usePreviewInputs';
import { usePreviewSequenceRuntime } from './preview-modal/usePreviewSequenceRuntime';
import VideoHoldModal from './preview-modal/VideoHoldModal';
import { resolveCutAudioBinding } from './preview-modal/audioBinding';
import { usePreviewSingleRuntime } from './preview-modal/usePreviewSingleRuntime';
import { usePreviewItemsState } from './preview-modal/usePreviewItemsState';
import './PreviewModal.css';
import './preview-modal/styles/playback-controls.css';

interface FocusCutData {
  scene: Scene;
  sceneIndex: number;
  cut: Cut;
  cutIndex: number;
}

const NOOP = () => {};
const NOOP_NUMBER = () => 0;
const NOOP_SKIP = (_seconds: number) => {};
const NOOP_RANGE = (_inPoint: number | null, _outPoint: number | null) => {};
const NOOP_MUTE_EMBEDDED = () => false;

function usePreviewModalProjectState(focusCutId?: string) {
  const scenes = useStore(selectScenes);
  const sceneOrder = useStore(selectSceneOrder);
  const orderedScenes = useMemo(() => getScenesInOrder(scenes, sceneOrder), [scenes, sceneOrder]);
  const previewMode = useStore(selectPreviewMode);
  const selectedSceneId = useStore(selectSelectedSceneId);
  const cacheAsset = useStore(selectCacheAsset);
  const getAsset = useStore(selectGetAsset);
  const globalVolume = useStore(selectGlobalVolume);
  const globalMuted = useStore(selectGlobalMuted);
  const toggleGlobalMute = useStore(selectToggleGlobalMute);
  const metadataStore = useStore(selectMetadataStore);
  const getCutRuntime = useStore(selectGetCutRuntime);
  const setCutRuntimeHold = useStore(selectSetCutRuntimeHold);
  const clearCutRuntimeHold = useStore(selectClearCutRuntimeHold);

  const focusCutData = useMemo<FocusCutData | null>(() => {
    if (!focusCutId) return null;
    for (let sceneIndex = 0; sceneIndex < orderedScenes.length; sceneIndex++) {
      const scene = orderedScenes[sceneIndex];
      const cutIndex = scene.cuts.findIndex((cut) => cut.id === focusCutId);
      if (cutIndex >= 0) {
        return {
          scene,
          sceneIndex,
          cut: scene.cuts[cutIndex],
          cutIndex,
        };
      }
    }
    return null;
  }, [focusCutId, orderedScenes]);

  return {
    scenes,
    sceneOrder,
    orderedScenes,
    previewMode,
    selectedSceneId,
    cacheAsset,
    getAsset,
    globalVolume,
    globalMuted,
    toggleGlobalMute,
    metadataStore,
    getCutRuntime,
    setCutRuntimeHold,
    clearCutRuntimeHold,
    focusCutData,
  };
}

export default function PreviewModal(props: PreviewModalProps) {
  if (props.mode === 'single') {
    return <PreviewModalSingleRoot {...props} />;
  }

  return <PreviewModalSequenceRoot {...props} />;
}

function PreviewModalSingleRoot({
  onClose,
  exportResolution,
  onResolutionChange,
  focusCutId,
  asset,
  initialInPoint,
  initialOutPoint,
  onRangeChange,
  onClipSave,
  onClipClear,
  onFrameCapture,
}: SinglePreviewModalProps) {
  const {
    scenes,
    sceneOrder,
    orderedScenes,
    previewMode,
    selectedSceneId,
    cacheAsset,
    getAsset,
    globalVolume,
    globalMuted,
    toggleGlobalMute,
    metadataStore,
    getCutRuntime,
    setCutRuntimeHold,
    clearCutRuntimeHold,
    focusCutData,
  } = usePreviewModalProjectState(focusCutId);
  const isSingleModeVideo = asset.type === 'video';
  const isSingleModeImage = asset.type === 'image';
  const hasCutContext = !!focusCutData?.cut;
  const isAssetOnlyPreview = !hasCutContext;

  const [videoObjectUrl, setVideoObjectUrl] = useState<{ assetId: string; url: string } | null>(null);
  const [singleModeIsLooping, setSingleModeIsLooping] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<ResolutionPreset>(
    exportResolution ? { ...exportResolution } : RESOLUTION_PRESETS[0]
  );
  const { show: showMiniToast, element: miniToastElement } = useMiniToast();
  const [singleModeDuration, setSingleModeDuration] = useState(0);
  const [singleModeCurrentTime, setSingleModeCurrentTime] = useState(0);
  const [showHoldModal, setShowHoldModal] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const progressHandleRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    showOverlay,
    showOverlayNow,
    scheduleHideOverlay,
    displayContainerRef,
    getViewportStyle,
    isFullscreen,
    toggleFullscreen,
  } = usePreviewViewShell({
    modalRef,
    selectedResolution,
    overlayHideDelayMs: 300,
  });

  const { isLoading, singleModeImageData } = usePreviewSingleMediaAsset({
    isSingleMode: true,
    asset,
    videoObjectUrl,
    setVideoObjectUrl,
    revokeIfBlob,
  });

  const { items, resolveAssetForCut } = usePreviewItemsState({
    isSingleMode: true,
    isSingleModeVideo,
    isSingleModeImage,
    asset,
    singleModeImageData,
    orderedScenes,
    previewMode,
    selectedSceneId,
    getAsset,
    metadataStore: metadataStore ?? null,
    focusCutData,
    missingFocusedCut: false,
  });
  const singleModeImageDuration = isSingleModeImage
    ? Number(items[0]?.normalizedDisplayTime ?? 0)
    : 0;
  const { previewSequenceItemByCutId } = usePreviewSequenceDerived({
    items,
    metadataStore: metadataStore ?? null,
    getAsset,
    getCutRuntime,
  });

  const focusedPreviewBasePlan = useMemo(() => {
    if (!focusCutData?.cut?.id) return null;
    return buildSequencePlan({
      scenes,
      sceneOrder,
    }, {
      metadataStore: metadataStore ?? null,
      getAssetById: getAsset,
      resolveCutRuntimeById: getCutRuntime,
      framingDefaults: EXPORT_FRAMING_DEFAULTS,
    });
  }, [focusCutData?.cut?.id, scenes, sceneOrder, metadataStore, getAsset, getCutRuntime]);
  const focusedPreviewWindow = useMemo(() => {
    const cutId = focusCutData?.cut?.id;
    if (!cutId || !focusedPreviewBasePlan) return null;
    const matchingItems = focusedPreviewBasePlan.videoItems.filter((item) => item.cutId === cutId);
    if (matchingItems.length === 0) return null;
    const primaryItem = matchingItems.find((item) => !item.flags.isHold) ?? matchingItems[0];
    const windowStartSec = primaryItem?.dstInSec ?? 0;
    const windowEndSec = primaryItem?.dstOutSec ?? windowStartSec;
    if (windowEndSec <= windowStartSec) return null;
    return {
      startSec: windowStartSec,
      endSec: windowEndSec,
    };
  }, [focusCutData?.cut?.id, focusedPreviewBasePlan]);
  const focusedAttachAudioPlan = useMemo(() => {
    if (!focusedPreviewBasePlan || !focusedPreviewWindow) return null;
    return slicePreviewAudioPlan(focusedPreviewBasePlan.audioPlan, focusedPreviewWindow, {
      excludeSourceTypes: ['video'],
    });
  }, [focusedPreviewBasePlan, focusedPreviewWindow]);

  const {
    singleModeInPoint,
    setSingleModeInPoint,
    singleModeOutPoint,
    setSingleModeOutPoint,
    focusedMarker,
    setFocusedMarker,
    inPoint,
    outPoint,
    notifyRangeChange,
    setMarkerTime,
    stepMarker,
    stepFocusedMarker,
    handleMarkerFocus,
    handleContainerMouseDown,
  } = useClipRangeState({
    usesSequenceController: false,
    sequenceInPoint: null,
    sequenceOutPoint: null,
    sequenceTotalDuration: 0,
    singleModeDuration,
    initialInPoint,
    initialOutPoint,
    onRangeChange,
    setSequenceRange: NOOP_RANGE,
    frameDuration: FRAME_DURATION,
  });

  const {
    singleMediaElement,
    singleModeIsPlaying,
    setSingleModeIsPlaying,
    isSingleModeClipEnabled,
    isSingleModeClipPending,
    playSingleMode,
    pauseSingleMode,
    seekSingleMode,
    getSingleModeCurrentTime,
    handleSingleModeSetInPoint,
    handleSingleModeSetOutPoint,
    handleSingleModeClearClip,
    handleSingleModeSave,
    handleSingleModeCaptureFrame,
    handleSingleModeTimeUpdate,
    handleSingleModeLoadedMetadata,
    handleSingleModeVideoEnded,
    handleMarkerDragStart,
    handleMarkerDrag,
    handleSelectionDragStart,
    handleSelectionDrag,
    handleMarkerDragEnd,
  } = usePreviewSingleRuntime({
    isSingleModeVideo,
    isSingleModeImage,
    assetName: asset.name,
    focusCut: focusCutData?.cut ?? null,
    focusCutId: focusCutData?.cut?.id,
    focusCutIsClip: !!focusCutData?.cut?.isClip,
    focusCutInPoint: focusCutData?.cut?.inPoint,
    focusCutOutPoint: focusCutData?.cut?.outPoint,
    inPoint,
    outPoint,
    initialInPoint,
    singleModeInPoint,
    singleModeOutPoint,
    singleModeIsLooping,
    setFocusedMarker,
    setSingleModeInPoint,
    setSingleModeOutPoint,
    notifyRangeChange,
    setMarkerTime,
    videoRef,
    onClipSave,
    onClipClear,
    onFrameCapture,
    showMiniToast,
    singleModeImageData,
    singleModeImageDuration,
    singleModeDuration,
    setSingleModeDuration,
    singleModeCurrentTime,
    setSingleModeCurrentTime,
    getCurrentClipRevision: () => {
      const cutId = focusCutData?.cut?.id;
      if (!cutId) return 0;
      return getCutRuntime(cutId)?.clipRevision ?? 0;
    },
  });

  const resolveAudioBindingForCut = useCallback((cut: Cut | null | undefined) => {
    return resolveCutAudioBinding({
      cut,
      getAsset,
      globalMuted,
    });
  }, [getAsset, globalMuted]);
  const shouldMuteEmbeddedAudio = useCallback((cut: Cut | null | undefined): boolean => {
    return resolveAudioBindingForCut(cut).muteEmbedded;
  }, [resolveAudioBindingForCut]);

  usePreviewSingleAttachedAudio({
    isSingleMode: true,
    isSingleModeVideo,
    hasCutContext,
    assetId: asset.id,
    previewAudioPlan: focusedAttachAudioPlan ?? { totalDurationSec: 0, events: [] },
    inPoint,
    outPoint,
    singleModeIsPlaying,
    singleModeCurrentTime,
    videoRef,
    sequenceIsPlaying: false,
    sequenceIsBuffering: false,
    sequenceAbsoluteTime: 0,
    globalMuted,
    globalVolume,
  });

  const toggleLooping = useCallback(() => {
    setSingleModeIsLooping((prev) => !prev);
  }, []);
  const interactionCommands = usePreviewInteractionCommands({
    mode: 'single',
    isPlaying: singleModeIsPlaying,
    focusedMarker,
    items,
    currentIndex: 0,
    inPoint,
    outPoint,
    singleModeDuration,
    sequenceTotalDuration: 0,
    videoRef,
    resolveAssetForCut,
    playSingleMode,
    pauseSingleMode,
    seekSingleMode,
    getSingleModeCurrentTime,
    getSequenceAbsoluteTime: NOOP_NUMBER,
    seekSequenceAbsolute: NOOP,
    seekSequencePercent: NOOP,
    sequencePause: NOOP,
    skipSequence: NOOP_SKIP,
    setSequenceRange: NOOP_RANGE,
    notifyRangeChange,
    handlePlayPause: NOOP,
    stepMarker,
    stepFocusedMarker,
    handleSingleModeSetInPoint,
    handleSingleModeSetOutPoint,
    toggleLooping,
    toggleGlobalMute,
    handleMarkerFocus,
    handleMarkerDragStart,
    handleMarkerDrag,
    handleMarkerDragEnd,
    handleSelectionDragStart,
    handleSelectionDrag,
    handleSelectionDragEnd: handleMarkerDragEnd,
  });

  const {
    isDragging,
    hoverTime,
    handleProgressBarMouseDown,
    handleProgressBarHover,
    handleProgressBarLeave,
  } = usePreviewInputs({
    modalRef,
    progressBarRef,
    itemsLength: isSingleModeVideo || isSingleModeImage ? 1 : 0,
    totalDuration: singleModeDuration,
    onPauseBeforeSeek: pauseSingleMode,
    onSeekAbsolute: interactionCommands.seekToAbsolute,
    onSeekPercent: interactionCommands.seekToPercent,
    onClose,
    onPlayPause: interactionCommands.playPause,
    onSkipBack: interactionCommands.skipBack,
    onSkipForward: interactionCommands.skipForward,
    onStepBack: interactionCommands.stepBack,
    onStepForward: interactionCommands.stepForward,
    onToggleFullscreen: toggleFullscreen,
    onToggleLooping: interactionCommands.toggleLooping,
    onSetInPoint: interactionCommands.setInPoint,
    onSetOutPoint: interactionCommands.setOutPoint,
    onToggleMute: interactionCommands.toggleMute,
  });

  const {
    playbackDuration,
    playbackTime,
    previewResolutionLabel,
    currentFraming,
    playbackProgressPercent,
    previewDisplayClassName,
  } = usePreviewSharedViewState({
    isSingleMode: true,
    isSingleModeVideo,
    usesSequenceController: false,
    isDragging,
    items,
    currentIndex: 0,
    sequenceCurrentIndex: 0,
    sequenceTotalDuration: 0,
    getSequenceGlobalProgress: NOOP_NUMBER,
    getSequenceAbsoluteTime: NOOP_NUMBER,
    getSequenceLiveAbsoluteTime: NOOP_NUMBER,
    sequenceIsPlaying: false,
    singleModeIsPlaying,
    singleModeDuration,
    singleModeCurrentTime,
    asset,
    cacheAsset,
    focusCut: focusCutData?.cut ?? null,
    previewSequenceItemByCutId,
    resolveAssetForCut,
    selectedResolution,
    globalVolume,
    shouldMuteEmbeddedAudio,
    videoRef,
    progressFillRef,
    progressHandleRef,
  });

  const hasSingleModeRange = isSingleModeVideo && hasValidRangeSpan(inPoint, outPoint, singleModeDuration);
  const showSingleModeClipButton = isSingleModeVideo && (
    (isSingleModeClipEnabled && !!onClipClear)
    || (!isSingleModeClipEnabled && hasSingleModeRange && !!onClipSave)
  );
  const currentFocusHold = focusCutData?.cut?.id ? getCutRuntime(focusCutData.cut.id)?.hold : undefined;
  const isHoldEnabled = !!(currentFocusHold?.enabled && currentFocusHold.durationMs > 0);
  const openHoldEditor = useCallback(() => {
    setShowHoldModal(true);
  }, []);
  const handleSingleModeHoldToggle = useCallback(() => {
    const cutId = focusCutData?.cut?.id;
    if (!cutId) return;
    if (isHoldEnabled) {
      clearCutRuntimeHold(cutId);
      setShowHoldModal(false);
      showMiniToast('VIDEO Hold disabled', 'info');
      return;
    }
    openHoldEditor();
  }, [
    focusCutData?.cut?.id,
    isHoldEnabled,
    clearCutRuntimeHold,
    showMiniToast,
    openHoldEditor,
  ]);
  const handleSingleModeHoldApply = useCallback((seconds: number) => {
    const cutId = focusCutData?.cut?.id;
    if (!cutId) return;
    if (!Number.isFinite(seconds) || seconds <= 0) {
      showMiniToast('Hold duration must be a positive number', 'warning');
      return;
    }
    setCutRuntimeHold(cutId, {
      enabled: true,
      mode: 'tail',
      durationMs: Math.round(seconds * 1000),
    });
    setShowHoldModal(false);
    showMiniToast(`VIDEO Hold enabled (${seconds.toFixed(2)}s)`, 'success');
  }, [focusCutData?.cut?.id, setCutRuntimeHold, showMiniToast]);

  return (
    <>
      <PreviewModalSingleView
        modalRef={modalRef}
        displayContainerRef={displayContainerRef}
        progressBarRef={progressBarRef}
        progressFillRef={progressFillRef}
        progressHandleRef={progressHandleRef}
        videoRef={videoRef}
        onClose={onClose}
        onContainerMouseDown={handleContainerMouseDown}
        previewDisplayClassName={previewDisplayClassName}
        showOverlayNow={showOverlayNow}
        scheduleHideOverlay={scheduleHideOverlay}
        asset={asset}
        isAssetOnlyPreview={isAssetOnlyPreview}
        isLoading={isLoading}
        isSingleModeVideo={isSingleModeVideo}
        isSingleModeImage={isSingleModeImage}
        videoObjectUrl={videoObjectUrl}
        singleMediaElement={singleMediaElement}
        singleModeImageData={singleModeImageData}
        getViewportStyle={getViewportStyle}
        currentFraming={currentFraming}
        selectedResolution={selectedResolution}
        onResolutionSelect={(preset) => {
          setSelectedResolution(preset);
          onResolutionChange?.(preset);
        }}
        previewResolutionLabel={previewResolutionLabel}
        showOverlay={showOverlay}
        inPoint={inPoint}
        outPoint={outPoint}
        singleModePlaybackDuration={playbackDuration}
        singleModeProgressPercent={playbackProgressPercent}
        singleModePlaybackTime={playbackTime}
        hoverTime={hoverTime}
        focusedMarker={focusedMarker}
        onMarkerFocus={interactionCommands.markerFocus}
        onMarkerStep={interactionCommands.markerStep}
        onMarkerDragStart={interactionCommands.markerDragStart}
        onMarkerDrag={interactionCommands.markerDrag}
        onMarkerDragEnd={interactionCommands.markerDragEnd}
        onSelectionDragStart={interactionCommands.selectionDragStart}
        onSelectionDrag={interactionCommands.selectionDrag}
        onSelectionDragEnd={interactionCommands.selectionDragEnd}
        onProgressBarMouseDown={handleProgressBarMouseDown}
        onProgressBarHover={handleProgressBarHover}
        onProgressBarLeave={handleProgressBarLeave}
        isPlaying={singleModeIsPlaying}
        skipBack={interactionCommands.skipBack}
        skipForward={interactionCommands.skipForward}
        togglePlay={interactionCommands.playPause}
        handleSetInPoint={interactionCommands.setInPoint}
        handleSetOutPoint={interactionCommands.setOutPoint}
        showSingleModeClipButton={showSingleModeClipButton}
        isSingleModeClipEnabled={isSingleModeClipEnabled}
        onClipPrimaryAction={isSingleModeClipEnabled ? handleSingleModeClearClip : handleSingleModeSave}
        isSingleModeClipPending={isSingleModeClipPending}
        onFrameCapture={onFrameCapture ? handleSingleModeCaptureFrame : undefined}
        showHoldButton={isSingleModeVideo && !!focusCutData?.cut?.id}
        isHoldEnabled={isHoldEnabled}
        onHoldToggle={handleSingleModeHoldToggle}
        isLooping={singleModeIsLooping}
        toggleLooping={interactionCommands.toggleLooping}
        globalMuted={globalMuted}
        toggleGlobalMute={interactionCommands.toggleMute}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        miniToastElement={miniToastElement}
        handleSingleModeTimeUpdate={handleSingleModeTimeUpdate}
        handleSingleModeLoadedMetadata={handleSingleModeLoadedMetadata}
        onSingleModeVideoPlay={() => setSingleModeIsPlaying(true)}
        onSingleModeVideoPause={() => setSingleModeIsPlaying(false)}
        handleSingleModeVideoEnded={handleSingleModeVideoEnded}
      />
      <VideoHoldModal
        open={showHoldModal}
        initialDurationSec={currentFocusHold?.durationMs ? currentFocusHold.durationMs / 1000 : 1}
        onClose={() => setShowHoldModal(false)}
        onConfirm={handleSingleModeHoldApply}
      />
    </>
  );
}

function PreviewModalSequenceRoot({
  onClose,
  exportResolution,
  onResolutionChange,
  focusCutId,
  sequenceCuts,
  sequenceContext,
  onExportSequence,
}: SequencePreviewModalProps) {
  const {
    scenes,
    sceneOrder,
    orderedScenes,
    previewMode,
    selectedSceneId,
    cacheAsset,
    getAsset,
    globalVolume,
    globalMuted,
    toggleGlobalMute,
    metadataStore,
    getCutRuntime,
    focusCutData,
  } = usePreviewModalProjectState(focusCutId);
  const missingFocusedCut = !!focusCutId && !focusCutData;

  const [videoObjectUrl, setVideoObjectUrl] = useState<{ assetId: string; url: string } | null>(null);
  const [selectedResolution, setSelectedResolution] = useState<ResolutionPreset>(
    exportResolution ? { ...exportResolution } : RESOLUTION_PRESETS[0]
  );
  const { show: showMiniToast, element: miniToastElement } = useMiniToast();

  const modalRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const progressHandleRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    showOverlay,
    showOverlayNow,
    scheduleHideOverlay,
    displayContainerRef,
    getViewportStyle,
    isFullscreen,
    toggleFullscreen,
  } = usePreviewViewShell({
    modalRef,
    selectedResolution,
    overlayHideDelayMs: 300,
  });

  const { items, resolveAssetForCut } = usePreviewItemsState({
    isSingleMode: false,
    isSingleModeVideo: false,
    isSingleModeImage: false,
    asset: undefined,
    singleModeImageData: null,
    orderedScenes,
    previewMode,
    selectedSceneId,
    getAsset,
    metadataStore: metadataStore ?? null,
    focusCutData,
    missingFocusedCut,
    sequenceCuts,
    sequenceContext,
  });
  const {
    previewSequenceItems,
    previewSequencePlaybackItems,
    previewSequenceItemByCutId,
    previewSequenceItemByIndex,
    previewAudioPlan,
  } = usePreviewSequenceDerived({
    items,
    metadataStore: metadataStore ?? null,
    getAsset,
    getCutRuntime,
  });

  const focusedPreviewBasePlan = useMemo(() => {
    if (!focusCutData?.cut?.id) return null;
    return buildSequencePlan({
      scenes,
      sceneOrder,
    }, {
      metadataStore: metadataStore ?? null,
      getAssetById: getAsset,
      resolveCutRuntimeById: getCutRuntime,
      framingDefaults: EXPORT_FRAMING_DEFAULTS,
    });
  }, [focusCutData?.cut?.id, scenes, sceneOrder, metadataStore, getAsset, getCutRuntime]);
  const focusedPreviewWindow = useMemo(() => {
    const cutId = focusCutData?.cut?.id;
    if (!cutId || !focusedPreviewBasePlan) return null;
    const matchingItems = focusedPreviewBasePlan.videoItems.filter((item) => item.cutId === cutId);
    if (matchingItems.length === 0) return null;
    const primaryItem = matchingItems.find((item) => !item.flags.isHold) ?? matchingItems[0];
    const windowStartSec = primaryItem?.dstInSec ?? 0;
    const windowEndSec = matchingItems.reduce(
      (max, item) => Math.max(max, item.dstOutSec),
      primaryItem?.dstOutSec ?? windowStartSec
    );
    if (windowEndSec <= windowStartSec) return null;
    return {
      startSec: windowStartSec,
      endSec: windowEndSec,
    };
  }, [focusCutData?.cut?.id, focusedPreviewBasePlan]);
  const focusedPreviewAudioPlan = useMemo(() => {
    if (!focusedPreviewBasePlan || !focusedPreviewWindow) return null;
    return slicePreviewAudioPlan(focusedPreviewBasePlan.audioPlan, focusedPreviewWindow);
  }, [focusedPreviewBasePlan, focusedPreviewWindow]);
  const effectiveSequenceAudioPlan = useMemo(() => {
    if (!focusCutData?.cut?.id || sequenceCuts || items.length !== 1) {
      return previewAudioPlan;
    }
    return focusedPreviewAudioPlan ?? previewAudioPlan;
  }, [focusCutData?.cut?.id, sequenceCuts, items.length, focusedPreviewAudioPlan, previewAudioPlan]);

  const sequenceDurations = useMemo(
    () => previewSequencePlaybackItems.map((item) => item.normalizedDisplayTime),
    [previewSequencePlaybackItems]
  );
  const sequencePlayback = useSequencePlaybackController(sequenceDurations);
  const {
    state: sequenceState,
    setSource: setSequenceSource,
    tick: sequenceTick,
    goToNext: sequenceGoToNext,
    goToPrev: sequenceGoToPrev,
    toggle: sequenceToggle,
    pause: sequencePause,
    setLooping: setSequenceLooping,
    setRange: setSequenceRange,
    setBuffering: setSequenceBuffering,
    seekAbsolute: seekSequenceAbsolute,
    seekPercent: seekSequencePercent,
    skip: skipSequence,
    selectors: sequenceSelectors,
    getLiveAbsoluteTime: getSequenceLiveAbsoluteTime,
  } = sequencePlayback;
  const currentIndex = sequenceState.currentIndex;
  const sequenceAbsoluteTime = sequenceSelectors.getAbsoluteTime();

  const {
    focusedMarker,
    inPoint,
    outPoint,
    notifyRangeChange,
    stepMarker,
    stepFocusedMarker,
    handleMarkerFocus,
    handleMarkerDrag,
    handleSelectionDrag,
    handleMarkerDragEnd,
    handleContainerMouseDown,
  } = useClipRangeState({
    usesSequenceController: true,
    sequenceInPoint: sequenceState.inPoint,
    sequenceOutPoint: sequenceState.outPoint,
    sequenceTotalDuration: sequenceState.totalDuration,
    singleModeDuration: 0,
    setSequenceRange,
    frameDuration: FRAME_DURATION,
  });

  const { checkBufferStatus, sequenceMediaElement } = usePreviewSequenceRuntime({
    items: previewSequencePlaybackItems,
    bufferAnchorIndex: currentIndex,
    playbackIndex: sequenceState.currentIndex,
    videoObjectUrl,
    setVideoObjectUrl,
    setSequenceBuffering,
    sequenceIsPlaying: sequenceState.isPlaying,
    sequenceIsBuffering: sequenceState.isBuffering,
    initialPreloadItems: INITIAL_PRELOAD_ITEMS,
    playSafeAhead: PLAY_SAFE_AHEAD,
    preloadAhead: PRELOAD_AHEAD,
    revokeIfBlob,
    setSequenceSource,
    sequenceTick,
    sequenceGoToNext,
    previewSequenceItemByIndex,
    getSequenceLiveAbsoluteTime,
    showMiniToast,
    videoRef,
    sequenceAbsoluteTime,
    previewAudioPlan: effectiveSequenceAudioPlan,
    globalMuted,
    globalVolume,
  });

  const {
    goToNext,
    goToPrev,
    handlePlayPause,
    toggleLooping,
    pauseBeforeExport,
  } = usePreviewPlaybackControls({
    itemsLength: previewSequenceItems.length,
    sequenceState,
    getSequenceAbsoluteTime: sequenceSelectors.getAbsoluteTime,
    sequenceGoToNext,
    sequenceGoToPrev,
    sequenceToggle,
    sequencePause,
    setSequenceLooping,
    seekSequenceAbsolute,
    setSequenceBuffering,
    checkBufferStatus,
  });

  const handleSequenceMarkerDragEnd = useCallback(async () => {
    handleMarkerDragEnd();
  }, [handleMarkerDragEnd]);

  const interactionCommands = usePreviewInteractionCommands({
    mode: 'sequence',
    isPlaying: sequenceState.isPlaying,
    focusedMarker,
    items: previewSequenceItems,
    currentIndex,
    inPoint,
    outPoint,
    singleModeDuration: 0,
    sequenceTotalDuration: sequenceState.totalDuration,
    videoRef,
    resolveAssetForCut,
    playSingleMode: NOOP,
    pauseSingleMode: NOOP,
    seekSingleMode: NOOP,
    getSingleModeCurrentTime: NOOP_NUMBER,
    getSequenceAbsoluteTime: sequenceSelectors.getAbsoluteTime,
    seekSequenceAbsolute,
    seekSequencePercent,
    sequencePause,
    skipSequence,
    setSequenceRange,
    notifyRangeChange,
    handlePlayPause,
    stepMarker,
    stepFocusedMarker,
    handleSingleModeSetInPoint: NOOP,
    handleSingleModeSetOutPoint: NOOP,
    toggleLooping,
    toggleGlobalMute,
    handleMarkerFocus,
    handleMarkerDragStart: NOOP,
    handleMarkerDrag,
    handleMarkerDragEnd: handleSequenceMarkerDragEnd,
    handleSelectionDragStart: NOOP,
    handleSelectionDrag,
    handleSelectionDragEnd: handleSequenceMarkerDragEnd,
  });

  const {
    isDragging,
    hoverTime,
    handleProgressBarMouseDown,
    handleProgressBarHover,
    handleProgressBarLeave,
  } = usePreviewInputs({
    modalRef,
    progressBarRef,
    itemsLength: previewSequenceItems.length,
    totalDuration: sequenceState.totalDuration,
    onPauseBeforeSeek: sequencePause,
    onSeekAbsolute: interactionCommands.seekToAbsolute,
    onSeekPercent: interactionCommands.seekToPercent,
    onClose,
    onPlayPause: interactionCommands.playPause,
    onSkipBack: interactionCommands.skipBack,
    onSkipForward: interactionCommands.skipForward,
    onStepBack: interactionCommands.stepBack,
    onStepForward: interactionCommands.stepForward,
    onToggleFullscreen: toggleFullscreen,
    onToggleLooping: interactionCommands.toggleLooping,
    onSetInPoint: interactionCommands.setInPoint,
    onSetOutPoint: interactionCommands.setOutPoint,
    onToggleMute: interactionCommands.toggleMute,
  });

  const { isExporting, handleExportFull } = usePreviewExportActions({
    items,
    selectedResolution,
    metadataStore: metadataStore ?? null,
    getAsset,
    getCutRuntime,
    onExportSequence,
    pauseBeforeExport,
  });

  const {
    currentItem,
    sequenceTotalDuration,
    sequenceCurrentTime,
    previewResolutionLabel,
    currentFraming,
    previewDisplayClassName,
  } = usePreviewSharedViewState({
    isSingleMode: false,
    isSingleModeVideo: false,
    usesSequenceController: true,
    isDragging,
    items: previewSequenceItems,
    currentIndex,
    sequenceCurrentIndex: sequenceState.currentIndex,
    sequenceTotalDuration: sequenceState.totalDuration,
    getSequenceGlobalProgress: sequenceSelectors.getGlobalProgress,
    getSequenceAbsoluteTime: sequenceSelectors.getAbsoluteTime,
    getSequenceLiveAbsoluteTime,
    sequenceIsPlaying: sequenceState.isPlaying,
    singleModeIsPlaying: false,
    singleModeDuration: 0,
    singleModeCurrentTime: 0,
    asset: undefined,
    cacheAsset,
    focusCut: null,
    previewSequenceItemByCutId,
    resolveAssetForCut,
    selectedResolution,
    globalVolume,
    shouldMuteEmbeddedAudio: NOOP_MUTE_EMBEDDED,
    videoRef,
    progressFillRef,
    progressHandleRef,
  });

  return (
    <PreviewModalSequenceView
      modalRef={modalRef}
      displayContainerRef={displayContainerRef}
      progressBarRef={progressBarRef}
      progressFillRef={progressFillRef}
      progressHandleRef={progressHandleRef}
      onClose={onClose}
      onContainerMouseDown={handleContainerMouseDown}
      showOverlayNow={showOverlayNow}
      scheduleHideOverlay={scheduleHideOverlay}
      previewDisplayClassName={previewDisplayClassName}
      items={previewSequenceItems}
      missingFocusedCut={missingFocusedCut}
      currentIndex={currentIndex}
      currentItem={currentItem}
      sequenceMediaElement={sequenceMediaElement}
      resolveAssetForCut={resolveAssetForCut}
      getViewportStyle={getViewportStyle}
      currentFraming={currentFraming}
      selectedResolution={selectedResolution}
      onResolutionSelect={(preset) => {
        setSelectedResolution(preset);
        onResolutionChange?.(preset);
      }}
      previewResolutionLabel={previewResolutionLabel}
      onExportFull={() => {
        void handleExportFull();
      }}
      isExporting={isExporting}
      isBuffering={sequenceState.isBuffering}
      showOverlay={showOverlay}
      inPoint={inPoint}
      outPoint={outPoint}
      sequenceTotalDuration={sequenceTotalDuration}
      focusedMarker={focusedMarker}
      onMarkerFocus={interactionCommands.markerFocus}
      onMarkerStep={interactionCommands.markerStep}
      onMarkerDragStart={interactionCommands.markerDragStart}
      onMarkerDrag={interactionCommands.markerDrag}
      onMarkerDragEnd={interactionCommands.markerDragEnd}
      onSelectionDragStart={interactionCommands.selectionDragStart}
      onSelectionDrag={interactionCommands.selectionDrag}
      onSelectionDragEnd={interactionCommands.selectionDragEnd}
      onProgressBarMouseDown={handleProgressBarMouseDown}
      onProgressBarHover={handleProgressBarHover}
      onProgressBarLeave={handleProgressBarLeave}
      hoverTime={hoverTime}
      sequenceCurrentTime={sequenceCurrentTime}
      goToPrev={goToPrev}
      handlePlayPause={interactionCommands.playPause}
      isPlaying={sequenceState.isPlaying}
      goToNext={goToNext}
      handleSetInPoint={interactionCommands.setInPoint}
      handleSetOutPoint={interactionCommands.setOutPoint}
      isLooping={sequenceState.isLooping}
      toggleLooping={interactionCommands.toggleLooping}
      globalMuted={globalMuted}
      toggleGlobalMute={interactionCommands.toggleMute}
      isFullscreen={isFullscreen}
      toggleFullscreen={toggleFullscreen}
      miniToastElement={miniToastElement}
    />
  );
}
