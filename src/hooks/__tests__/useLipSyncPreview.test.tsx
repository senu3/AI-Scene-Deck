import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { useLipSyncPreview } from '../useLipSyncPreview';

const baseThresholds = { t1: 0.1, t2: 0.2, t3: 0.3 };

type ProbeProps = {
  getTime: () => number;
  rms: number[] | null;
  fps: number;
  intervalMs?: number;
  onVariant: (value: number) => void;
};

function PreviewProbe({ getTime, rms, fps, intervalMs = 10, onVariant }: ProbeProps) {
  const variant = useLipSyncPreview({
    enabled: true,
    rms,
    fps,
    thresholds: baseThresholds,
    getCurrentTime: getTime,
    intervalMs,
  });
  React.useEffect(() => {
    onVariant(variant);
  }, [variant, onVariant]);
  return null;
}

describe('useLipSyncPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates variant index as time advances', async () => {
    const timeRef = { current: 0 };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const rms = Array.from({ length: 60 }, (_, i) => (i === 30 ? 0.15 : i === 40 ? 0.25 : i === 50 ? 0.35 : 0));
    const variants: number[] = [];

    act(() => {
      root.render(
        <PreviewProbe
          getTime={() => timeRef.current}
          rms={rms}
          fps={30}
          intervalMs={10}
          onVariant={(value) => variants.push(value)}
        />
      );
    });

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(variants.at(-1)).toBe(0);

    timeRef.current = 1;
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(variants.at(-1)).toBe(1);

    timeRef.current = 4 / 3;
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(variants.at(-1)).toBe(2);

    timeRef.current = 5 / 3;
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(variants.at(-1)).toBe(3);
  });

  it('falls back to base variant when RMS is missing', () => {
    const timeRef = { current: 0 };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const variants: number[] = [];

    act(() => {
      root.render(
        <PreviewProbe
          getTime={() => timeRef.current}
          rms={null}
          fps={60}
          onVariant={(value) => variants.push(value)}
        />
      );
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(variants.at(-1)).toBe(0);

    timeRef.current = 10;
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(variants.at(-1)).toBe(0);
  });
});
