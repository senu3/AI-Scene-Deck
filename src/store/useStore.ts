import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Scene, Cut, Asset, FileItem, FavoriteFolder, PlaybackMode, PreviewMode, SceneNote, SelectionType, Project } from '../types';

export interface SourceFolder {
  path: string;
  name: string;
  structure: FileItem[];
}

interface AppState {
  // Project state
  projectLoaded: boolean;
  projectPath: string | null;
  vaultPath: string | null;
  trashPath: string | null;
  projectName: string;

  // Folder browser state - now supports multiple source folders
  sourceFolders: SourceFolder[];
  rootFolder: { path: string; name: string; structure: FileItem[] } | null; // Legacy, kept for compatibility
  expandedFolders: Set<string>;
  favorites: FavoriteFolder[];

  // Timeline state
  scenes: Scene[];
  selectedSceneId: string | null;
  selectedCutId: string | null;
  selectionType: SelectionType;

  // Asset cache
  assetCache: Map<string, Asset>;

  // Playback state
  playbackMode: PlaybackMode;
  previewMode: PreviewMode;
  currentPreviewIndex: number;

  // Actions - Project
  setProjectLoaded: (loaded: boolean) => void;
  setProjectPath: (path: string | null) => void;
  setVaultPath: (path: string | null) => void;
  setTrashPath: (path: string | null) => void;
  setProjectName: (name: string) => void;
  initializeProject: (project: Partial<Project>) => void;
  clearProject: () => void;
  loadProject: (scenes: Scene[]) => void;

  // Actions - Folder browser
  setRootFolder: (folder: { path: string; name: string; structure: FileItem[] } | null) => void;
  addSourceFolder: (folder: SourceFolder) => void;
  removeSourceFolder: (path: string) => void;
  updateSourceFolder: (path: string, structure: FileItem[]) => void;
  toggleFolderExpanded: (path: string) => void;
  addFavorite: (folder: FavoriteFolder) => void;
  removeFavorite: (path: string) => void;

  // Actions - Timeline
  addScene: (name?: string) => string;
  removeScene: (sceneId: string) => void;
  renameScene: (sceneId: string, name: string) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  updateSceneFolderPath: (sceneId: string, folderPath: string) => void;

  // Actions - Scene Notes
  addSceneNote: (sceneId: string, note: Omit<SceneNote, 'id' | 'createdAt'>) => void;
  updateSceneNote: (sceneId: string, noteId: string, content: string) => void;
  removeSceneNote: (sceneId: string, noteId: string) => void;

  // Actions - Cuts
  addCutToScene: (sceneId: string, asset: Asset) => string; // Returns cutId
  removeCut: (sceneId: string, cutId: string) => Cut | null;
  updateCutDisplayTime: (sceneId: string, cutId: string, time: number) => void;
  reorderCuts: (sceneId: string, cutId: string, newIndex: number, fromSceneId: string, oldIndex: number) => void;
  moveCutToScene: (fromSceneId: string, toSceneId: string, cutId: string, toIndex: number) => void;

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

  // Helpers
  getSelectedCut: () => { scene: Scene; cut: Cut } | null;
  getSelectedScene: () => Scene | null;
  getProjectData: () => Project;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  projectLoaded: false,
  projectPath: null,
  vaultPath: null,
  trashPath: null,
  projectName: 'Untitled Project',

  sourceFolders: [],
  rootFolder: null,
  expandedFolders: new Set(),
  favorites: [],
  scenes: [],
  selectedSceneId: null,
  selectedCutId: null,
  selectionType: null,
  assetCache: new Map(),
  playbackMode: 'stopped',
  previewMode: 'all',
  currentPreviewIndex: 0,

  // Project actions
  setProjectLoaded: (loaded) => set({ projectLoaded: loaded }),
  setProjectPath: (path) => set({ projectPath: path }),
  setVaultPath: (path) => set({ vaultPath: path }),
  setTrashPath: (path) => set({ trashPath: path }),
  setProjectName: (name) => set({ projectName: name }),

  initializeProject: (project) => {
    const defaultScenes: Scene[] = [
      { id: uuidv4(), name: 'Scene 1', cuts: [], order: 0, notes: [] },
      { id: uuidv4(), name: 'Scene 2', cuts: [], order: 1, notes: [] },
      { id: uuidv4(), name: 'Scene 3', cuts: [], order: 2, notes: [] },
    ];

    set({
      projectLoaded: true,
      projectPath: project.vaultPath ? `${project.vaultPath}/project.sdp` : null,
      vaultPath: project.vaultPath || null,
      trashPath: project.vaultPath ? `${project.vaultPath}/.trash` : null,
      projectName: project.name || 'Untitled Project',
      scenes: project.scenes || defaultScenes,
      selectedSceneId: null,
      selectedCutId: null,
      selectionType: null,
    });
  },

  clearProject: () => set({
    projectLoaded: false,
    projectPath: null,
    vaultPath: null,
    trashPath: null,
    projectName: 'Untitled Project',
    scenes: [],
    selectedSceneId: null,
    selectedCutId: null,
    selectionType: null,
    rootFolder: null,
    sourceFolders: [],
    assetCache: new Map(),
  }),

  loadProject: (scenes) => set({ scenes }),

  // Folder browser actions
  setRootFolder: (folder) => set((state) => {
    // Also add to sourceFolders if not already present
    if (folder && !state.sourceFolders.some(f => f.path === folder.path)) {
      return {
        rootFolder: folder,
        sourceFolders: [...state.sourceFolders, folder]
      };
    }
    return { rootFolder: folder };
  }),

  addSourceFolder: (folder) => set((state) => {
    // Don't add if already exists
    if (state.sourceFolders.some(f => f.path === folder.path)) {
      return state;
    }
    return { sourceFolders: [...state.sourceFolders, folder] };
  }),

  removeSourceFolder: (path) => set((state) => ({
    sourceFolders: state.sourceFolders.filter(f => f.path !== path),
    // Also clear rootFolder if it matches
    rootFolder: state.rootFolder?.path === path ? null : state.rootFolder,
  })),

  updateSourceFolder: (path, structure) => set((state) => ({
    sourceFolders: state.sourceFolders.map(f =>
      f.path === path ? { ...f, structure } : f
    ),
  })),

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
  addScene: (name?: string) => {
    const id = uuidv4();
    set((state) => {
      const newOrder = state.scenes.length;
      return {
        scenes: [
          ...state.scenes,
          {
            id,
            name: name || `Scene ${newOrder + 1}`,
            cuts: [],
            order: newOrder,
            notes: [],
          },
        ],
      };
    });
    return id;
  },

  removeScene: (sceneId) => set((state) => ({
    scenes: state.scenes
      .filter((s) => s.id !== sceneId)
      .map((s, idx) => ({ ...s, order: idx })),
    selectedSceneId: state.selectedSceneId === sceneId ? null : state.selectedSceneId,
    selectionType: state.selectedSceneId === sceneId ? null : state.selectionType,
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

  updateSceneFolderPath: (sceneId, folderPath) => set((state) => ({
    scenes: state.scenes.map((s) =>
      s.id === sceneId ? { ...s, folderPath } : s
    ),
  })),

  // Scene notes actions
  addSceneNote: (sceneId, note) => set((state) => ({
    scenes: state.scenes.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            notes: [
              ...s.notes,
              {
                ...note,
                id: uuidv4(),
                createdAt: new Date().toISOString(),
              },
            ],
          }
        : s
    ),
  })),

  updateSceneNote: (sceneId, noteId, content) => set((state) => ({
    scenes: state.scenes.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            notes: s.notes.map((n) =>
              n.id === noteId ? { ...n, content } : n
            ),
          }
        : s
    ),
  })),

  removeSceneNote: (sceneId, noteId) => set((state) => ({
    scenes: state.scenes.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            notes: s.notes.filter((n) => n.id !== noteId),
          }
        : s
    ),
  })),

  // Cut actions
  addCutToScene: (sceneId, asset) => {
    const scene = get().scenes.find((s) => s.id === sceneId);
    if (!scene) return '';

    const cutId = uuidv4();
    const newCut: Cut = {
      id: cutId,
      assetId: asset.id,
      asset,
      displayTime: 2.0,
      order: scene.cuts.length,
    };

    set((state) => {
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
    });

    return cutId;
  },

  removeCut: (sceneId, cutId) => {
    const state = get();
    const scene = state.scenes.find((s) => s.id === sceneId);
    const cutToRemove = scene?.cuts.find((c) => c.id === cutId) || null;

    set((state) => ({
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
      selectionType: state.selectedCutId === cutId ? null : state.selectionType,
    }));

    return cutToRemove;
  },

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

  reorderCuts: (sceneId, _cutId, newIndex, _fromSceneId, oldIndex) => set((state) => {
    const scene = state.scenes.find((s) => s.id === sceneId);
    if (!scene) return state;

    const newCuts = [...scene.cuts];
    const [removed] = newCuts.splice(oldIndex, 1);
    newCuts.splice(newIndex, 0, removed);

    return {
      scenes: state.scenes.map((s) =>
        s.id === sceneId
          ? { ...s, cuts: newCuts.map((c, idx) => ({ ...c, order: idx })) }
          : s
      ),
    };
  }),

  moveCutToScene: (fromSceneId, toSceneId, cutId, toIndex) => set((state) => {
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
  selectScene: (sceneId) => set({
    selectedSceneId: sceneId,
    selectedCutId: null,
    selectionType: sceneId ? 'scene' : null,
  }),

  selectCut: (cutId) => set((state) => {
    // Find the scene containing this cut
    let sceneId: string | null = null;
    for (const scene of state.scenes) {
      if (scene.cuts.some((c) => c.id === cutId)) {
        sceneId = scene.id;
        break;
      }
    }
    return {
      selectedCutId: cutId,
      selectedSceneId: sceneId,
      selectionType: cutId ? 'cut' : null,
    };
  }),

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

  // Helpers
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

  getSelectedScene: () => {
    const state = get();
    if (!state.selectedSceneId) return null;
    return state.scenes.find((s) => s.id === state.selectedSceneId) || null;
  },

  getProjectData: () => {
    const state = get();
    return {
      id: uuidv4(),
      name: state.projectName,
      vaultPath: state.vaultPath || '',
      scenes: state.scenes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
}));
