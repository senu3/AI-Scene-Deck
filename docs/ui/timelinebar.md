# Storyline Controller & TimelineBar

**目的**: StorylineのD&D制御とTimelineBarの役割を整理する。
**適用範囲**: `Storyline` / `useStorylineDragController` / `TimelineBar`。
**関連ファイル**: `src/components/Storyline.tsx`, `src/hooks/useStorylineDragController.ts`, `src/components/TimelineBar.tsx`。
**更新頻度**: 中。

> TODO: UI設計が固まったら表現の調整が必要。

## Storyline Controller

**Location**
- `src/hooks/useStorylineDragController.ts`
- `src/components/Storyline.tsx`

**Responsibilities**
- Handles drag-and-drop interactions for cuts and external file drops.
- Manages placeholder state for cross-scene moves and external drops.
- Creates new cuts for external assets using `createCutFromImport`.
- Ensures selection changes are reflected in the Storyline view.
- `Storyline` is the primary inbound drop handler for scene-targeted drops.
- `App` keeps a workspace-level fallback drop handler for drops outside scene columns (imports to selected/first scene).

**Scroll Behavior**
- `Storyline` owns scene scrolling. It observes `selectedSceneId` and scrolls the matching scene into view.
- This avoids DOM querying from the Header layer.

**Key Data Flow**
- Selection state is sourced from `useStore()` (`selectedSceneId`, `selectScene`).
- `useStorylineDragController` receives `executeCommand` for undo/redo integration and `createCutFromImport` for import flows.
- `createCutFromImport` no longer refreshes all source folders per item; caller-side bulk flows should refresh explicitly only when needed.

## TimelineBar

**Location**
- `src/components/TimelineBar.tsx`
- `src/components/TimelineBar.module.css`

**Purpose**
- Replaces `SceneChipBar` as the primary scene navigation in the Header.
- Shows per-scene segments sized by scene duration.
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
- Segment colors use `--timeline-scene-*` tokens (see `docs/ui/color-system.md` → Timeline Scene Colors).

## Header Stats

The Header displays project statistics alongside the action buttons.

**Location**
- `src/components/Header.tsx` (`.header-stats` section)
- `src/components/Header.css`

**Stats**
| Stat | Icon | Description |
|------|------|-------------|
| Scenes | `Layers` | `scenes.length` |
| Cuts | `Film` | Total cuts across all scenes |
| Time | `Clock` | Selected cut position / total duration |

**Time Display Rules**
- Current position: cyan (`--accent-primary`), monospace, bold — shows timeline start time of the selected cut.
- Total duration: secondary text (`--text-secondary`), monospace.
- When no cut is selected: current position shows `--`.
- Format uses `formatTimeCode()` from `useTimelinePosition`.

**Header Background**
- Uses depth gradient: `linear-gradient(180deg, var(--bg-depth-1), var(--bg-depth-2))`.

## Integration Points
- `Header` renders `TimelineBar` under the main header row.
- `SceneChipBar` was removed.

## Known Constraints
- Header must not use `document.querySelector` to scroll Storyline.
- TimelineBar does not own scroll behavior; it only emits selection events.
