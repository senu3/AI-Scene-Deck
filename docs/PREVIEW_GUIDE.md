# Preview Guide (Single vs Sequence)

This note captures how preview playback is structured and what must not be changed lightly.

## Modes
### Single Mode
- Activated when `PreviewModal` receives a single `asset` prop.
- Video: uses direct `<video>` rendering with per-element handlers.
- Image: uses the Sequence playback engine (`useSequencePlaybackController` + `createImageMediaSource`) even in Single Mode.
- Image display time resolves from metadata (`displayTime`) and falls back to `1.0s` (clamped to `>= 0.1s`).
- IN/OUT is stored in local component state (video) or controller range (image/sequence).
- Audio sync uses a dedicated `AudioManager`.
  - Video: starts from `video.currentTime` on play/pause changes.
  - Image: follows the sequence controller’s absolute time.

### Sequence Mode
- Activated when no single `asset` is provided.
- Builds `PreviewItem[]` from cuts, then drives playback through a controller.
- Uses `useSequencePlaybackController` to unify:
  - play/pause
  - seek (absolute/percent)
  - loop
  - range (IN/OUT)
  - buffering state
- Each cut creates a `MediaSource`:
  - Video: `createVideoMediaSource` (HTMLVideoElement wrapper).
  - Image: `createImageMediaSource` (synthetic clock).
- Cut changes are triggered by `onEnded` from the current `MediaSource`.

## Media Source Abstraction
`MediaSource` provides a common interface:
- `play()` / `pause()`
- `seek(localTimeSec)`
- `setRate(rate)`
- `getCurrentTime()`
- `dispose()`
- `element` (JSX to render)

Video sources queue play/seek until the element is mounted, avoiding the "cut boundary stop" issue.

## Audio Sync (Sequence Mode)
- Audio uses `AudioManager.play(absoluteTimeSec)`.
- Absolute time is derived from the controller’s `currentIndex + localProgress`.
- Audio managers are separate for Single and Sequence to prevent cross-mode races.

## Buffering / Preload
- Sequence preloads URLs in a time window (`PLAY_SAFE_AHEAD`, `PRELOAD_AHEAD`).
- Initial preload warms the first `INITIAL_PRELOAD_ITEMS`.
- Video URL cache is pruned as the playhead moves (keeps a small rewind window).
- Video URL cache is keyed by **assetId** to prevent mismatched URLs.

## Must NOT Do
- Do not control Sequence Mode playback by directly calling `<video>` methods.
  - Always route through `useSequencePlaybackController` + `MediaSource`.
- Do not special-case Single Mode images back to plain `<img>` timers.
  - Single image playback intentionally uses the Sequence engine.
- Do not remove the pending play/seek logic in `createVideoMediaSource`.
  - It prevents the "needs two clicks to play" regression.
- Do not reuse or keep old `MediaSource` instances.
  - Always dispose the previous source when switching cuts.
- Do not attach Sequence Mode audio to the video element's currentTime events.
  - Use absolute sequence time instead.
- Do not bypass the assetId check when binding video URLs.
  - A mismatched URL causes Range errors and skipped cuts.
- Do not switch Sequence Mode back to blob/base64 video URLs.
  - `media://` is required for streaming and memory safety.

## Related Files
- `src/components/PreviewModal.tsx`
- `src/utils/previewPlaybackController.ts`
- `src/utils/previewMedia.tsx`
- `MEDIA_HANDLING.md`
