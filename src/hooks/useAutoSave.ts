import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store/useStore';
import { subscribeAutosave, type AutosaveRequest } from '../utils/autosaveBus';
import { useToast } from '../ui';
import { buildAssetUsageRefs, ensureSceneIds, getOrderedAssetIdsFromScenes, prepareScenesForSave } from '../utils/projectSave';

interface AutoSaveTimers {
  debounce: ReturnType<typeof setTimeout> | null;
  maxWait: ReturnType<typeof setTimeout> | null;
}

const FAST_DEBOUNCE_MS = 500;
const FAST_MAX_WAIT_MS = 4000;
const SLOW_DEBOUNCE_MS = 2500;
const SLOW_MAX_WAIT_MS = 20000;

export function useAutoSave() {
  const {
    projectLoaded,
    scenes,
    projectName,
    vaultPath,
    getSourcePanelState,
    loadProject,
  } = useStore();
  const { toast } = useToast();

  const fastTimers = useRef<AutoSaveTimers>({ debounce: null, maxWait: null });
  const slowTimers = useRef<AutoSaveTimers>({ debounce: null, maxWait: null });
  const fastSaving = useRef(false);
  const slowSaving = useRef(false);
  const fastPending = useRef(false);
  const slowPending = useRef(false);
  const fastPromise = useRef<Promise<void> | null>(null);
  const slowPromise = useRef<Promise<void> | null>(null);
  const lastObservedScenes = useRef<typeof scenes | null>(null);
  const lastToastAt = useRef(0);

  const clearTimers = useCallback((timers: AutoSaveTimers) => {
    if (timers.debounce) clearTimeout(timers.debounce);
    if (timers.maxWait) clearTimeout(timers.maxWait);
    timers.debounce = null;
    timers.maxWait = null;
  }, []);

  const performFastSave = useCallback(async () => {
    if (!projectLoaded || !vaultPath || !window.electronAPI) return;

    const { scenes: normalizedScenes, missingCount } = ensureSceneIds(scenes);
    if (missingCount > 0) {
      loadProject(normalizedScenes);
    }

    const sourcePanelState = getSourcePanelState();
    const scenesToSave = prepareScenesForSave(normalizedScenes);
    const projectData = JSON.stringify({
      version: 3,
      name: projectName,
      vaultPath: vaultPath,
      scenes: scenesToSave,
      sourcePanel: sourcePanelState,
      savedAt: new Date().toISOString(),
    });

    const result = await window.electronAPI.saveProject(projectData, `${vaultPath}/project.sdp`);
    if (!result) {
      throw new Error('Autosave failed');
    }
  }, [getSourcePanelState, loadProject, projectLoaded, projectName, scenes, vaultPath]);

  const performSlowSync = useCallback(async () => {
    if (!projectLoaded || !vaultPath || !window.electronAPI?.vaultGateway?.saveAssetIndex || !window.electronAPI.loadAssetIndex) {
      return;
    }

    try {
      const orderedIds = getOrderedAssetIdsFromScenes(scenes);
      const usageRefs = buildAssetUsageRefs(scenes);
      const index = await window.electronAPI.loadAssetIndex(vaultPath);
      const normalizedAssets = index.assets.map((entry) => ({
        ...entry,
        usageRefs: usageRefs.get(entry.id) || [],
      }));
      const remaining = normalizedAssets.filter((entry) => !orderedIds.includes(entry.id));
      const ordered = orderedIds
        .map((id) => normalizedAssets.find((entry) => entry.id === id))
        .filter((entry): entry is NonNullable<typeof entry> => !!entry);
      const newIndex = {
        ...index,
        assets: [...ordered, ...remaining],
      };
      await window.electronAPI.vaultGateway.saveAssetIndex(vaultPath, newIndex);
    } catch (error) {
      console.error('Failed to sync asset index:', error);
    }
  }, [projectLoaded, scenes, vaultPath]);

  const runFastSave = useCallback(async () => {
    if (fastSaving.current) {
      fastPending.current = true;
      return fastPromise.current ?? Promise.resolve();
    }

    fastSaving.current = true;
    const promise = (async () => {
      try {
        await performFastSave();
        const now = Date.now();
        if (now - lastToastAt.current > 15000) {
          toast.success('Autosaved');
          lastToastAt.current = now;
        }
      } catch (error) {
        const now = Date.now();
        if (now - lastToastAt.current > 15000) {
          toast.error('Autosave failed');
          lastToastAt.current = now;
        }
        console.error('Autosave failed:', error);
      } finally {
        fastSaving.current = false;
        if (fastPending.current) {
          fastPending.current = false;
          await runFastSave();
        }
      }
    })();
    fastPromise.current = promise;
    return promise;
  }, [performFastSave]);

  const runSlowSync = useCallback(async () => {
    if (slowSaving.current) {
      slowPending.current = true;
      return slowPromise.current ?? Promise.resolve();
    }

    slowSaving.current = true;
    const promise = (async () => {
      try {
        await performSlowSync();
      } finally {
        slowSaving.current = false;
        if (slowPending.current) {
          slowPending.current = false;
          await runSlowSync();
        }
      }
    })();
    slowPromise.current = promise;
    return promise;
  }, [performSlowSync]);

  const scheduleFastSave = useCallback((urgency: AutosaveRequest['urgency']) => {
    if (!projectLoaded) return;
    if (urgency === 'immediate') {
      clearTimers(fastTimers.current);
      void runFastSave();
      return;
    }

    if (!fastTimers.current.maxWait) {
      fastTimers.current.maxWait = setTimeout(() => {
        fastTimers.current.maxWait = null;
        clearTimers(fastTimers.current);
        void runFastSave();
      }, FAST_MAX_WAIT_MS);
    }

    if (fastTimers.current.debounce) clearTimeout(fastTimers.current.debounce);
    fastTimers.current.debounce = setTimeout(() => {
      fastTimers.current.debounce = null;
      clearTimers(fastTimers.current);
      void runFastSave();
    }, FAST_DEBOUNCE_MS);
  }, [clearTimers, projectLoaded, runFastSave]);

  const scheduleSlowSync = useCallback((urgency: AutosaveRequest['urgency']) => {
    if (!projectLoaded) return;
    if (urgency === 'immediate') {
      clearTimers(slowTimers.current);
      void runSlowSync();
      return;
    }

    if (!slowTimers.current.maxWait) {
      slowTimers.current.maxWait = setTimeout(() => {
        slowTimers.current.maxWait = null;
        clearTimers(slowTimers.current);
        void runSlowSync();
      }, SLOW_MAX_WAIT_MS);
    }

    if (slowTimers.current.debounce) clearTimeout(slowTimers.current.debounce);
    slowTimers.current.debounce = setTimeout(() => {
      slowTimers.current.debounce = null;
      clearTimers(slowTimers.current);
      void runSlowSync();
    }, SLOW_DEBOUNCE_MS);
  }, [clearTimers, projectLoaded, runSlowSync]);

  const handleAutosaveRequest = useCallback((request: AutosaveRequest) => {
    if (request.type === 'fast') {
      scheduleFastSave(request.urgency);
    } else {
      scheduleSlowSync(request.urgency);
    }
  }, [scheduleFastSave, scheduleSlowSync]);

  useEffect(() => {
    const unsubscribe = subscribeAutosave(handleAutosaveRequest);
    return () => unsubscribe();
  }, [handleAutosaveRequest]);

  useEffect(() => {
    if (!projectLoaded) {
      lastObservedScenes.current = null;
      return;
    }

    if (lastObservedScenes.current === null) {
      lastObservedScenes.current = scenes;
      return;
    }

    lastObservedScenes.current = scenes;
    scheduleFastSave('debounced');
    scheduleSlowSync('debounced');
  }, [projectLoaded, projectName, scenes, scheduleFastSave, scheduleSlowSync]);

  const flushAutoSave = useCallback(async () => {
    clearTimers(fastTimers.current);
    clearTimers(slowTimers.current);
    await runFastSave();
    await runSlowSync();
  }, [clearTimers, runFastSave, runSlowSync]);

  return useMemo(() => ({
    flushAutoSave,
  }), [flushAutoSave]);
}
