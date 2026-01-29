import type { RefObject } from 'react';

export type MediaSourceKind = 'video' | 'image';

export interface MediaSource {
  kind: MediaSourceKind;
  element: JSX.Element;
  play(): void;
  pause(): void;
  seek(localTimeSec: number): void;
  setRate(rate: number): void;
  getCurrentTime(): number;
  dispose(): void;
}

interface BaseMediaSourceOptions {
  className: string;
  onTimeUpdate?: (localTimeSec: number) => void;
  onEnded?: () => void;
}

interface VideoMediaSourceOptions extends BaseMediaSourceOptions {
  src: string;
  muted: boolean;
  refObject?: RefObject<HTMLVideoElement>;
  key?: string;
  inPoint?: number;
  outPoint?: number;
}

interface ImageMediaSourceOptions extends BaseMediaSourceOptions {
  src: string;
  alt: string;
  duration: number;
}

class PreviewClock {
  private duration: number;
  private currentTimeSec: number;
  private rate: number;
  private isPlaying: boolean;
  private intervalId: number | null;
  private lastTickMs: number;
  private onTimeUpdate?: (t: number) => void;
  private onEnded?: () => void;

  constructor(duration: number, onTimeUpdate?: (t: number) => void, onEnded?: () => void) {
    this.duration = Math.max(0, duration);
    this.currentTimeSec = 0;
    this.rate = 1;
    this.isPlaying = false;
    this.intervalId = null;
    this.lastTickMs = 0;
    this.onTimeUpdate = onTimeUpdate;
    this.onEnded = onEnded;
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTickMs = Date.now();
    this.intervalId = window.setInterval(this.tick, 50);
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  seek(timeSec: number) {
    const clamped = Math.max(0, Math.min(this.duration, timeSec));
    this.currentTimeSec = clamped;
    this.onTimeUpdate?.(this.currentTimeSec);
  }

  setRate(rate: number) {
    this.rate = rate;
  }

  getCurrentTime() {
    return this.currentTimeSec;
  }

  dispose() {
    this.pause();
  }

  private tick = () => {
    if (!this.isPlaying) return;

    const nowMs = Date.now();
    const deltaSec = ((nowMs - this.lastTickMs) / 1000) * this.rate;
    this.lastTickMs = nowMs;
    this.currentTimeSec = Math.min(this.duration, this.currentTimeSec + deltaSec);
    this.onTimeUpdate?.(this.currentTimeSec);

    if (this.currentTimeSec >= this.duration) {
      this.isPlaying = false;
      this.onEnded?.();
      return;
    }

  };
}

export function createVideoMediaSource(options: VideoMediaSourceOptions): MediaSource {
  let videoEl: HTMLVideoElement | null = null;

  const setVideoEl = (el: HTMLVideoElement | null) => {
    videoEl = el;
    if (options.refObject) {
      options.refObject.current = el;
    }
  };

  const getLocalTime = () => {
    if (!videoEl) return 0;
    const inPoint = options.inPoint ?? 0;
    return Math.max(0, videoEl.currentTime - inPoint);
  };

  const handleTimeUpdate = () => {
    if (!videoEl) return;
    const inPoint = options.inPoint ?? 0;
    const outPoint = options.outPoint;
    const localTime = Math.max(0, videoEl.currentTime - inPoint);
    options.onTimeUpdate?.(localTime);

    if (typeof outPoint === 'number' && videoEl.currentTime >= outPoint - 0.001) {
      options.onEnded?.();
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoEl) return;
    const inPoint = options.inPoint ?? 0;
    if (inPoint > 0) {
      videoEl.currentTime = inPoint;
    }
  };

  const handleEnded = () => {
    options.onEnded?.();
  };

  return {
    kind: 'video',
    element: (
      <video
        ref={setVideoEl}
        key={options.key ?? options.src}
        src={options.src}
        className={options.className}
        muted={options.muted}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
    ),
    play() {
      videoEl?.play().catch(() => {});
    },
    pause() {
      videoEl?.pause();
    },
    seek(localTimeSec: number) {
      if (!videoEl) return;
      const inPoint = options.inPoint ?? 0;
      const outPoint = options.outPoint ?? videoEl.duration;
      const target = inPoint + localTimeSec;
      videoEl.currentTime = Math.max(inPoint, Math.min(outPoint, target));
    },
    setRate(rate: number) {
      if (videoEl) {
        videoEl.playbackRate = rate;
      }
    },
    getCurrentTime() {
      return getLocalTime();
    },
    dispose() {
      // No-op: React owns the element lifecycle.
    },
  };
}

export function createImageMediaSource(options: ImageMediaSourceOptions): MediaSource {
  const clock = new PreviewClock(options.duration, options.onTimeUpdate, options.onEnded);

  return {
    kind: 'image',
    element: (
      <img
        src={options.src}
        alt={options.alt}
        className={options.className}
      />
    ),
    play() {
      clock.play();
    },
    pause() {
      clock.pause();
    },
    seek(localTimeSec: number) {
      clock.seek(localTimeSec);
    },
    setRate(rate: number) {
      clock.setRate(rate);
    },
    getCurrentTime() {
      return clock.getCurrentTime();
    },
    dispose() {
      clock.dispose();
    },
  };
}
