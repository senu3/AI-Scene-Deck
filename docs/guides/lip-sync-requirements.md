# Simple Lip Sync (RMS-Based) Requirements

**目的**: Simple lip sync の要件と制約を整理する。
**適用範囲**: RMS解析・PreviewModal・LipSyncModal。
**関連ファイル**: `src/components/LipSyncModal.tsx`, `src/utils/audioUtils.ts`, `src/utils/metadataStore.ts`。
**更新頻度**: 低。

> 仮: 実装は未確定。変更があれば更新。

This document summarizes the planned simple lip sync feature discussed for AI-Scene-Deck. It captures intent, constraints, and implementation direction (no code).

## Goal
Implement a lightweight lip-sync system that switches video frames based on RMS analysis. The intent is not full animation editing, only offset adjustment and playback preview.

## Definition: Simple Lip Sync
- RMS analysis drives frame switching.
- The source is still images (even if the original was a video).
- Result is a cut card used for lip-sync preview playback.

## Inputs & Sources
- RMS analysis is precomputed (short loop playback is sufficient).
- RMS data comes from metadata.
- Use the metadataStore.
- See `docs/references/DOMAIN.md` for where RMS analysis is stored and how metadata is keyed.
- Simple lip-sync is registered from images.
- If the source is a video, extract specific frames and use them as images.
- The feature’s prototype exists at `C:\LipSyncMaker`.

## Output / Data Model
After registration:
- A lip-sync cut card is created.
- It references a base image and RMS-linked alternate images.
- The lip-sync card behaves like a normal asset-backed cut in preview.

## Playback / Preview Requirements
- Short loop playback is enough (RMS is already analyzed).
- Works in Sequence Mode as well as Single Mode.
- RMS-driven image switching occurs during preview playback.
- At preview time, either switch images directly or use a pre-rendered video cache as a substitute (optional).

## Rendering Strategy (Decision Context)
Two possible approaches:
- Canvas/WebGL-based preview.
- Image-based preview foundation.

Given the lightweight requirements, a non-WebGL image-based preview is acceptable unless later features require GPU effects or full render parity.

## Integration Constraints
- RMS data must be read from metadataStore.
- Lip-sync uses image assets tied to the cut/card, even if the original was video.
- Preview remains part of the existing PreviewModal flow.
- Feature must work in Sequence Mode without breaking standard playback.

## Audio
- Audio is already managed by AudioManager and tied to sequence time.
- The lip-sync feature should not change core audio playback behavior.

## Do Not List
- Do not introduce a full editor or complex image manipulation pipeline.
- Do not bypass metadataStore for RMS access.
- Do not change existing sequence playback architecture unless required.
- Do not couple lip-sync images directly to raw video playback.

## Implementation Sketch (High-Level)
1. Registration
- Select source image(s) (video → frame extraction if needed).
- Bind image set to an asset/cut for lip-sync.
2. Metadata
- Store RMS analysis reference in metadataStore.
- Store lip-sync image mapping in the same metadata entry or a linked structure.
3. Preview
- When RMS playback is active, map RMS bins to image variants.
- Switch images during preview based on RMS values.
4. Sequence Mode
- Ensure the above works during multi-cut playback.
- RMS switching should be internal to a cut’s preview rendering.

## Open Items / Future Decisions
- Whether to cache a pre-rendered video for performance (optional).
- RMS binning rules (thresholds / number of frames).
