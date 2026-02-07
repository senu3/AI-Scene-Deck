import { describe, expect, it } from 'vitest';
import { absoluteTimeToRmsIndex, normalizeThresholds, rmsValueToVariantIndex } from '../lipSyncUtils';

describe('lipSyncUtils', () => {
  it('normalizes thresholds to non-decreasing values', () => {
    const normalized = normalizeThresholds({ t1: 0.3, t2: 0.1, t3: 0.2 });
    expect(normalized).toEqual({ t1: 0.3, t2: 0.3, t3: 0.3 });
  });

  it('maps RMS value to variant index', () => {
    const thresholds = { t1: 0.1, t2: 0.2, t3: 0.3 };
    expect(rmsValueToVariantIndex(0.05, thresholds)).toBe(0);
    expect(rmsValueToVariantIndex(0.1, thresholds)).toBe(1);
    expect(rmsValueToVariantIndex(0.25, thresholds)).toBe(2);
    expect(rmsValueToVariantIndex(0.3, thresholds)).toBe(3);
  });

  it('calculates RMS index from absolute time', () => {
    expect(absoluteTimeToRmsIndex(0, 60, 120)).toBe(0);
    expect(absoluteTimeToRmsIndex(0.5, 60, 120)).toBe(30);
    expect(absoluteTimeToRmsIndex(2.5, 60, 120)).toBe(119);
  });

  it('applies audio offset and clamps index', () => {
    expect(absoluteTimeToRmsIndex(-1, 60, 10)).toBe(0);
    expect(absoluteTimeToRmsIndex(0, 60, 10, 1)).toBe(9);
  });
});
