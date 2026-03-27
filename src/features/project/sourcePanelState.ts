import type { FileItem, SourcePanelState } from '../../types';
import { readFolderContentsForSourcePanel } from './sourcePanelProvider';

interface SourcePanelFolderWithStructure {
  path: string;
  name: string;
  structure: FileItem[];
}

export interface ResolvedSourcePanelState {
  folders: SourcePanelFolderWithStructure[];
  expandedPaths: string[];
  viewMode: SourcePanelState['viewMode'];
}

export async function resolveInitialSourcePanelState(
  state: SourcePanelState | undefined,
  vaultPath: string | null
): Promise<ResolvedSourcePanelState> {
  const vaultAssetsPath = vaultPath ? `${vaultPath}/assets`.replace(/\\/g, '/') : null;

  if (!state) {
    return {
      folders: [],
      expandedPaths: [],
      viewMode: 'list',
    };
  }

  const folders: SourcePanelFolderWithStructure[] = [];
  for (const folderState of state.folders) {
    const normalizedPath = folderState.path.replace(/\\/g, '/');
    if (vaultAssetsPath && normalizedPath === vaultAssetsPath) {
      continue;
    }

    try {
      const structure = await readFolderContentsForSourcePanel(folderState.path);
      if (!structure) continue;
      folders.push({
        path: folderState.path,
        name: folderState.name,
        structure,
      });
    } catch {
      // Folder may not exist anymore.
    }
  }

  return {
    folders,
    expandedPaths: state.expandedPaths,
    viewMode: state.viewMode || 'list',
  };
}
