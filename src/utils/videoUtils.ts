// Utility functions for video metadata extraction

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
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

    video.onerror = () => {
      console.error('Failed to load video metadata:', filePath);
      resolve(null);
    };

    // Load the video file using custom media protocol
    video.src = `media://${encodeURIComponent(filePath)}`;
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

    video.onerror = () => {
      console.error('Failed to load video for thumbnail:', filePath);
      resolve(null);
    };

    // Load the video file using custom media protocol
    video.src = `media://${encodeURIComponent(filePath)}`;
  });
}
