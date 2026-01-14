// Utility functions for video metadata extraction

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}

/**
 * Convert a local file path to a media:// protocol URL for use in Electron
 * This works correctly on both Windows and Linux/Mac
 */
export function getMediaUrl(filePath: string): string {
  // Normalize path separators for Windows
  const normalizedPath = filePath.replace(/\\/g, '/');
  // Encode the path for URL safety
  return `media://${encodeURIComponent(normalizedPath)}`;
}

/**
 * Extract video metadata (duration, dimensions) by loading it in a video element
 */
export async function extractVideoMetadata(filePath: string): Promise<VideoMetadata | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      const metadata: VideoMetadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      };

      // Clean up
      video.src = '';
      URL.revokeObjectURL(video.src);

      resolve(metadata);
    };

    video.onerror = (e) => {
      console.error('Failed to load video metadata:', filePath);
      console.error('Video error event:', e);
      console.error('Video error code:', video.error?.code);
      console.error('Video error message:', video.error?.message);
      console.error('Video src:', video.src);
      resolve(null);
    };

    // Load the video file using custom media:// protocol
    const mediaSrc = getMediaUrl(filePath);
    console.log('Loading video metadata from:', mediaSrc);
    video.src = mediaSrc;
  });
}

/**
 * Generate a thumbnail for a video file
 */
export async function generateVideoThumbnail(filePath: string, timeOffset: number = 1): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';

    video.onloadedmetadata = () => {
      // Seek to the desired time
      video.currentTime = Math.min(timeOffset, video.duration * 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.8);

        // Clean up
        video.src = '';
        resolve(thumbnail);
      } catch (error) {
        console.error('Failed to generate thumbnail:', error);
        resolve(null);
      }
    };

    video.onerror = (e) => {
      console.error('Failed to load video for thumbnail:', filePath);
      console.error('Thumbnail error event:', e);
      console.error('Video error code:', video.error?.code);
      console.error('Video error message:', video.error?.message);
      resolve(null);
    };

    // Load the video file using custom media:// protocol
    const mediaSrc = getMediaUrl(filePath);
    console.log('Loading video for thumbnail from:', mediaSrc);
    video.src = mediaSrc;
  });
}
