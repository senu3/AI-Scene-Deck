import { describe, expect, it, vi } from 'vitest';
import {
  createAutosaveController,
  isProjectDirty,
  pickProjectStateForSave,
} from '../autosave';

function baseState() {
  return {
    projectName: 'Test',
    vaultPath: 'C:/vault',
    scenes: [{ id: 's1', name: 'Scene 1', cuts: [], order: 0, notes: [] }],
    sourcePanelState: { folders: [], expandedPaths: [], viewMode: 'list' },
    uiOnly: { selectedSceneId: 's1', sidebarOpen: true },
  } as any;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('autosave selector', () => {
  it('ignores UI-only changes for dirty detection', () => {
    const stateA = baseState();
    const stateB = { ...stateA, uiOnly: { selectedSceneId: 's2', sidebarOpen: false } };

    const snapA = pickProjectStateForSave(stateA);
    const snapB = pickProjectStateForSave(stateB);

    expect(isProjectDirty(snapA, snapB)).toBe(false);
  });

  it('detects project changes as dirty', () => {
    const stateA = baseState();
    const stateB = {
      ...stateA,
      scenes: [{ ...stateA.scenes[0], name: 'Renamed' }],
    };

    const snapA = pickProjectStateForSave(stateA);
    const snapB = pickProjectStateForSave(stateB);

    expect(isProjectDirty(snapA, snapB)).toBe(true);
  });
});

describe('autosave controller', () => {
  it('debounces multiple schedule calls', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => {});
    const controller = createAutosaveController({ debounceMs: 200, save });

    controller.schedule();
    controller.schedule();
    controller.schedule();

    expect(save).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(199);
    expect(save).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    await flushPromises();

    expect(save).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('suppresses re-entrant saves and runs once more after in-flight', async () => {
    vi.useFakeTimers();
    let resolveSave: (() => void) | null = null;
    const save = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
    const controller = createAutosaveController({ debounceMs: 10, save });

    controller.schedule();
    vi.advanceTimersByTime(10);
    await flushPromises();
    expect(save).toHaveBeenCalledTimes(1);

    controller.schedule();
    controller.schedule();

    resolveSave?.();
    await flushPromises();
    await flushPromises();

    expect(save).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('swallows save errors and notifies once', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => { throw new Error('fail'); });
    const onError = vi.fn();
    const controller = createAutosaveController({ debounceMs: 1, save, onError });

    controller.schedule();
    vi.advanceTimersByTime(1);
    await flushPromises();

    controller.schedule();
    vi.advanceTimersByTime(1);
    await flushPromises();

    expect(onError).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
