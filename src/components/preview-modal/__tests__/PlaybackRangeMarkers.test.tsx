import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FRAME_DURATION } from '../constants';
import { PlaybackRangeMarkers } from '../parts/PlaybackRangeMarkers';

interface HarnessProps {
  onMarkerFocus: (marker: 'in' | 'out' | null) => void;
  onMarkerStep: (marker: 'in' | 'out', direction: number) => void;
}

function Harness({ onMarkerFocus, onMarkerStep }: HarnessProps) {
  const progressBarRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={progressBarRef}>
      <PlaybackRangeMarkers
        inPoint={1}
        outPoint={3}
        duration={10}
        focusedMarker="in"
        onMarkerFocus={onMarkerFocus}
        onMarkerStep={onMarkerStep}
        progressBarRef={progressBarRef}
      />
    </div>
  );
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;

describe('PlaybackRangeMarkers', () => {
  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    host = null;
    root = null;
  });

  it('focusable markers invoke keyboard step handlers', async () => {
    const onMarkerFocus = vi.fn();
    const onMarkerStep = vi.fn();

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <Harness onMarkerFocus={onMarkerFocus} onMarkerStep={onMarkerStep} />
      );
    });

    const inMarker = host.querySelector('.timeline-marker.in-marker');
    expect(inMarker).toBeInstanceOf(HTMLDivElement);

    act(() => {
      (inMarker as HTMLDivElement).focus();
    });

    expect(onMarkerFocus).toHaveBeenCalledWith('in');

    act(() => {
      inMarker?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      inMarker?.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
        shiftKey: true,
      }));
      inMarker?.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        altKey: true,
      }));
      inMarker?.dispatchEvent(new KeyboardEvent('keydown', { key: '.', bubbles: true }));
    });

    expect(onMarkerStep).toHaveBeenNthCalledWith(1, 'in', Math.round(5 / FRAME_DURATION));
    expect(onMarkerStep).toHaveBeenNthCalledWith(2, 'in', -Math.round(10 / FRAME_DURATION));
    expect(onMarkerStep).toHaveBeenNthCalledWith(3, 'in', Math.round(1 / FRAME_DURATION));
    expect(onMarkerStep).toHaveBeenNthCalledWith(4, 'in', 1);
  });

  it('allows Enter to confirm marker editing and release focus', async () => {
    const onMarkerFocus = vi.fn();
    const onMarkerStep = vi.fn();

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <Harness onMarkerFocus={onMarkerFocus} onMarkerStep={onMarkerStep} />
      );
    });

    const inMarker = host.querySelector('.timeline-marker.in-marker') as HTMLDivElement;

    act(() => {
      inMarker.focus();
      inMarker.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }));
    });

    expect(onMarkerFocus).toHaveBeenCalledWith('in');
    expect(onMarkerFocus).toHaveBeenCalledWith(null);
    expect(document.activeElement).not.toBe(inMarker);
  });
});
