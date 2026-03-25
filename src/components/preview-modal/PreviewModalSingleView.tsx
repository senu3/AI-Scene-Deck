import { Camera, Clock3, MapPinOff, Maximize, Pause, Play, Repeat, Scissors, SkipBack, SkipForward, X } from 'lucide-react';
import type React from 'react';
import type { PreviewableAsset } from '../../types';
import { PlaybackRangeMarkers } from './parts/PlaybackRangeMarkers';
import type { FocusedMarker } from './parts/PlaybackRangeMarkers';
import { usePreviewFocusTrap } from './usePreviewFocusTrap';
import { TimeDisplay } from './parts/TimeDisplay';
import { VolumeControl } from './parts/VolumeControl';
import { PreviewResolutionPicker } from './PreviewResolutionPicker';
import { RESOLUTION_PRESETS } from './constants';
import type { ResolutionPreset } from './types';

interface PreviewModalSingleViewProps {
  modalRef: React.RefObject<HTMLDivElement>;
  displayContainerRef: React.RefObject<HTMLDivElement>;
  progressBarRef: React.RefObject<HTMLDivElement>;
  progressFillRef: React.RefObject<HTMLDivElement>;
  progressHandleRef: React.RefObject<HTMLDivElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  onClose: () => void;
  onContainerMouseDown: (e: React.MouseEvent) => void;
  previewDisplayClassName: string;
  showOverlayNow: () => void;
  scheduleHideOverlay: () => void;
  asset: PreviewableAsset;
  isAssetOnlyPreview: boolean;
  isLoading: boolean;
  isVideo: boolean;
  isImage: boolean;
  videoObjectUrl: { assetId: string; url: string } | null;
  singleMediaElement: JSX.Element | null;
  imageData: string | null;
  getViewportStyle: () => { width: number; height: number; scale: number } | null;
  currentFraming: React.CSSProperties;
  selectedResolution: ResolutionPreset;
  onResolutionSelect: (preset: ResolutionPreset) => void;
  previewResolutionLabel: string | null;
  showOverlay: boolean;
  inPoint: number | null;
  outPoint: number | null;
  playbackDuration: number;
  playbackProgressPercent: number;
  playbackTime: number;
  hoverTime: string | null;
  focusedMarker: FocusedMarker;
  onMarkerFocus: (marker: FocusedMarker) => void;
  onMarkerStep: (marker: 'in' | 'out', direction: number) => void;
  onMarkerDragStart: (marker: 'in' | 'out') => void;
  onMarkerDrag: (marker: 'in' | 'out', newTime: number) => void;
  onMarkerDragEnd: () => void;
  onSelectionDragStart: () => void;
  onSelectionDrag: (baseInPoint: number, baseOutPoint: number, deltaTime: number) => void;
  onSelectionDragEnd: () => void;
  onProgressBarMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onProgressBarHover: (e: React.MouseEvent<HTMLDivElement>) => void;
  onProgressBarLeave: () => void;
  isPlaying: boolean;
  skipBack: () => void;
  skipForward: () => void;
  togglePlay: () => void;
  onSetInPoint?: () => void;
  onSetOutPoint?: () => void;
  showClearRangeButton: boolean;
  onClearRange: () => void;
  showClipButton: boolean;
  isClipEnabled: boolean;
  onClipPrimaryAction: () => void;
  isClipPending: boolean;
  onFrameCapture?: () => void;
  showHoldButton: boolean;
  isHoldEnabled: boolean;
  onHoldToggle: () => void;
  isLooping: boolean;
  toggleLooping: () => void;
  globalMuted: boolean;
  toggleGlobalMute: () => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  miniToastElement: React.ReactNode;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onVideoPlay: () => void;
  onVideoPause: () => void;
  onVideoEnded: () => void;
}

export function PreviewModalSingleView({
  modalRef,
  displayContainerRef,
  progressBarRef,
  progressFillRef,
  progressHandleRef,
  videoRef,
  onClose,
  onContainerMouseDown,
  previewDisplayClassName,
  showOverlayNow,
  scheduleHideOverlay,
  asset,
  isAssetOnlyPreview,
  isLoading,
  isVideo,
  isImage,
  videoObjectUrl,
  singleMediaElement,
  imageData,
  getViewportStyle,
  currentFraming,
  selectedResolution,
  onResolutionSelect,
  previewResolutionLabel,
  showOverlay,
  inPoint,
  outPoint,
  playbackDuration,
  playbackProgressPercent,
  playbackTime,
  hoverTime,
  focusedMarker,
  onMarkerFocus,
  onMarkerStep,
  onMarkerDragStart,
  onMarkerDrag,
  onMarkerDragEnd,
  onSelectionDragStart,
  onSelectionDrag,
  onSelectionDragEnd,
  onProgressBarMouseDown,
  onProgressBarHover,
  onProgressBarLeave,
  isPlaying,
  skipBack,
  skipForward,
  togglePlay,
  onSetInPoint,
  onSetOutPoint,
  showClearRangeButton,
  onClearRange,
  showClipButton,
  isClipEnabled,
  onClipPrimaryAction,
  isClipPending,
  onFrameCapture,
  showHoldButton,
  isHoldEnabled,
  onHoldToggle,
  isLooping,
  toggleLooping,
  globalMuted,
  toggleGlobalMute,
  isFullscreen,
  toggleFullscreen,
  miniToastElement,
  onTimeUpdate,
  onLoadedMetadata,
  onVideoPlay,
  onVideoPause,
  onVideoEnded,
}: PreviewModalSingleViewProps) {
  const viewportStyle = getViewportStyle();
  const loadingLabel = isVideo ? 'video' : 'image';
  const handleModalKeyDownCapture = usePreviewFocusTrap(modalRef);
  let mediaContent: JSX.Element;

  if (isLoading) {
    mediaContent = (
      <div className="preview-placeholder">
        <div className="loading-spinner" />
        <p>Loading {loadingLabel}...</p>
      </div>
    );
  } else if (isVideo && videoObjectUrl?.url) {
    const videoNode = (
      <video
        ref={videoRef}
        src={videoObjectUrl.url}
        className="preview-media"
        onClick={togglePlay}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={onVideoPlay}
        onPause={onVideoPause}
        onEnded={onVideoEnded}
      />
    );
    mediaContent = viewportStyle ? videoNode : (
      <>
        {videoNode}
        {!isPlaying && !isLoading && (
          <div className="play-overlay" onClick={togglePlay}>
            <Play size={40} />
          </div>
        )}
      </>
    );
  } else if (isImage && imageData) {
    const imageNode = singleMediaElement ?? (
      <img
        src={imageData}
        alt={asset.name || 'Preview'}
        className="preview-media"
      />
    );
    mediaContent = imageNode;
  } else {
    mediaContent = (
      <div className="preview-placeholder">
        <p>Failed to load {loadingLabel}</p>
      </div>
    );
  }

  return (
    <div
      className="preview-modal"
      ref={modalRef}
      onMouseDown={onContainerMouseDown}
      onKeyDownCapture={handleModalKeyDownCapture}
    >
      <div className="preview-backdrop" onClick={onClose} />
      <div className="preview-container preview-container--compact">
        <div
          className={previewDisplayClassName}
          ref={displayContainerRef}
          onMouseEnter={showOverlayNow}
          onMouseMove={showOverlayNow}
          onMouseLeave={scheduleHideOverlay}
        >
          <div className="preview-header preview-header--compact">
            <div className="preview-header-left">
              <span className="preview-title">{asset.name}</span>
              {isAssetOnlyPreview && (
                <span className="preview-badge">Asset Preview</span>
              )}
            </div>
            <div className="preview-header-right">
              <button className="preview-close-btn" onClick={onClose} title="Close (Esc)">
                <X size={20} />
              </button>
            </div>
          </div>

          {viewportStyle ? (
            <div
              className="resolution-viewport"
              style={{
                width: viewportStyle.width,
                height: viewportStyle.height,
                ...currentFraming,
              }}
            >
              <div className="resolution-label">
                {selectedResolution.name} ({selectedResolution.width}×{selectedResolution.height})
              </div>
              {mediaContent}
            </div>
          ) : mediaContent}

          <div
            className={`preview-overlay ${showOverlay ? 'is-visible' : ''}`}
            onMouseEnter={showOverlayNow}
            onMouseLeave={scheduleHideOverlay}
          >
            <div className="preview-overlay-row preview-overlay-row--top">
              <div className="preview-overlay-left">
                {previewResolutionLabel && (
                  <span className="preview-resolution-badge">{previewResolutionLabel}</span>
                )}
              </div>
              <div className="preview-overlay-right">
                <PreviewResolutionPicker
                  selectedResolutionName={selectedResolution.name}
                  presets={RESOLUTION_PRESETS}
                  onSelect={onResolutionSelect}
                />
              </div>
            </div>

            <div className="preview-overlay-row preview-overlay-row--bottom">
              {(isVideo || isImage) && (
                <div className="preview-progress">
                  <div
                    className="preview-progress-bar preview-progress-bar--scrub"
                    ref={progressBarRef}
                    onMouseDown={onProgressBarMouseDown}
                    onMouseMove={onProgressBarHover}
                    onMouseLeave={onProgressBarLeave}
                  >
                    {isVideo && (
                      <PlaybackRangeMarkers
                        inPoint={inPoint}
                        outPoint={outPoint}
                        duration={playbackDuration}
                        showMilliseconds
                        focusedMarker={focusedMarker}
                        onMarkerFocus={onMarkerFocus}
                        onMarkerStep={onMarkerStep}
                        onMarkerDragStart={onMarkerDragStart}
                        onMarkerDrag={onMarkerDrag}
                        onMarkerDragEnd={onMarkerDragEnd}
                        onSelectionDragStart={onSelectionDragStart}
                        onSelectionDrag={onSelectionDrag}
                        onSelectionDragEnd={onSelectionDragEnd}
                        progressBarRef={progressBarRef}
                      />
                    )}
                    <div
                      ref={progressFillRef}
                      className="preview-progress-fill"
                      style={{ width: `${playbackProgressPercent}%` }}
                    />
                    <div
                      ref={progressHandleRef}
                      className="preview-progress-handle"
                      style={{ left: `${playbackProgressPercent}%` }}
                    />
                    {hoverTime && (
                      <div className="preview-progress-tooltip">
                        {hoverTime}
                      </div>
                    )}
                  </div>
                  <div className="preview-progress-info">
                    <TimeDisplay
                      currentTime={playbackTime}
                      totalDuration={playbackDuration}
                      showMilliseconds
                    />
                  </div>
                </div>
              )}

              <div className="preview-controls-row">
                <button
                  className="preview-ctrl-btn"
                  onClick={skipBack}
                  title="Rewind 5s (←)"
                >
                  <SkipBack size={18} />
                </button>
                <button
                  className="preview-ctrl-btn preview-ctrl-btn--primary"
                  onClick={togglePlay}
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? <Pause size={22} /> : <Play size={22} />}
                </button>
                <button
                  className="preview-ctrl-btn"
                  onClick={skipForward}
                  title="Forward 5s (→)"
                >
                  <SkipForward size={18} />
                </button>
                {isVideo && (
                  <>
                    <div className="preview-ctrl-divider" />
                    <button
                      className={`preview-ctrl-btn preview-ctrl-btn--text ${inPoint !== null ? 'is-active' : ''}`}
                      onClick={onSetInPoint}
                      title="Set IN point (I)"
                    >
                      I
                    </button>
                    <button
                      className={`preview-ctrl-btn preview-ctrl-btn--text ${outPoint !== null ? 'is-active' : ''}`}
                      onClick={onSetOutPoint}
                      title="Set OUT point (O)"
                    >
                      O
                    </button>
                  </>
                )}
                {isVideo && showClipButton && (
                  <button
                    className={`preview-ctrl-btn ${isClipEnabled ? 'is-active' : ''}`}
                    onClick={onClipPrimaryAction}
                    title={isClipEnabled ? 'Clear clip' : 'Save clip'}
                    disabled={isClipPending}
                  >
                    <Scissors size={18} />
                  </button>
                )}
                {isVideo && showClearRangeButton && (
                  <button
                    className="preview-ctrl-btn"
                    onClick={onClearRange}
                    title="Clear I/O"
                  >
                    <MapPinOff size={16} />
                  </button>
                )}
                {isVideo && showHoldButton && (
                  <button
                    className={`preview-ctrl-btn ${isHoldEnabled ? 'is-active' : ''}`}
                    onClick={onHoldToggle}
                    title={isHoldEnabled ? 'Disable VIDEO Hold' : 'Enable VIDEO Hold'}
                  >
                    <Clock3 size={18} />
                  </button>
                )}
                <div className="preview-ctrl-divider" />
                {isVideo && onFrameCapture && (
                  <button
                    className="preview-ctrl-btn"
                    onClick={onFrameCapture}
                    title="Capture frame"
                  >
                    <Camera size={18} />
                  </button>
                )}
                <button
                  className={`preview-ctrl-btn ${isLooping ? 'is-active' : ''}`}
                  onClick={toggleLooping}
                  title={`Loop (L) - ${isLooping ? 'On' : 'Off'}`}
                >
                  <Repeat size={16} />
                </button>
                <VolumeControl
                  isMuted={globalMuted}
                  onMuteToggle={toggleGlobalMute}
                />
                <button
                  className="preview-ctrl-btn"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
                >
                  <Maximize size={16} />
                </button>
                {miniToastElement}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
