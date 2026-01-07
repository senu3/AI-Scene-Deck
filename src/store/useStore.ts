import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Scene, Cut, Asset, FileItem, FavoriteFolder, PlaybackMode, PreviewMode } from '../types';

interface AppState {
  // Folder browser state
  rootFolder: { path: string; name: string; structure: FileItem[] } | null;
  expandedFolders: Set<string>;
  favorites: FavoriteFolder[];

  // Timeline state
  scenes: Scene[];
  selectedSceneId: string | null;
  selectedCutId: string | null;

  // Asset cache
  assetCache: Map<string, Asset>;

  // Playback state
  playbackMode: PlaybackMode;
  previewMode: PreviewMode;
  currentPreviewIndex: number;

  // Actions - Folder browser
  setRootFolder: (folder: { path: string; name: string; structure: FileItem[] } | null) => void;
  toggleFolderExpanded: (path: string) => void;
  addFavorite: (folder: FavoriteFolder) => void;
  removeFavorite: (path: string) => void;

  // Actions - Timeline
  addScene: () => void;
  removeScene: (sceneId: string) => void;
  renameScene: (sceneId: string, name: string) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;

  // Actions - Cuts
  addCutToScene: (sceneId: string, asset: Asset) => void;
  removeCut: (sceneId: string, cutId: string) => void;
  updateCutDisplayTime: (sceneId: string, cutId: string, time: number) => void;
  reorderCuts: (sceneId: string, fromIndex: number, toIndex: number) => void;
  moveCutBetweenScenes: (fromSceneId: string, toSceneId: string, cutId: string, toIndex: number) => void;

  // Actions - Selection
  selectScene: (sceneId: string | null) => void;
  selectCut: (cutId: string | null) => void;

  // Actions - Playback
  setPlaybackMode: (mode: PlaybackMode) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setCurrentPreviewIndex: (index: number) => void;

  // Actions - Asset cache
  cacheAsset: (asset: Asset) => void;
  getAsset: (assetId: string) => Asset | undefined;

  // Actions - Project
  clearProject: () => void;
  loadProject: (scenes: Scene[]) => void;
  getSelectedCut: () => { scene: Scene; cut: Cut } | null;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  rootFolder: null,
  expandedFolders: new Set(),
  favorites: [],
  scenes: [
    { id: uuidv4(), name: 'Scene 1', cuts: [], order: 0 },
    { id: uuidv4(), name: 'Scene 2', cuts: [], order: 1 },
    { id: uuidv4(), name: 'Scene 3', cuts: [], order: 2 },
  ],
  selectedSceneId: null,
  selectedCutId: null,
  assetCache: new Map(),
  playbackMode: 'stopped',
  previewMode: 'all',
  currentPreviewIndex: 0,

  // Folder browser actions
  setRootFolder: (folder) => set({ rootFolder: folder }),

  toggleFolderExpanded: (path) => set((state) => {
    const newExpanded = new Set(state.expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    return { expandedFolders: newExpanded };
  }),

  addFavorite: (folder) => set((state) => ({
    favorites: [...state.favorites, folder],
  })),

  removeFavorite: (path) => set((state) => ({
    favorites: state.favorites.filter((f) => f.path !== path),
  })),

  // Timeline actions
  addScene: () => set((state) => {
    const newOrder = state.scenes.length;
    return {
      scenes: [
        ...state.scenes,
        {
          id: uuidv4(),
          name: `Scene ${newOrder + 1}`,
          cuts: [],
          order: newOrder,
        },
      ],
    };
  }),

  removeScene: (sceneId) => set((state) => ({
    scenes: state.scenes
      .filter((s) => s.id !== sceneId)
      .map((s, idx) => ({ ...s, order: idx })),
    selectedSceneId: state.selectedSceneId === sceneId ? null : state.selectedSceneId,
  })),

  renameScene: (sceneId, name) => set((state) => ({
    scenes: state.scenes.map((s) =>
      s.id === sceneId ? { ...s, name } : s
    ),
  })),

  reorderScenes: (fromIndex, toIndex) => set((state) => {
    const newScenes = [...state.scenes];
    const [removed] = newScenes.splice(fromIndex, 1);
    newScenes.splice(toIndex, 0, removed);
    return {
      scenes: newScenes.map((s, idx) => ({ ...s, order: idx })),
    };
  }),

  // Cut actions
  addCutToScene: (sceneId, asset) => set((state) => {
    const scene = state.scenes.find((s) => s.id === sceneId);
    if (!scene) return state;

    const newCut: Cut = {
      id: uuidv4(),
      assetId: asset.id,
      asset,
      displayTime: 2.0,
      order: scene.cuts.length,
    };

    // Cache the asset
    const newCache = new Map(state.assetCache);
    newCache.set(asset.id, asset);

    return {
      scenes: state.scenes.map((s) =>
        s.id === sceneId
          ? { ...s, cuts: [...s.cuts, newCut] }
          : s
      ),
      assetCache: newCache,
    };
  }),

  removeCut: (sceneId, cutId) => set((state) => ({
    scenes: state.scenes.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            cuts: s.cuts
              .filter((c) => c.id !== cutId)
              .map((c, idx) => ({ ...c, order: idx })),
          }
        : s
    ),
    selectedCutId: state.selectedCutId === cutId ? null : state.selectedCutId,
  })),

  updateCutDisplayTime: (sceneId, cutId, time) => set((state) => ({
    scenes: state.scenes.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            cuts: s.cuts.map((c) =>
              c.id === cutId ? { ...c, displayTime: time } : c
            ),
          }
        : s
    ),
  })),

  reorderCuts: (sceneId, fromIndex, toIndex) => set((state) => {
    const scene = state.scenes.find((s) => s.id === sceneId);
    if (!scene) return state;

    const newCuts = [...scene.cuts];
    const [removed] = newCuts.splice(fromIndex, 1);
    newCuts.splice(toIndex, 0, removed);

    return {
      scenes: state.scenes.map((s) =>
        s.id === sceneId
          ? { ...s, cuts: newCuts.map((c, idx) => ({ ...c, order: idx })) }
          : s
      ),
    };
  }),

  moveCutBetweenScenes: (fromSceneId, toSceneId, cutId, toIndex) => set((state) => {
    const fromScene = state.scenes.find((s) => s.id === fromSceneId);
    if (!fromScene) return state;

    const cutToMove = fromScene.cuts.find((c) => c.id === cutId);
    if (!cutToMove) return state;

    return {
      scenes: state.scenes.map((s) => {
        if (s.id === fromSceneId) {
          return {
            ...s,
            cuts: s.cuts
              .filter((c) => c.id !== cutId)
              .map((c, idx) => ({ ...c, order: idx })),
          };
        }
        if (s.id === toSceneId) {
          const newCuts = [...s.cuts];
          newCuts.splice(toIndex, 0, cutToMove);
          return {
            ...s,
            cuts: newCuts.map((c, idx) => ({ ...c, order: idx })),
          };
        }
        return s;
      }),
    };
  }),

  // Selection actions
  selectScene: (sceneId) => set({ selectedSceneId: sceneId }),
  selectCut: (cutId) => set({ selectedCutId: cutId }),

  // Playback actions
  setPlaybackMode: (mode) => set({ playbackMode: mode }),
  setPreviewMode: (mode) => set({ previewMode: mode }),
  setCurrentPreviewIndex: (index) => set({ currentPreviewIndex: index }),

  // Asset cache actions
  cacheAsset: (asset) => set((state) => {
    const newCache = new Map(state.assetCache);
    newCache.set(asset.id, asset);
    return { assetCache: newCache };
  }),

  getAsset: (assetId) => get().assetCache.get(assetId),

  // Project actions
  clearProject: () => set({
    scenes: [
      { id: uuidv4(), name: 'Scene 1', cuts: [], order: 0 },
      { id: uuidv4(), name: 'Scene 2', cuts: [], order: 1 },
      { id: uuidv4(), name: 'Scene 3', cuts: [], order: 2 },
    ],
    selectedSceneId: null,
    selectedCutId: null,
  }),

  loadProject: (scenes) => set({ scenes }),

  getSelectedCut: () => {
    const state = get();
    if (!state.selectedCutId) return null;

    for (const scene of state.scenes) {
      const cut = scene.cuts.find((c) => c.id === state.selectedCutId);
      if (cut) {
        return { scene, cut };
      }
    }
    return null;
  },
}));
