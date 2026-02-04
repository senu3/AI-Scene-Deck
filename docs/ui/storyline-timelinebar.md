# Storyline Controller & TimelineBar

This document summarizes the current responsibilities and integration points for the Storyline controller logic and the TimelineBar UI introduced in Phase 3.

## Storyline Controller

**Location**
- `src/hooks/useStorylineDragController.ts`
- `src/components/Storyline.tsx`

**Responsibilities**
- Handles drag-and-drop interactions for cuts and external file drops.
- Manages placeholder state for cross‑scene moves and external drops.
- Creates new cuts for external assets using `createCutFromImport`.
- Ensures selection changes are reflected in the Storyline view.

**Scroll Behavior**
- `Storyline` owns scene scrolling. It observes `selectedSceneId` and scrolls the matching scene into view.
- This avoids DOM querying from the Header layer.

**Key Data Flow**
- Selection state is sourced from `useStore()` (`selectedSceneId`, `selectScene`).
- `useStorylineDragController` receives `executeCommand` for undo/redo integration and `createCutFromImport` for import flows.

## TimelineBar

**Location**
- `src/components/TimelineBar.tsx`
- `src/components/TimelineBar.module.css`

**Purpose**
- Replaces `SceneChipBar` as the primary scene navigation in the Header.
- Shows per‑scene segments sized by scene duration.
- Clicking a segment selects the scene; Storyline handles scrolling.

**Props / API**
- `scenes: Scene[]`
- `selectedSceneId: string | null`
- `onSelectScene(sceneId: string)`

**Duration Rules**
- Scene duration = sum of `cut.displayTime` in that scene.
- If a scene has 0 duration, it still renders with minimum width (weight = 1).

**Styling Rules**
- Base surface uses tokens: `--panel-bg`, `--border-color`.
- Selected segment uses `rgba(var(--accent-primary-rgb), 0.6)`.
- Hover uses `--border-light` / `--panel-bg-strong`.

## Integration Points

- `Header` renders `TimelineBar` under the main header row.
  - `src/components/Header.tsx`
  - `src/components/Header.css`
- `SceneChipBar` was removed (`SceneChipBar.tsx`, `SceneChipBar.css`).

## Known Constraints

- Header must not use `document.querySelector` to scroll Storyline.
- TimelineBar does not own scroll behavior; it only emits selection events.
