import type React from 'react';
import { useEffect, useState } from 'react';
import type { ExportSequenceItem } from '../../utils/exportSequence';
import {
  createImageMediaSource,
  createVideoHoldMediaSource,
  createVideoMediaSource,
  type MediaSource,
} from '../../utils/previewMedia';
import type { PreviewSequencePlaybackItem } from './types';

interface UsePreviewSequenceMediaSourceInput {
  items: PreviewSequencePlaybackItem[];
  playbackIndex: number;
  videoObjectUrl: { assetId: string; url: string } | null;
  setSequenceSource: (source: MediaSource | null) => void;
  sequenceTick: (localTime: number) => void;
  sequenceGoToNext: (fromIndex?: number) => void;
  previewSequenceItemByIndex: Map<number, ExportSequenceItem>;
  getSequenceLiveAbsoluteTime: () => number;
  showMiniToast: (message: string, variant?: 'success' | 'info' | 'warning' | 'error') => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function usePreviewSequenceMediaSource({
  items,
  playbackIndex,
  videoObjectUrl,
  setSequenceSource,
  sequenceTick,
  sequenceGoToNext,
  previewSequenceItemByIndex,
  getSequenceLiveAbsoluteTime,
  showMiniToast,
  videoRef,
}: UsePreviewSequenceMediaSourceInput) {
  const [sequenceMediaElement, setSequenceMediaElement] = useState<JSX.Element | null>(null);

  useEffect(() => {
    setSequenceSource(null);
    setSequenceMediaElement(null);

    const currentItem = items[playbackIndex];
    if (!currentItem) return;
    const currentSpec = previewSequenceItemByIndex.get(playbackIndex);
    if (!currentSpec) return;

    if (currentItem.assetType === 'video') {
      if (!videoObjectUrl || videoObjectUrl.assetId !== currentItem.assetId) {
        return;
      }

      if (currentItem.isHold) {
        const holdSourceKey = `${currentItem.cutId}:${videoObjectUrl.url}:hold:${currentItem.srcInSec}:${currentItem.normalizedDisplayTime}`;
        const holdSource = createVideoHoldMediaSource({
          src: videoObjectUrl.url,
          key: holdSourceKey,
          className: 'preview-media',
          muted: true,
          refObject: videoRef,
          frameTimeSec: currentItem.srcOutSec,
          duration: currentItem.normalizedDisplayTime,
          onTimeUpdate: sequenceTick,
          onEnded: () => sequenceGoToNext(playbackIndex),
        });
        setSequenceSource(holdSource);
        setSequenceMediaElement(holdSource.element);
        return;
      }

      const videoSourceKey = `${currentItem.cutId}:${videoObjectUrl.url}:${currentItem.srcInSec}:${currentItem.srcOutSec}`;
      const source = createVideoMediaSource({
        src: videoObjectUrl.url,
        key: videoSourceKey,
        className: 'preview-media',
        muted: true,
        refObject: videoRef,
        inPoint: currentItem.srcInSec,
        outPoint: currentItem.srcOutSec,
        onTimeUpdate: sequenceTick,
        onEnded: () => sequenceGoToNext(playbackIndex),
      });
      setSequenceSource(source);
      setSequenceMediaElement(source.element);
      return;
    }

    if (currentItem.assetType === 'image' && currentItem.thumbnail) {
      const source = createImageMediaSource({
        src: currentItem.thumbnail,
        alt: `${currentItem.sceneName} - Cut ${currentItem.cutIndex + 1}`,
        className: 'preview-media',
        duration: currentItem.normalizedDisplayTime,
        onTimeUpdate: sequenceTick,
        onEnded: () => sequenceGoToNext(playbackIndex),
      });
      setSequenceSource(source);
      setSequenceMediaElement(source.element);
    }
  }, [
    items,
    playbackIndex,
    videoObjectUrl,
    setSequenceSource,
    sequenceTick,
    sequenceGoToNext,
    previewSequenceItemByIndex,
    getSequenceLiveAbsoluteTime,
    showMiniToast,
    videoRef,
  ]);

  return {
    sequenceMediaElement,
  };
}
