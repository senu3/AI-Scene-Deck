import { beforeEach, describe, expect, it } from 'vitest';
import type { SourcePanelState } from '../../../types';
import { resetElectronMocks } from '../../../test/setup.renderer';
import { resolveInitialSourcePanelState } from '../sourcePanelState';

describe('sourcePanelState', () => {
  beforeEach(() => {
    resetElectronMocks();
  });

  it('hydrates saved source folders and skips vault assets folder', async () => {
    const savedState: SourcePanelState = {
      folders: [
        { path: 'C:/vault/assets', name: 'assets' },
        { path: 'C:/source', name: 'source' },
      ],
      expandedPaths: ['C:/source'],
      viewMode: 'grid',
    };

    (window.electronAPI!.getFolderContents as any).mockResolvedValue([
      { name: 'a.mov', path: 'C:/source/a.mov', isDirectory: false },
    ]);

    const result = await resolveInitialSourcePanelState(savedState, 'C:/vault');

    expect(result).toEqual({
      folders: [{
        path: 'C:/source',
        name: 'source',
        structure: [{ name: 'a.mov', path: 'C:/source/a.mov', isDirectory: false }],
      }],
      expandedPaths: ['C:/source'],
      viewMode: 'grid',
    });
    expect(window.electronAPI!.getFolderContents).toHaveBeenCalledTimes(1);
    expect(window.electronAPI!.getFolderContents).toHaveBeenCalledWith('C:/source');
  });

  it('returns default empty state when no saved panel state exists', async () => {
    await expect(resolveInitialSourcePanelState(undefined, 'C:/vault')).resolves.toEqual({
      folders: [],
      expandedPaths: [],
      viewMode: 'list',
    });
    expect(window.electronAPI!.getFolderContents).not.toHaveBeenCalled();
  });
});
