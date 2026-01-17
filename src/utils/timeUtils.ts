// Common time formatting utilities

/**
 * Format time in seconds to MM:SS or MM:SS.ms format
 */
export function formatTime(seconds: number, showMilliseconds = false): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (showMilliseconds) {
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Common playback speeds
 */
export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Cycle through playback speeds
 */
export function cyclePlaybackSpeed(
  currentSpeed: number,
  direction: 'up' | 'down' | number
): number {
  const currentIndex = PLAYBACK_SPEEDS.indexOf(currentSpeed);
  const delta = typeof direction === 'number' ? direction : (direction === 'up' ? 1 : -1);
  const newIndex = Math.max(0, Math.min(PLAYBACK_SPEEDS.length - 1, currentIndex + delta));
  return PLAYBACK_SPEEDS[newIndex];
}
