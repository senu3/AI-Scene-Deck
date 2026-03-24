import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useRef } from 'react';
import { usePreviewFocusTrap } from '../usePreviewFocusTrap';

function Harness() {
  const modalRef = useRef<HTMLDivElement>(null);
  const handleKeyDownCapture = usePreviewFocusTrap(modalRef);

  return (
    <div ref={modalRef} onKeyDownCapture={handleKeyDownCapture}>
      <button type="button">First</button>
      <button type="button">Last</button>
    </div>
  );
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function waitForFocusTrapFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

describe('usePreviewFocusTrap', () => {
  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    host = null;
    root = null;
  });

  it('wraps Tab navigation when focus is on the modal root or last control', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<Harness />);
      await waitForFocusTrapFrame();
    });

    const buttons = Array.from(host.querySelectorAll('button'));
    const [firstButton, lastButton] = buttons;
    const modal = host.firstElementChild as HTMLDivElement;

    act(() => {
      modal.focus();
    });

    act(() => {
      lastButton.focus();
    });

    act(() => {
      lastButton.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      }));
    });

    expect(document.activeElement).toBe(firstButton);
  });

  it('returns focus to the modal when clicking non-interactive preview surface', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<Harness />);
      await waitForFocusTrapFrame();
    });

    const modal = host.firstElementChild as HTMLDivElement;
    const [firstButton] = Array.from(host.querySelectorAll('button'));

    act(() => {
      firstButton.focus();
      modal.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
      }));
    });

    expect(document.activeElement).toBe(modal);
  });
});
