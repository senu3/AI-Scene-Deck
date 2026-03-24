import { FRAME_DURATION } from './constants';
import { clampToDuration } from './helpers';

interface ComputeRangeInput {
  playheadTime: number;
  duration: number;
  inPoint: number | null;
  outPoint: number | null;
}

interface ConstrainMarkerTimeInput {
  marker: 'in' | 'out';
  candidateTime: number;
  duration: number;
  inPoint: number | null;
  outPoint: number | null;
}

interface MoveRangeWindowInput {
  inPoint: number | null;
  outPoint: number | null;
  duration: number;
  deltaTime: number;
}

interface IsPlayheadNearMarkerInput {
  playheadTime: number;
  markerTime: number | null;
  tolerance?: number;
}

export const MIN_CLIP_RANGE_SPAN = FRAME_DURATION;
const MARKER_FOCUS_EPSILON = 0.0001;

function resolveEffectiveMinSpan(duration: number): number {
  return Math.max(0, Math.min(duration, MIN_CLIP_RANGE_SPAN));
}

function clampInPointAgainstOutPoint(candidateTime: number, duration: number, outPoint: number): number {
  const maxInPoint = Math.max(0, outPoint - resolveEffectiveMinSpan(duration));
  return Math.min(candidateTime, maxInPoint);
}

function clampOutPointAgainstInPoint(candidateTime: number, duration: number, inPoint: number): number {
  const minOutPoint = Math.min(duration, inPoint + resolveEffectiveMinSpan(duration));
  return Math.max(candidateTime, minOutPoint);
}

export function computeNextRangeForSetIn({
  playheadTime,
  duration,
  inPoint: _inPoint,
  outPoint,
}: ComputeRangeInput): { inPoint: number | null; outPoint: number | null } {
  void _inPoint;
  const nextInPoint = clampToDuration(playheadTime, duration);
  if (outPoint === null) {
    return { inPoint: nextInPoint, outPoint };
  }
  return {
    inPoint: clampInPointAgainstOutPoint(nextInPoint, duration, outPoint),
    outPoint,
  };
}

export function computeNextRangeForSetOut({
  playheadTime,
  duration,
  inPoint,
  outPoint: _outPoint,
}: ComputeRangeInput): { inPoint: number | null; outPoint: number | null } {
  void _outPoint;
  const nextOutPoint = clampToDuration(playheadTime, duration);
  if (inPoint === null) {
    return { inPoint, outPoint: nextOutPoint };
  }
  return {
    inPoint,
    outPoint: clampOutPointAgainstInPoint(nextOutPoint, duration, inPoint),
  };
}

export function constrainMarkerTime({
  marker,
  candidateTime,
  duration,
  inPoint,
  outPoint,
}: ConstrainMarkerTimeInput): number {
  const nextTime = clampToDuration(candidateTime, duration);
  if (marker === 'in' && outPoint !== null) {
    return clampInPointAgainstOutPoint(nextTime, duration, outPoint);
  }
  if (marker === 'out' && inPoint !== null) {
    return clampOutPointAgainstInPoint(nextTime, duration, inPoint);
  }
  return nextTime;
}

export function moveRangeWindow({
  inPoint,
  outPoint,
  duration,
  deltaTime,
}: MoveRangeWindowInput): { inPoint: number | null; outPoint: number | null } {
  if (inPoint === null || outPoint === null) {
    return { inPoint, outPoint };
  }

  const rangeStart = Math.min(inPoint, outPoint);
  const rangeEnd = Math.max(inPoint, outPoint);
  const span = rangeEnd - rangeStart;
  const maxStart = Math.max(0, duration - span);
  const nextStart = clampToDuration(rangeStart + deltaTime, maxStart);

  return {
    inPoint: nextStart,
    outPoint: nextStart + span,
  };
}

export function hasValidRangeSpan(
  inPoint: number | null,
  outPoint: number | null,
  duration: number,
): boolean {
  if (inPoint === null || outPoint === null) return false;
  return Math.abs(outPoint - inPoint) >= resolveEffectiveMinSpan(duration);
}

export function isPlayheadNearMarker({
  playheadTime,
  markerTime,
  tolerance = FRAME_DURATION,
}: IsPlayheadNearMarkerInput): boolean {
  if (markerTime === null) return false;
  return Math.abs(playheadTime - markerTime) <= (Math.max(0, tolerance) + MARKER_FOCUS_EPSILON);
}

interface ResolveUiPlayheadTimeInput {
  mode: 'single' | 'sequence';
  getSingleModeCurrentTime: () => number;
  getSequenceAbsoluteTime: () => number;
}

export function resolveUiPlayheadTime({
  mode,
  getSingleModeCurrentTime,
  getSequenceAbsoluteTime,
}: ResolveUiPlayheadTimeInput): number {
  if (mode === 'single') {
    return getSingleModeCurrentTime();
  }
  return getSequenceAbsoluteTime();
}
