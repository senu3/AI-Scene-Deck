import { spawn } from 'child_process';

export type FfmpegTask<T> = () => Promise<T>;

export interface FfmpegQueueStats {
  running: number;
  queued: number;
}

export interface FfmpegController {
  enqueueLight<T>(task: FfmpegTask<T>): Promise<T>;
  getLightQueueStats(): FfmpegQueueStats;
  runLight(
    args: string[],
    options?: {
      stderrMaxBytes?: number;
    }
  ): Promise<{ code: number | null; stderr: string }>;
}

function createFfmpegQueue(concurrency: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  const pump = () => {
    while (running < concurrency && queue.length > 0) {
      const job = queue.shift();
      if (job) job();
    }
  };

  const enqueue = <T>(task: FfmpegTask<T>): Promise<T> => new Promise((resolve, reject) => {
    const run = () => {
      running += 1;
      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          running -= 1;
          pump();
        });
    };
    queue.push(run);
    pump();
  });

  return {
    enqueue,
    stats: () => ({ running, queued: queue.length }),
  };
}

function appendStderr(buffer: Buffer<ArrayBufferLike>, chunk: Buffer<ArrayBufferLike>, maxBytes: number): Buffer<ArrayBufferLike> {
  if (maxBytes <= 0) return buffer;
  if (buffer.length === 0) {
    return chunk.length > maxBytes ? chunk.slice(chunk.length - maxBytes) : Buffer.from(chunk);
  }
  const combined = Buffer.concat([buffer, chunk], buffer.length + chunk.length);
  return combined.length > maxBytes ? combined.slice(combined.length - maxBytes) : combined;
}

export function createFfmpegController(ffmpegBinary: string): FfmpegController {
  const lightQueue = createFfmpegQueue(2);

  const runLight = async (
    args: string[],
    options?: {
      stderrMaxBytes?: number;
    }
  ): Promise<{ code: number | null; stderr: string }> => {
    const stderrMaxBytes = Math.max(1024, options?.stderrMaxBytes ?? 128 * 1024);
    return lightQueue.enqueue(() => new Promise((resolve) => {
      const proc = spawn(ffmpegBinary, args);
      let stderrBuffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);

      proc.stderr.on('data', (data: Buffer<ArrayBufferLike>) => {
        stderrBuffer = appendStderr(stderrBuffer, data, stderrMaxBytes);
      });

      proc.on('close', (code: number | null) => {
        resolve({ code, stderr: stderrBuffer.toString() });
      });

      proc.on('error', (error: Error) => {
        resolve({ code: -1, stderr: `Failed to start ffmpeg: ${error.message}` });
      });
    }));
  };

  return {
    enqueueLight: lightQueue.enqueue,
    getLightQueueStats: lightQueue.stats,
    runLight,
  };
}
