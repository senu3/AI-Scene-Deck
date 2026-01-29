# Media Handling Overview

This note summarizes how video and audio are handled in the app (current implementation).

## Video
- **Playback**
  - Video elements use `media://` protocol URLs (streamed with Range support).
  - Avoids base64/Blob loading of full files into memory.
  - Sequence preview uses a MediaSource abstraction (`createVideoMediaSource`) instead of direct `<video>` control.
  - The media protocol tolerates invalid Range requests by returning a minimal response (prevents noisy 416 logs).
- **Metadata**
  - Video metadata (duration/width/height) is read in the main process via ffmpeg (`get-video-metadata` IPC).
  - Renderer falls back to shared `<video>` element if needed.
- **Thumbnails**
  - Generated in the main process via ffmpeg (`generate-video-thumbnail` IPC).
  - Returned to renderer as small JPEG base64 data URLs.
  - Renderer falls back to shared `<video>` + canvas if needed.
- **Caching**
  - Preview caches video URLs by **assetId** and releases old entries as the preview window moves.
  - Sequence buffer checks use a "play safe ahead" window to avoid cut-boundary stalls.

## Preview Playback (Single vs Sequence)
- **Single Mode**
  - Uses the `<video>`/`<img>` elements directly with per-mode handlers.
  - IN/OUT is stored in local component state.
- **Sequence Mode**
  - Uses `useSequencePlaybackController` (reducer-driven) to unify play/pause/seek/loop/range.
  - Media sources are created per cut (`createVideoMediaSource` / `createImageMediaSource`).
  - Image cuts are driven by a synthetic clock (setInterval) to match video-like playback.
  - Audio playback is aligned by absolute sequence time.

## Audio
- **Decode/Playback**
  - Audio is decoded in the main process via ffmpeg to **PCM s16le** (`read-audio-pcm` IPC).
  - Renderer builds `AudioBuffer` directly from PCM (no `decodeAudioData`).
  - Single and Sequence preview use **separate AudioManager instances**.
- **Offsets**
  - Per-asset offset is stored in metadata and applied during playback.
- **RMS Analysis**
  - RMS is computed from PCM at **60 fps** and stored in metadata (JSON array).
  - Stored under the **audio asset's** metadata entry for reuse.

## Metadata Store
- Stored in `.metadata.json` at vault root.
- Keyed by **assetId** (audio analysis is attached to the audio asset).

## ffmpeg Work Queue
- **Light queue** (concurrency 2): metadata, thumbnail, PCM decode.
- **Heavy queue** (concurrency 1): export/clip/frame operations.
