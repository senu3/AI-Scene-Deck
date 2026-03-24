import { describe, expect, it } from 'vitest';
import {
  MIN_CLIP_RANGE_SPAN,
  computeNextRangeForSetIn,
  computeNextRangeForSetOut,
  constrainMarkerTime,
  hasValidRangeSpan,
  isPlayheadNearMarker,
  moveRangeWindow,
} from '../clipRangeOps';

describe('clipRangeOps', () => {
  it('clamps IN/OUT updates instead of collapsing the opposite marker', () => {
    expect(computeNextRangeForSetIn({
      playheadTime: 6,
      duration: 10,
      inPoint: 2,
      outPoint: 5,
    })).toEqual({ inPoint: 5 - MIN_CLIP_RANGE_SPAN, outPoint: 5 });

    expect(computeNextRangeForSetOut({
      playheadTime: 2,
      duration: 10,
      inPoint: 4,
      outPoint: 8,
    })).toEqual({ inPoint: 4, outPoint: 4 + MIN_CLIP_RANGE_SPAN });
  });

  it('constrains marker drags to keep the minimum span', () => {
    expect(constrainMarkerTime({
      marker: 'in',
      candidateTime: 9,
      duration: 10,
      inPoint: 2,
      outPoint: 5,
    })).toBe(5 - MIN_CLIP_RANGE_SPAN);

    expect(constrainMarkerTime({
      marker: 'out',
      candidateTime: 2,
      duration: 10,
      inPoint: 4,
      outPoint: 8,
    })).toBe(4 + MIN_CLIP_RANGE_SPAN);
  });

  it('moves the whole selected range while clamping at the edges', () => {
    expect(moveRangeWindow({
      inPoint: 2,
      outPoint: 5,
      duration: 10,
      deltaTime: 3,
    })).toEqual({ inPoint: 5, outPoint: 8 });

    expect(moveRangeWindow({
      inPoint: 2,
      outPoint: 5,
      duration: 10,
      deltaTime: 10,
    })).toEqual({ inPoint: 7, outPoint: 10 });
  });

  it('rejects ranges shorter than the minimum clip span', () => {
    expect(hasValidRangeSpan(1, 1, 10)).toBe(false);
    expect(hasValidRangeSpan(1, 1 + MIN_CLIP_RANGE_SPAN, 10)).toBe(true);
  });

  it('treats playhead positions within one frame as re-focusing the same marker', () => {
    expect(isPlayheadNearMarker({
      playheadTime: 2,
      markerTime: 2,
    })).toBe(true);

    expect(isPlayheadNearMarker({
      playheadTime: 2 + (MIN_CLIP_RANGE_SPAN * 0.9),
      markerTime: 2,
    })).toBe(true);

    expect(isPlayheadNearMarker({
      playheadTime: 2 + (MIN_CLIP_RANGE_SPAN * 1.1),
      markerTime: 2,
    })).toBe(false);
  });
});
