import type { CutImportResult, CutImportSource } from '../../utils/cutImport';
import { buildAssetForCut } from '../../utils/cutImport';

export interface ResolveImportedCutInput {
  source: CutImportSource;
  vaultPath: string | null | undefined;
}

export async function resolveImportedCutAsset(
  input: ResolveImportedCutInput
): Promise<CutImportResult> {
  return buildAssetForCut(input.source, input.vaultPath);
}
