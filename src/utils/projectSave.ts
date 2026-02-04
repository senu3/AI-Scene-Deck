import type { Scene, SourcePanelState } from '../types';

export interface ProjectSavePayload {
  version: number;
  name: string;
  vaultPath: string | null;
  scenes: Scene[];
  sourcePanel: SourcePanelState | undefined;
  savedAt: string;
}

export function buildProjectSavePayload(input: {
  version: number;
  name: string;
  vaultPath: string | null;
  scenes: Scene[];
  sourcePanel: SourcePanelState | undefined;
  savedAt: string;
}): ProjectSavePayload {
  return {
    version: input.version,
    name: input.name,
    vaultPath: input.vaultPath,
    scenes: input.scenes,
    sourcePanel: input.sourcePanel,
    savedAt: input.savedAt,
  };
}

export function serializeProjectSavePayload(payload: ProjectSavePayload): string {
  return JSON.stringify(payload);
}
