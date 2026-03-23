import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    });

    expect(onMarkerStep).toHaveBeenCalledWith('in', 1);
  });
});
