# Vault / Asset Guide

This note defines the Vault and asset management rules that ensure recovery. Cut-related flows are included only where they automatically create or register assets.

## Core Goal (Recovery)
JSON + Vault must be enough to restore:
- Story order
- Cut durations
- Adopted assets (which files are used)

## Canonical Asset Rules
- **All assets live in `vault/assets/`** and are named by hash (e.g. `img_abc123.png`, `vid_abc123.mp4`).
- **`assets/.index.json` is the canonical index** and must always be updated.
- **`assetId -> filename` mapping** is always stored in `.index.json` (even for duplicates).
- **`originalPath` is vault-relative** (relative to vault root), not absolute.

## `.index.json` (Asset Index)
Each entry stores:
- `id` (assetId)
- `filename` (hash-based name)
- `originalName`
- `originalPath` (vault-relative path)
- `hash`, `type`, `fileSize`, `importedAt`
- **`usageRefs`**: scene/cut usage for recovery
  - `sceneId`, `sceneName`, `sceneOrder`
  - `cutId`, `cutOrder`, `cutIndex` (1-based)

## `.metadata.json` (Scene Metadata + Attachments)
Used for information that is not a core asset index:
- Asset attachments (audio, offsets, analysis)
- **Scene metadata**: name + notes
  - Preserves scene notes and labels even if project JSON is lost.

## `.trash/.trash.json` (Trash Log)
When assets are deleted or rehashed:
- The file is moved to `.trash/`
- A record is added to `.trash/.trash.json`:
  - `deletedAt`, `assetId`, `originalPath` (vault-relative), `trashRelativePath`
  - `originRefs` (scene/cut) and `reason`
  - Optional snapshot of the asset index entry
- **Retention**: items older than the retention period are purged.

## Asset Creation / Registration Paths
All paths must end with `.index.json` being updated **via VaultGateway**.

### 1) Cut Creation (Timeline / Drag & Drop)
- External file drop or sidebar asset add:
  - Import file into `vault/assets/` (hash name)
  - Read metadata + thumbnail
  - Create Cut with `assetId`
  - Update `.index.json` via VaultGateway

### 2) Attach Audio
- Attaching audio creates or registers an audio asset:
  - Audio file is imported into `vault/assets/`
  - `.metadata.json` stores attachment links and offset
  - `.index.json` stores the audio asset entry via VaultGateway

### 3) Video Capture (Frame Capture)
- Captured frames are saved into `vault/assets/`, then re-imported for hash naming.
 - The resulting asset is indexed via VaultGateway and a Cut is created below the source cut.

### 4) Clip Export (Finalize Clip)
- Exported clip is saved to `vault/assets/`, then re-imported for hash naming.
 - The resulting asset is indexed via VaultGateway and a Cut is created.

## VaultGateway (Single Write Entry)
**VaultGateway is the only writer for `.index.json` and `.trash/.trash.json`.**
Renderer code must call `window.electronAPI.vaultGateway.*` for:
- Import + register (hash naming + index update)
- Index save (ordering + usageRefs update)
- Trash move (trash file + trash index + index removal)

## Recovery Priority
1. `project.sdp` for story order and cuts
2. `.index.json` for assetId -> file mapping + usageRefs
3. `.metadata.json` for scene notes/labels and asset attachments
4. `.trash/.trash.json` for audit/history

## Related Files
- `src/types/index.ts`
- `src/components/Storyline.tsx`
- `src/components/CutCard.tsx`
- `src/components/AssetPanel.tsx`
- `src/components/DetailsPanel.tsx` (capture)
- `src/components/Header.tsx` (index ordering + usageRefs)
- `src/utils/assetPath.ts` (vault import rules)
- `src/utils/metadataStore.ts` (scene metadata)
- `electron/main.ts` (vault + trash index)
