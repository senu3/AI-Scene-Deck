import { beforeEach, describe, expect, it } from 'vitest';
import { resetElectronMocks } from '../../test/setup.renderer';
import { useStore } from '../useStore';

describe('projectSlice source panel state boundary', () => {
  const initialState = useStore.getState();

  beforeEach(() => {
    resetElectronMocks();
    useStore.setState(initialState, true);
    useStore.getState().initializeProject({
      name: 'Test',
      vaultPath: 'C:/vault',
      scenes: [{ id: 'scene-1', name: 'Scene 1', cuts: [], notes: [] }],
    });
  });

  it('applies resolved source panel state without bridge reads', () => {
    const resolvedState = {
      folders: [
        {
          path: 'C:/source',
          name: 'source',
          structure: [{ name: 'a.mov', path: 'C:/source/a.mov', isDirectory: false }],
        },
      ],
      expandedPaths: ['C:/source'],
      viewMode: 'grid' as const,
    };

    useStore.getState().applySourcePanelState(resolvedState);

    const state = useStore.getState();
    expect(state.sourceFolders.map((folder) => folder.path)).toEqual(['C:/source']);
    expect(state.sourceFolders[0]?.structure).toEqual([
      { name: 'a.mov', path: 'C:/source/a.mov', isDirectory: false },
    ]);
    expect(state.sourceViewMode).toBe('grid');
    expect(state.expandedFolders.has('C:/source')).toBe(true);
    expect(window.electronAPI!.getFolderContents).not.toHaveBeenCalled();
    expect(window.electronAPI!.pathExists).not.toHaveBeenCalled();
  });
});
