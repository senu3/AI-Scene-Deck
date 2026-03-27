import { v4 as uuidv4 } from 'uuid';
import type { Scene, Cut, Asset } from '../../types';
import { clearThumbnailCache } from '../../utils/thumbnailCache';
import { normalizeSceneOrder } from '../../utils/sceneOrder';
import { resolveCutAssetId } from '../../utils/assetResolve';
import { normalizeGroupsInScenes } from '../../utils/cutGroupOps';
import type { PersistedProjectSnapshot } from '../../features/project/persistedSnapshot';
import type { ProjectSliceContract } from '../contracts';
import type { SliceGet, SliceSet } from './sliceTypes';

function normalizeScenesUseEmbeddedAudio(scenes: Scene[]): Scene[] {
  // GATE6-EXCEPTION(normalize): load/init path structural normalization helper.
  const normalized = scenes.map((scene) => ({
    ...scene,
    cuts: scene.cuts.map((cut, index) => {
      const {
        isLoading: _isLoading,
        loadingName: _loadingName,
        ...rest
      } = cut as Cut & { isLoading?: boolean; loadingName?: string };
      return {
        ...rest,
        order: index,
        useEmbeddedAudio: cut.useEmbeddedAudio ?? true,
      };
    }),
  }));
  return normalizeGroupsInScenes(normalized);
}

function buildAssetCacheFromScenes(scenes: Scene[]): Map<string, Asset> {
  const cache = new Map<string, Asset>();
  for (const scene of scenes) {
    for (const cut of scene.cuts) {
      const snapshot = cut['asset'];
      if (!snapshot) continue;
      const lookupId = resolveCutAssetId(cut, () => undefined) || snapshot.id;
      if (!lookupId) continue;
      cache.set(lookupId, { ...snapshot, id: lookupId });
      if (snapshot.id && snapshot.id !== lookupId) {
        cache.set(snapshot.id, snapshot);
      }
    }
  }
  return cache;
}

export function createProjectSlice(set: SliceSet, get: SliceGet): ProjectSliceContract {
  return {
    setProjectLoaded: (loaded) => set({ projectLoaded: loaded }),
    setProjectPath: (path) => set({ projectPath: path }),
    setVaultPath: (path) => set({ vaultPath: path }),
    setTrashPath: (path) => set({ trashPath: path }),
    setProjectName: (name) => set({ projectName: name }),
    setLastPersistedSnapshot: (snapshot: PersistedProjectSnapshot | null) => set({ lastPersistedSnapshot: snapshot }),
    setTargetTotalDurationSec: (seconds) =>
      set({
        targetTotalDurationSec:
          Number.isFinite(seconds) && (seconds as number) > 0 ? Math.floor(seconds as number) : undefined,
      }),

    initializeProject: (project) => {
      clearThumbnailCache();
      const defaultScenes: Scene[] = [
        { id: uuidv4(), name: 'Scene 1', cuts: [], notes: [] },
        { id: uuidv4(), name: 'Scene 2', cuts: [], notes: [] },
        { id: uuidv4(), name: 'Scene 3', cuts: [], notes: [] },
      ];
      const nextScenes = normalizeScenesUseEmbeddedAudio(project.scenes || defaultScenes);
      const nextSceneOrder = normalizeSceneOrder(project.sceneOrder, nextScenes);
      const nextAssetCache = buildAssetCacheFromScenes(nextScenes);

      // GATE6-EXCEPTION(init)
      set({
        projectLoaded: true,
        projectPath: project.vaultPath ? `${project.vaultPath}/project.sdp` : null,
        vaultPath: project.vaultPath || null,
        trashPath: project.vaultPath ? `${project.vaultPath}/.trash` : null,
        projectName: project.name || 'Untitled Project',
        lastPersistedSnapshot: null,
        targetTotalDurationSec:
          Number.isFinite(project.targetTotalDurationSec) && (project.targetTotalDurationSec as number) > 0
            ? Math.floor(project.targetTotalDurationSec as number)
            : undefined,
        scenes: nextScenes,
        sceneOrder: nextSceneOrder,
        assetCache: nextAssetCache,
        cutRuntimeById: {},
        selectedSceneId: null,
        selectedCutId: null,
        selectedCutIds: new Set(),
        lastSelectedCutId: null,
        selectionType: null,
        detailsPanelOpen: false,
      });
    },

    clearProject: () => {
      clearThumbnailCache();
      // GATE6-EXCEPTION(init)
      set({
        projectLoaded: false,
        projectPath: null,
        vaultPath: null,
        trashPath: null,
        projectName: 'Untitled Project',
        lastPersistedSnapshot: null,
        targetTotalDurationSec: undefined,
        metadataStore: null,
        scenes: [],
        sceneOrder: [],
        selectedSceneId: null,
        selectedCutId: null,
        selectedCutIds: new Set(),
        cutRuntimeById: {},
        lastSelectedCutId: null,
        selectionType: null,
        sourceFolders: [],
        assetCache: new Map(),
        selectedGroupId: null,
        detailsPanelOpen: false,
      });
    },

    loadProject: (scenes, sceneOrder) => {
      const nextScenes = normalizeScenesUseEmbeddedAudio(scenes);
      // GATE6-EXCEPTION(load)
      set({
        scenes: nextScenes,
        sceneOrder: normalizeSceneOrder(sceneOrder, nextScenes),
        assetCache: buildAssetCacheFromScenes(nextScenes),
        cutRuntimeById: {},
      });
    },

    addSourceFolder: (folder) =>
      set((state) => {
        if (state.sourceFolders.some((f) => f.path === folder.path)) {
          return state;
        }
        return { sourceFolders: [...state.sourceFolders, folder] };
      }),

    removeSourceFolder: (path) =>
      set((state) => ({
        sourceFolders: state.sourceFolders.filter((f) => f.path !== path),
      })),

    updateSourceFolder: (path, structure) =>
      set((state) => ({
        sourceFolders: state.sourceFolders.map((f) => (f.path === path ? { ...f, structure } : f)),
      })),

    toggleFolderExpanded: (path) =>
      set((state) => {
        const newExpanded = new Set(state.expandedFolders);
        if (newExpanded.has(path)) {
          newExpanded.delete(path);
        } else {
          newExpanded.add(path);
        }
        return { expandedFolders: newExpanded };
      }),

    setExpandedFolders: (paths) => set({ expandedFolders: new Set(paths) }),

    addFavorite: (folder) =>
      set((state) => ({
        favorites: [...state.favorites, folder],
      })),

    removeFavorite: (path) =>
      set((state) => ({
        favorites: state.favorites.filter((f) => f.path !== path),
      })),

    setSourceViewMode: (mode) => set({ sourceViewMode: mode }),

    applySourcePanelState: (state) =>
      set({
        sourceFolders: state.folders.map((folder) => ({ ...folder, structure: [...folder.structure] })),
        expandedFolders: new Set(state.expandedPaths),
        sourceViewMode: state.viewMode || 'list',
      }),

    getSourcePanelState: () => {
      const state = get();
      return {
        folders: state.sourceFolders.map((f) => ({ path: f.path, name: f.name })),
        expandedPaths: Array.from(state.expandedFolders),
        viewMode: state.sourceViewMode,
      };
    },
  };
}
