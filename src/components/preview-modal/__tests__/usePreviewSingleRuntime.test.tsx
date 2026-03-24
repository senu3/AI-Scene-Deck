import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePreviewSingleRuntime } from '../usePreviewSingleRuntime';
import type { MiniToastVariant } from '../../../ui/feedback/MiniToast';

interface RuntimeHarnessProps {
  currentTime: number;
  onClipSave: (
    inPoint: number,
    outPoint: number,
    options?: { expectedClipRevision?: number },
  ) => Promise<void> | void;
  onReady: (runtime: ReturnType<typeof usePreviewSingleRuntime>) => void;
  showMiniToast: (message: string, variant?: MiniToastVariant) => void;
}

function RuntimeHarness({ currentTime, onClipSave, onReady, showMiniToast }: RuntimeHarnessProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [singleModeInPoint, setSingleModeInPoint] = useState<number | null>(null);
  const [singleModeOutPoint, setSingleModeOutPoint] = useState<number | null>(null);
  const [singleModeDuration, setSingleModeDuration] = useState(10);
  const [singleModeCurrentTime, setSingleModeCurrentTime] = useState(currentTime);

  useEffect(() => {
    setSingleModeCurrentTime(currentTime);
  }, [currentTime]);

  const runtime = usePreviewSingleRuntime({
    isSingleModeVideo: true,
    isSingleModeImage: false,
    assetName: 'Preview',
    focusCut: null,
    focusCutId: 'cut-1',
    focusCutIsClip: false,
    focusCutInPoint: undefined,
    focusCutOutPoint: undefined,
    inPoint: singleModeInPoint,
    outPoint: singleModeOutPoint,
    initialInPoint: undefined,
    singleModeInPoint,
    singleModeOutPoint,
    singleModeIsLooping: false,
    setFocusedMarker: vi.fn(),
    setSingleModeInPoint,
    setSingleModeOutPoint,
    notifyRangeChange: vi.fn(),
    setMarkerTime: vi.fn(() => 0),
    videoRef,
    onClipSave,
    onClipClear: vi.fn(),
    onFrameCapture: vi.fn(),
    showMiniToast,
    singleModeImageData: null,
    singleModeImageDuration: 0,
    singleModeDuration,
    setSingleModeDuration,
    singleModeCurrentTime,
    setSingleModeCurrentTime,
    getCurrentClipRevision: () => 0,
  });

  useEffect(() => {
    onReady(runtime);
  }, [onReady, runtime]);

  return null;
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;

describe('usePreviewSingleRuntime', () => {
  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    host = null;
    root = null;
    vi.clearAllMocks();
  });

  it('shows a mini toast when auto-commit creates a new clip', async () => {
    const onClipSave = vi.fn(async () => {});
    const showMiniToast = vi.fn();
    let runtime: ReturnType<typeof usePreviewSingleRuntime> | null = null;

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <RuntimeHarness
          currentTime={1}
          onClipSave={onClipSave}
          onReady={(value) => {
            runtime = value;
          }}
          showMiniToast={showMiniToast}
        />
      );
    });

    await act(async () => {
      runtime?.handleSingleModeSetInPoint();
    });

    await act(async () => {
      root?.render(
        <RuntimeHarness
          currentTime={3}
          onClipSave={onClipSave}
          onReady={(value) => {
            runtime = value;
          }}
          showMiniToast={showMiniToast}
        />
      );
    });

    await act(async () => {
      runtime?.handleSingleModeSetOutPoint();
      await Promise.resolve();
    });

    expect(onClipSave).toHaveBeenCalledWith(1, 3, { expectedClipRevision: 0 });
    expect(showMiniToast).toHaveBeenCalledWith('VIDEOCLIP set', 'success');
  });
});
