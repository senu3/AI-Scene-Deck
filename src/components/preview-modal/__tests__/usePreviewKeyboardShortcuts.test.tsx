import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { usePreviewKeyboardShortcuts } from '../usePreviewKeyboardShortcuts';

interface HarnessProps {
  onPlayPause: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
}

function Harness({ onPlayPause, onClose }: HarnessProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  usePreviewKeyboardShortcuts({
    modalRef,
    onClose,
    onPlayPause,
    onSkipBack: vi.fn(),
    onSkipForward: vi.fn(),
    onStepBack: vi.fn(),
    onStepForward: vi.fn(),
    onToggleFullscreen: vi.fn(),
    onToggleLooping: vi.fn(),
    onSetInPoint: vi.fn(),
    onSetOutPoint: vi.fn(),
    onToggleMute: vi.fn(),
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
});
