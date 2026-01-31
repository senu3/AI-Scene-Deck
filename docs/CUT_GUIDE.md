# Cut Guide

This note captures the core rules and lightweight spec for Cuts.

## Cut First Principles
When adding a Cut:
1. **Copy or create the real media file into the vault `assets/` folder.**
2. **Read metadata** for the new asset (resolution, duration, file size, etc.).
3. **Create the CutCard** from the metadata and thumbnail.

This ensures Cuts are always backed by a vault asset and remain portable across projects.

## Cut Summary (Specification)
- **Data model:** `Cut` references an `Asset` via `assetId` and may cache an `asset` object.
- **Ordering:** `order` is the display order within a Scene; timeline rendering is derived from it.
- **Display time:** `displayTime` is the base duration (images use this directly; videos may override with clip ranges).
- **Clip range (video only):**
  - `inPoint` / `outPoint` define a non-destructive range.
  - `isClip` indicates a trimmed segment is active.
- **Loading states:** `isLoading` and `loadingName` are used while assets are importing.
- **Lip sync:** `isLipSync` and `lipSyncFrameCount` indicate lip-sync cuts and their registered frames.

## Related Files
- `src/types/index.ts`
- `src/components/CutCard.tsx`
- `src/components/Storyline.tsx`
- `src/components/PreviewModal.tsx`
