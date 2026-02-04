import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { useToast } from '../ui';
import { ensureSceneIds, prepareScenesForSave } from '../utils/projectSave';
import { getAutoSaveEnabled, subscribeAutoSaveSettings } from '../utils/autosaveSettings';

interface AutoSaveTimers {
  debounce: ReturnType<typeof setTimeout> | null;
  maxWait: ReturnType<typeof setTimeout> | null;
}

const DEBOUNCE_MS = 1200;
const MAX_WAIT_MS = 8000;

export function useAutoSave() {
  const {
    projectLoaded,
    scenes,
    projectName,
    vaultPath,
    getSourcePanelState,
    loadProject,
  } = useStore();

  const sourcePanelSignature = useStore((state) => {
    const folders = state.sourceFolders.map((folder) => `${folder.path}::${folder.name}`).join('|');
    const expanded = Array.from(state.expandedFolders).sort().join('|');
    return `${folders}__${expanded}__${state.sourceViewMode}`;
  });

  const { toast } = useToast();
  const [autosaveEnabled, setAutosaveEnabledState] = useState(getAutoSaveEnabled());

  const timers = useRef<AutoSaveTimers>({ debounce: null, maxWait: null });
  const saving = useRef(false);
  const pending = useRef(false);
  const savePromise = useRef<Promise<void> | null>(null);
  const lastObservedScenes = useRef<typeof scenes | null>(null);
  const lastObservedProjectName = useRef<string | null>(null);
  const lastObservedSourcePanel = useRef<string | null>(null);
  const lastToastAt = useRef(0);

  const clearTimers = useCallback((current: AutoSaveTimers) => {
    if (current.debounce) clearTimeout(current.debounce);
    if (current.maxWait) clearTimeout(current.maxWait);
    current.debounce = null;
    current.maxWait = null;
  }, []);

  const performSave = useCallback(async () => {
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

  const runSave = useCallback(async () => {
    if (saving.current) {
      pending.current = true;
      return savePromise.current ?? Promise.resolve();
    }

    saving.current = true;
    const promise = (async () => {
      try {
        await performSave();
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
        saving.current = false;
        if (pending.current) {
          pending.current = false;
          await runSave();
        }
      }
    })();
    savePromise.current = promise;
    return promise;
  }, [performSave, toast]);

  const scheduleSave = useCallback(() => {
    if (!projectLoaded || !autosaveEnabled) return;

    if (!timers.current.maxWait) {
      timers.current.maxWait = setTimeout(() => {
        timers.current.maxWait = null;
        clearTimers(timers.current);
        void runSave();
      }, MAX_WAIT_MS);
    }

    if (timers.current.debounce) clearTimeout(timers.current.debounce);
    timers.current.debounce = setTimeout(() => {
      timers.current.debounce = null;
      clearTimers(timers.current);
      void runSave();
    }, DEBOUNCE_MS);
  }, [autosaveEnabled, clearTimers, projectLoaded, runSave]);

  useEffect(() => {
    const unsubscribe = subscribeAutoSaveSettings((enabled) => {
      setAutosaveEnabledState(enabled);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.setAutosaveEnabled) return;
    window.electronAPI.setAutosaveEnabled(autosaveEnabled).catch(() => {});
  }, [autosaveEnabled]);

  useEffect(() => {
    if (!projectLoaded || !autosaveEnabled) {
      lastObservedScenes.current = null;
      lastObservedProjectName.current = null;
      lastObservedSourcePanel.current = null;
      clearTimers(timers.current);
      return;
    }

    if (lastObservedScenes.current === null) {
      lastObservedScenes.current = scenes;
      lastObservedProjectName.current = projectName;
      lastObservedSourcePanel.current = sourcePanelSignature;
      return;
    }

    const scenesChanged = lastObservedScenes.current !== scenes;
    const nameChanged = lastObservedProjectName.current !== projectName;
    const sourcePanelChanged = lastObservedSourcePanel.current !== sourcePanelSignature;

    if (scenesChanged || nameChanged || sourcePanelChanged) {
      lastObservedScenes.current = scenes;
      lastObservedProjectName.current = projectName;
      lastObservedSourcePanel.current = sourcePanelSignature;
      scheduleSave();
    }
  }, [autosaveEnabled, clearTimers, projectLoaded, projectName, scenes, sourcePanelSignature, scheduleSave]);

  const flushAutoSave = useCallback(async () => {
    if (!autosaveEnabled) return;
    clearTimers(timers.current);
    await runSave();
  }, [autosaveEnabled, clearTimers, runSave]);

  return useMemo(() => ({
    flushAutoSave,
  }), [flushAutoSave]);
}
