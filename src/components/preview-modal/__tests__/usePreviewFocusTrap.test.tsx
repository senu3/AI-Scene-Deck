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

describe('usePreviewFocusTrap', () => {
  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    host = null;
    root = null;
  });

  it('focuses the first tabbable element and wraps Tab navigation', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<Harness />);
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    });

    const buttons = Array.from(host.querySelectorAll('button'));
    const [firstButton, lastButton] = buttons;

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
});
