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
