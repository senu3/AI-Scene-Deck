import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Scene, Cut, Asset, FileItem, FavoriteFolder, PlaybackMode, PreviewMode, SceneNote, SelectionType, Project, SourceViewMode, SourcePanelState } from '../types';

export interface SourceFolder {
  path: string;
  name: string;
  structure: FileItem[];
}

// Clipboard data structure for copy/paste
interface ClipboardCut {
  assetId: string;
  asset: Asset;
  displayTime: number;
  // Video clip fields
  inPoint?: number;
  outPoint?: number;
  isClip?: boolean;
}

interface AppState {
  // Project state
  projectLoaded: boolean;
  projectPath: string | null;
  vaultPath: string | null;
  trashPath: string | null;
  projectName: string;

  // Clipboard state
  clipboard: ClipboardCut[];

  // Folder browser state - now supports multiple source folders
  sourceFolders: SourceFolder[];
  rootFolder: { path: string; name: string; structure: FileItem[] } | null; // Legacy, kept for compatibility
  expandedFolders: Set<string>;
  favorites: FavoriteFolder[];
  sourceViewMode: SourceViewMode;

  // Timeline state
  scenes: Scene[];
  selectedSceneId: string | null;
  selectedCutId: string | null;
  selectedCutIds: Set<string>;  // Multi-select support
  lastSelectedCutId: string | null;  // For Shift+click range selection
  selectionType: SelectionType;

  // Asset cache
  assetCache: Map<string, Asset>;

  // Playback state
  playbackMode: PlaybackMode;
  previewMode: PreviewMode;
  currentPreviewIndex: number;

  // Global volume state (shared between modals)
  globalVolume: number;
  globalMuted: boolean;

  // Video preview modal state
  videoPreviewCutId: string | null;

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
  setExpandedFolders: (paths: string[]) => void;
  addFavorite: (folder: FavoriteFolder) => void;
  removeFavorite: (path: string) => void;
  setSourceViewMode: (mode: SourceViewMode) => void;
  initializeSourcePanel: (state: SourcePanelState | undefined, vaultPath: string | null) => void;
  getSourcePanelState: () => SourcePanelState;

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
  moveCutsToScene: (cutIds: string[], toSceneId: string, toIndex: number) => void;  // Multi-move

  // Actions - Video Clips
  updateCutClipPoints: (sceneId: string, cutId: string, inPoint: number, outPoint: number) => void;
  clearCutClipPoints: (sceneId: string, cutId: string) => void;

  // Actions - Selection
  selectScene: (sceneId: string | null) => void;
  selectCut: (cutId: string | null) => void;

  // Multi-select actions
  toggleCutSelection: (cutId: string) => void;  // Ctrl/Cmd + click
  selectCutRange: (cutId: string) => void;  // Shift + click
  selectMultipleCuts: (cutIds: string[]) => void;  // Select specific cuts
  clearCutSelection: () => void;
  isMultiSelected: (cutId: string) => boolean;

  // Clipboard actions
  copySelectedCuts: () => void;
  pasteCuts: (targetSceneId: string, targetIndex?: number) => string[];  // Returns new cut IDs
  canPaste: () => boolean;

  // Actions - Playback
  setPlaybackMode: (mode: PlaybackMode) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setCurrentPreviewIndex: (index: number) => void;

  // Actions - Global volume
  setGlobalVolume: (volume: number) => void;
  setGlobalMuted: (muted: boolean) => void;
  toggleGlobalMute: () => void;

  // Actions - Video preview modal
  openVideoPreview: (cutId: string) => void;
  closeVideoPreview: () => void;

  // Actions - Asset cache
  cacheAsset: (asset: Asset) => void;
  getAsset: (assetId: string) => Asset | undefined;

  // Helpers
  getSelectedCut: () => { scene: Scene; cut: Cut } | null;
  getSelectedScene: () => Scene | null;
  getProjectData: () => Project;
  getSelectedCuts: () => Array<{ scene: Scene; cut: Cut }>;
  getSelectedCutIds: () => string[];
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  projectLoaded: false,
  projectPath: null,
  vaultPath: null,
  trashPath: null,
  projectName: 'Untitled Project',

  clipboard: [],

  sourceFolders: [],
  rootFolder: null,
  expandedFolders: new Set(),
  favorites: [],
  sourceViewMode: 'list' as SourceViewMode,
  scenes: [],
  selectedSceneId: null,
  selectedCutId: null,
  selectedCutIds: new Set(),
  lastSelectedCutId: null,
  selectionType: null,
  assetCache: new Map(),
  playbackMode: 'stopped',
  previewMode: 'all',
  currentPreviewIndex: 0,
  globalVolume: 1,
  globalMuted: false,
  videoPreviewCutId: null,

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
      selectedCutIds: new Set(),
      lastSelectedCutId: null,
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
    selectedCutIds: new Set(),
    lastSelectedCutId: null,
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

  setExpandedFolders: (paths) => set({ expandedFolders: new Set(paths) }),

  addFavorite: (folder) => set((state) => ({
    favorites: [...state.favorites, folder],
  })),

  removeFavorite: (path) => set((state) => ({
    favorites: state.favorites.filter((f) => f.path !== path),
  })),

  setSourceViewMode: (mode) => set({ sourceViewMode: mode }),

  initializeSourcePanel: async (state, vaultPath) => {
    if (state) {
      // Restore from project state
      const folders: SourceFolder[] = [];
      for (const folderState of state.folders) {
        // Load folder contents
        if (window.electronAPI) {
          try {
            const structure = await window.electronAPI.getFolderContents(folderState.path);
            folders.push({
              path: folderState.path,
              name: folderState.name,
              structure,
            });
          } catch {
            // Folder may not exist anymore, skip
          }
        }
      }
      set({
        sourceFolders: folders,
        expandedFolders: new Set(state.expandedPaths),
        sourceViewMode: state.viewMode || 'list',
      });
    } else if (vaultPath) {
      // Default: add vault assets folder
      const assetsPath = `${vaultPath}/assets`.replace(/\\/g, '/');
      if (window.electronAPI) {
        try {
          const exists = await window.electronAPI.pathExists(assetsPath);
          if (exists) {
            const structure = await window.electronAPI.getFolderContents(assetsPath);
            set({
              sourceFolders: [{
                path: assetsPath,
                name: 'assets',
                structure,
              }],
              expandedFolders: new Set([assetsPath]),
              sourceViewMode: 'list',
            });
          }
        } catch {
          // Ignore errors
        }
      }
    }
  },

  getSourcePanelState: () => {
    const state = get();
    return {
      folders: state.sourceFolders.map(f => ({ path: f.path, name: f.name })),
      expandedPaths: Array.from(state.expandedFolders),
      viewMode: state.sourceViewMode,
    };
  },

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
      displayTime: 1.0,
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

  // Video clip actions
  updateCutClipPoints: (sceneId, cutId, inPoint, outPoint) => set((state) => ({
    scenes: state.scenes.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            cuts: s.cuts.map((c) =>
              c.id === cutId
                ? {
                    ...c,
                    inPoint,
                    outPoint,
                    isClip: true,
                    // Update displayTime to match clip duration
                    displayTime: Math.abs(outPoint - inPoint),
                  }
                : c
            ),
          }
        : s
    ),
  })),

  clearCutClipPoints: (sceneId, cutId) => set((state) => ({
    scenes: state.scenes.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            cuts: s.cuts.map((c) =>
              c.id === cutId
                ? {
                    ...c,
                    inPoint: undefined,
                    outPoint: undefined,
                    isClip: false,
                  }
                : c
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

  // Move multiple cuts to a scene (preserves relative order)
  moveCutsToScene: (cutIds, toSceneId, toIndex) => set((state) => {
    // Collect cuts to move with their current data (preserving order in cutIds)
    const cutsToMove: Cut[] = [];
    const cutIdSet = new Set(cutIds);

    // Get cuts in the order specified by cutIds
    for (const cutId of cutIds) {
      for (const scene of state.scenes) {
        const cut = scene.cuts.find((c) => c.id === cutId);
        if (cut) {
          cutsToMove.push(cut);
          break;
        }
      }
    }

    if (cutsToMove.length === 0) return state;

    // Remove cuts from all scenes and add to target scene
    return {
      scenes: state.scenes.map((s) => {
        // Remove any selected cuts from this scene
        const remainingCuts = s.cuts.filter((c) => !cutIdSet.has(c.id));

        if (s.id === toSceneId) {
          // Insert all cuts at the target position
          const newCuts = [...remainingCuts];
          newCuts.splice(Math.min(toIndex, newCuts.length), 0, ...cutsToMove);
          return {
            ...s,
            cuts: newCuts.map((c, idx) => ({ ...c, order: idx })),
          };
        }

        // Other scenes: just remove the cuts
        if (remainingCuts.length !== s.cuts.length) {
          return {
            ...s,
            cuts: remainingCuts.map((c, idx) => ({ ...c, order: idx })),
          };
        }

        return s;
      }),
      // Clear selection after move
      selectedCutIds: new Set<string>(),
      selectedCutId: null,
      lastSelectedCutId: null,
    };
  }),

  // Selection actions
  selectScene: (sceneId) => set({
    selectedSceneId: sceneId,
    selectedCutId: null,
    selectedCutIds: new Set(),
    lastSelectedCutId: null,
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
    // Single selection clears multi-select
    return {
      selectedCutId: cutId,
      selectedSceneId: sceneId,
      selectedCutIds: cutId ? new Set([cutId]) : new Set(),
      lastSelectedCutId: cutId,
      selectionType: cutId ? 'cut' : null,
    };
  }),

  // Multi-select actions
  toggleCutSelection: (cutId) => set((state) => {
    const newSelectedIds = new Set(state.selectedCutIds);
    if (newSelectedIds.has(cutId)) {
      newSelectedIds.delete(cutId);
    } else {
      newSelectedIds.add(cutId);
    }

    // Find scene for the cut
    let sceneId: string | null = state.selectedSceneId;
    for (const scene of state.scenes) {
      if (scene.cuts.some((c) => c.id === cutId)) {
        sceneId = scene.id;
        break;
      }
    }

    // If only one item selected, set it as selectedCutId for backwards compatibility
    const selectedCutId = newSelectedIds.size === 1
      ? Array.from(newSelectedIds)[0]
      : (newSelectedIds.size > 0 ? cutId : null);

    return {
      selectedCutIds: newSelectedIds,
      selectedCutId,
      lastSelectedCutId: cutId,
      selectedSceneId: sceneId,
      selectionType: newSelectedIds.size > 0 ? 'cut' : null,
    };
  }),

  selectCutRange: (cutId) => set((state) => {
    if (!state.lastSelectedCutId) {
      // No previous selection, treat as single select
      let sceneId: string | null = null;
      for (const scene of state.scenes) {
        if (scene.cuts.some((c) => c.id === cutId)) {
          sceneId = scene.id;
          break;
        }
      }
      return {
        selectedCutIds: new Set([cutId]),
        selectedCutId: cutId,
        lastSelectedCutId: cutId,
        selectedSceneId: sceneId,
        selectionType: 'cut',
      };
    }

    // Find all cuts in order (across all scenes)
    const allCuts: Array<{ cutId: string; sceneId: string }> = [];
    for (const scene of state.scenes) {
      for (const cut of scene.cuts) {
        allCuts.push({ cutId: cut.id, sceneId: scene.id });
      }
    }

    // Find indices
    const startIndex = allCuts.findIndex(c => c.cutId === state.lastSelectedCutId);
    const endIndex = allCuts.findIndex(c => c.cutId === cutId);

    if (startIndex === -1 || endIndex === -1) {
      return state;
    }

    // Select range
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    const rangeIds = allCuts.slice(minIndex, maxIndex + 1).map(c => c.cutId);

    const newSelectedIds = new Set(rangeIds);

    return {
      selectedCutIds: newSelectedIds,
      selectedCutId: cutId,
      selectedSceneId: allCuts[endIndex]?.sceneId || state.selectedSceneId,
      selectionType: 'cut',
      // Don't update lastSelectedCutId to allow extending the range
    };
  }),

  selectMultipleCuts: (cutIds) => set((state) => {
    const newSelectedIds = new Set(cutIds);
    const firstCutId = cutIds[0] || null;

    // Find scene for first cut
    let sceneId: string | null = null;
    if (firstCutId) {
      for (const scene of state.scenes) {
        if (scene.cuts.some((c) => c.id === firstCutId)) {
          sceneId = scene.id;
          break;
        }
      }
    }

    return {
      selectedCutIds: newSelectedIds,
      selectedCutId: firstCutId,
      lastSelectedCutId: firstCutId,
      selectedSceneId: sceneId,
      selectionType: cutIds.length > 0 ? 'cut' : null,
    };
  }),

  clearCutSelection: () => set({
    selectedCutIds: new Set(),
    selectedCutId: null,
    lastSelectedCutId: null,
    selectionType: null,
  }),

  isMultiSelected: (cutId) => get().selectedCutIds.has(cutId),

  // Clipboard actions
  copySelectedCuts: () => {
    const state = get();
    const selectedCuts = state.getSelectedCuts();

    if (selectedCuts.length === 0) return;

    // Store cut data (without IDs, as new IDs will be generated on paste)
    const clipboardData: ClipboardCut[] = selectedCuts.map(({ cut }) => ({
      assetId: cut.assetId,
      asset: cut.asset!,
      displayTime: cut.displayTime,
      // Include clip points
      inPoint: cut.inPoint,
      outPoint: cut.outPoint,
      isClip: cut.isClip,
    }));

    set({ clipboard: clipboardData });
  },

  pasteCuts: (targetSceneId, targetIndex) => {
    const state = get();
    if (state.clipboard.length === 0) return [];

    const targetScene = state.scenes.find(s => s.id === targetSceneId);
    if (!targetScene) return [];

    const insertIndex = targetIndex ?? targetScene.cuts.length;
    const newCutIds: string[] = [];

    // Create new cuts with unique IDs
    const newCuts: Cut[] = state.clipboard.map((clipCut, idx) => {
      const newId = uuidv4();
      newCutIds.push(newId);
      return {
        id: newId,
        assetId: clipCut.assetId,
        asset: clipCut.asset,
        displayTime: clipCut.displayTime,
        order: insertIndex + idx,
        // Include clip points
        inPoint: clipCut.inPoint,
        outPoint: clipCut.outPoint,
        isClip: clipCut.isClip,
      };
    });

    set((state) => ({
      scenes: state.scenes.map((s) => {
        if (s.id === targetSceneId) {
          const updatedCuts = [...s.cuts];
          updatedCuts.splice(insertIndex, 0, ...newCuts);
          return {
            ...s,
            cuts: updatedCuts.map((c, idx) => ({ ...c, order: idx })),
          };
        }
        return s;
      }),
      // Select the newly pasted cuts
      selectedCutIds: new Set(newCutIds),
      selectedCutId: newCutIds[0] || null,
      lastSelectedCutId: newCutIds[newCutIds.length - 1] || null,
      selectedSceneId: targetSceneId,
      selectionType: 'cut',
    }));

    return newCutIds;
  },

  canPaste: () => get().clipboard.length > 0,

  // Playback actions
  setPlaybackMode: (mode) => set({ playbackMode: mode }),
  setPreviewMode: (mode) => set({ previewMode: mode }),
  setCurrentPreviewIndex: (index) => set({ currentPreviewIndex: index }),

  // Global volume actions
  setGlobalVolume: (volume) => set({ globalVolume: volume, globalMuted: volume === 0 }),
  setGlobalMuted: (muted) => set({ globalMuted: muted }),
  toggleGlobalMute: () => set((state) => ({ globalMuted: !state.globalMuted })),

  // Video preview modal actions
  openVideoPreview: (cutId) => set({ videoPreviewCutId: cutId }),
  closeVideoPreview: () => set({ videoPreviewCutId: null }),

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
      version: 3,
      sourcePanel: state.getSourcePanelState(),
    };
  },

  getSelectedCuts: () => {
    const state = get();
    const result: Array<{ scene: Scene; cut: Cut }> = [];

    for (const scene of state.scenes) {
      for (const cut of scene.cuts) {
        if (state.selectedCutIds.has(cut.id)) {
          result.push({ scene, cut });
        }
      }
    }
    return result;
  },

  getSelectedCutIds: () => Array.from(get().selectedCutIds),
}));
