# Autosave & Snapshots

This document describes the autosave system and the snapshot-based revert behavior.

## Autosave Overview

Autosave is split into two tiers:

- **Fast save**: writes `project.sdp` (project JSON).
- **Slow sync**: rebuilds `assets/.index.json` `usageRefs` and orders assets based on timeline order.

Both are managed by a single queue per tier to avoid parallel writes.

## Timings

Defined in `src/hooks/useAutoSave.ts`:

- Fast save: debounce `500ms`, max wait `4s`
- Slow sync: debounce `2.5s`, max wait `20s`

These can be adjusted as needed in that file.

## Trigger Rules

Autosave requests are published via `requestAutosave` in `src/utils/autosaveBus.ts` and scheduled by `useAutoSave`.

Examples of immediate triggers (fast save):
- Scene add/remove/rename/reorder
- Cut add/remove/move/reorder
- Clip in/out updates
- Group changes (create/delete/rename/reorder)

Examples of debounced triggers (fast save):
- Scene notes edits
- Source panel changes (expanded folders, view mode)
- Cut display time changes

Slow sync generally follows structural changes (cuts/scenes/groups) and is debounced to reduce cost.

## Toast Notifications

On successful autosave, a Toast is shown (with a 15s cooldown).
On failure, an error Toast is shown (also with cooldown).
Implementation: `src/hooks/useAutoSave.ts`

## Flush on App Close

When the window is closing, the main process sends a flush request and waits (up to 5s) for renderer completion.

- IPC request: `autosave-flush-request`
- IPC response: `autosave-flush-complete`

Implementation:
- `electron/main.ts` (close interception)
- `electron/preload.ts` (IPC bridge)
- `src/App.tsx` (renderer flush handler)

## Snapshot Foundation (Revert)

Snapshots are stored in a dedicated store:
`src/store/snapshotStore.ts`

Currently supported slots:
- `manual-save`: updated only when the user performs a manual save
- `initial-load`: set when a project is first loaded or created

Snapshots capture **scenes only** (project name/source panel are not reverted).
This is intentional per current requirements.

## Revert Behavior

Revert restores scenes from a snapshot, clears history, syncs metadata, then triggers:
- Fast save (immediate)
- Slow sync (immediate) to rebuild `usageRefs` from the restored project JSON

UI handlers in:
- `src/components/Header.tsx`

## Key Files

- `src/hooks/useAutoSave.ts`
- `src/utils/autosaveBus.ts`
- `src/utils/projectSave.ts`
- `src/store/snapshotStore.ts`
- `src/components/Header.tsx`
- `src/components/StartupModal.tsx`
