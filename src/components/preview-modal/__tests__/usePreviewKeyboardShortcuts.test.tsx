import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { usePreviewKeyboardShortcuts } from '../usePreviewKeyboardShortcuts';

interface HarnessProps {
  onPlayPause: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
  onSkipBySeconds?: ReturnType<typeof vi.fn>;
  onSetInPoint?: ReturnType<typeof vi.fn>;
  onSetOutPoint?: ReturnType<typeof vi.fn>;
  onPrimaryClipAction?: ReturnType<typeof vi.fn>;
  onToggleHold?: ReturnType<typeof vi.fn>;
  onCaptureFrame?: ReturnType<typeof vi.fn>;
  onExportFull?: ReturnType<typeof vi.fn>;
}

function Harness({
  onPlayPause,
  onClose,
  onSkipBySeconds,
  onSetInPoint,
  onSetOutPoint,
  onPrimaryClipAction,
  onToggleHold,
  onCaptureFrame,
  onExportFull,
}: HarnessProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  usePreviewKeyboardShortcuts({
    modalRef,
    onClose,
    onPlayPause,
    onSkipBySeconds: onSkipBySeconds ?? vi.fn(),
    onStepBack: vi.fn(),
    onStepForward: vi.fn(),
    onToggleFullscreen: vi.fn(),
    onToggleLooping: vi.fn(),
    onSetInPoint,
    onSetOutPoint,
    onToggleMute: vi.fn(),
    onPrimaryClipAction,
    onToggleHold,
    onCaptureFrame,
    onExportFull,
  });

  return (
    <>
      <div ref={modalRef} className="preview-modal">
        <div tabIndex={0}>Preview Surface</div>
        <button type="button">Preview Button</button>
      </div>
      <div>
        <button type="button">Nested Modal Button</button>
      </div>
    </>
  );
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;

describe('usePreviewKeyboardShortcuts', () => {
  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    host = null;
    root = null;
  });

  it('only handles keys when focus stays inside preview and off interactive controls', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    const onPlayPause = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root?.render(<Harness onPlayPause={onPlayPause} onClose={onClose} />);
    });

    const previewSurface = host.querySelector('[tabindex="0"]') as HTMLDivElement;
    const previewButton = host.querySelector('.preview-modal button') as HTMLButtonElement;
    const nestedModalButton = host.querySelectorAll('button')[1] as HTMLButtonElement;

    act(() => {
      previewSurface.focus();
      previewSurface.dispatchEvent(new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
      }));
    });

    expect(onPlayPause).toHaveBeenCalledTimes(1);

    act(() => {
      previewButton.focus();
      previewButton.dispatchEvent(new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
      }));
    });

    expect(onPlayPause).toHaveBeenCalledTimes(1);

    act(() => {
      nestedModalButton.focus();
      nestedModalButton.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('skips I/O bindings when the preview mode does not expose range editing', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    const onPlayPause = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root?.render(<Harness onPlayPause={onPlayPause} onClose={onClose} />);
    });

    const previewSurface = host.querySelector('[tabindex="0"]') as HTMLDivElement;

    act(() => {
      previewSurface.focus();
      previewSurface.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'i',
        bubbles: true,
        cancelable: true,
      }));
      previewSurface.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'o',
        bubbles: true,
        cancelable: true,
      }));
    });

    expect(onPlayPause).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('normalizes letter shortcuts and ignores repeat for toggle-style actions', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    const onPlayPause = vi.fn();
    const onClose = vi.fn();
    const onSkipBySeconds = vi.fn();
    const onSetInPoint = vi.fn();
    const onPrimaryClipAction = vi.fn();
    const onToggleHold = vi.fn();
    const onCaptureFrame = vi.fn();
    const onExportFull = vi.fn();

    await act(async () => {
      root?.render(
        <Harness
          onPlayPause={onPlayPause}
          onClose={onClose}
          onSkipBySeconds={onSkipBySeconds}
          onSetInPoint={onSetInPoint}
          onPrimaryClipAction={onPrimaryClipAction}
          onToggleHold={onToggleHold}
          onCaptureFrame={onCaptureFrame}
          onExportFull={onExportFull}
        />,
      );
    });

    const previewSurface = host.querySelector('[tabindex="0"]') as HTMLDivElement;

    act(() => {
      previewSurface.focus();
      previewSurface.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'I',
        bubbles: true,
        cancelable: true,
      }));
      previewSurface.dispatchEvent(new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
        repeat: true,
      }));
      previewSurface.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
        cancelable: true,
        repeat: true,
      }));
      previewSurface.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
        shiftKey: true,
      }));
      previewSurface.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
        cancelable: true,
        altKey: true,
      }));
      previewSurface.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'S',
        bubbles: true,
        cancelable: true,
      }));
      previewSurface.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'H',
        bubbles: true,
        cancelable: true,
      }));
      previewSurface.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'C',
        bubbles: true,
        cancelable: true,
      }));
      previewSurface.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'E',
        bubbles: true,
        cancelable: true,
      }));
    });

    expect(onSetInPoint).toHaveBeenCalledTimes(1);
    expect(onPlayPause).not.toHaveBeenCalled();
    expect(onSkipBySeconds).toHaveBeenNthCalledWith(1, -5);
    expect(onSkipBySeconds).toHaveBeenNthCalledWith(2, 10);
    expect(onSkipBySeconds).toHaveBeenNthCalledWith(3, -1);
    expect(onPrimaryClipAction).toHaveBeenCalledTimes(1);
    expect(onToggleHold).toHaveBeenCalledTimes(1);
    expect(onCaptureFrame).toHaveBeenCalledTimes(1);
    expect(onExportFull).toHaveBeenCalledTimes(1);
  });
});
