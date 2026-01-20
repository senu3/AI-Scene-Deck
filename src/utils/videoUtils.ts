// Utility functions for video metadata extraction

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}

/**
 * Convert a local file path to a media:// protocol URL for use in Electron
 * This works correctly on both Windows and Linux/Mac
 * Note: This is used for images. For videos, use createVideoObjectUrl instead.
 */
export function getMediaUrl(filePath: string): string {
  // Normalize path separators to forward slashes
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Use encodeURI (NOT encodeURIComponent) to preserve path structure
  // encodeURIComponent breaks the URL by encoding colons and slashes
  return `media://${encodeURI(normalizedPath)}`;
}

/**
 * Create an Object URL for a video file
 * This is the recommended approach for video playback in Electron
 * because custom protocols don't handle Range requests properly
 */
export async function createVideoObjectUrl(filePath: string): Promise<string | null> {
  try {
    // Check if electronAPI is available
    if (!window.electronAPI) {
      console.error('electronAPI is not available');
      return null;
    }

    // Read file as base64 data URL via IPC
    const dataUrl = await window.electronAPI.readFileAsBase64(filePath);
    if (!dataUrl) {
      console.error('Failed to read video file:', filePath);
      return null;
    }

    // Convert data URL to Blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Create and return Object URL
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Failed to create video object URL:', error);
    return null;
  }
}

/**
 * Extract video metadata (duration, dimensions) by loading it in a video element
 */
export async function extractVideoMetadata(filePath: string): Promise<VideoMetadata | null> {
  // Create Object URL for video (required for proper playback in Electron)
  const objectUrl = await createVideoObjectUrl(filePath);
  if (!objectUrl) {
    return null;
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = objectUrl; // Set src immediately after creation to avoid Empty src error

    video.onloadedmetadata = () => {
      const metadata: VideoMetadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      };
      URL.revokeObjectURL(objectUrl);
      resolve(metadata);
    };

    video.onerror = () => {
      // Silently handle errors for metadata extraction
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
  });
}

/**
 * Generate a thumbnail for a video file
 */
export async function generateVideoThumbnail(filePath: string, timeOffset: number = 1): Promise<string | null> {
  // Create Object URL for video (required for proper playback in Electron)
  const objectUrl = await createVideoObjectUrl(filePath);
  if (!objectUrl) {
    return null;
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = objectUrl; // Set src immediately after creation to avoid Empty src error

    video.onloadedmetadata = () => {
      // Seek to the desired time (clamped to video duration)
      video.currentTime = Math.min(timeOffset, video.duration);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.8);

        URL.revokeObjectURL(objectUrl);
        resolve(thumbnail);
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      }
    };

    video.onerror = () => {
      // Silently handle errors for thumbnail generation
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
  });
}
