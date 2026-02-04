import { vi } from 'vitest';

// Minimal window.electronAPI mock for renderer unit tests.
const electronAPIMock = {
  pathExists: vi.fn(async () => true),
  loadProjectFromPath: vi.fn(async () => ({ data: null, path: '' })),
  saveProject: vi.fn(async () => 'mocked-path'),
  resolveVaultPath: vi.fn(async (_vaultPath: string, relativePath: string) => ({
    absolutePath: `C:/mock/${relativePath}`,
    exists: true,
  })),
  isPathInVault: vi.fn(async () => false),
  vaultGateway: {
    importAndRegisterAsset: vi.fn(async () => ({
      success: true,
      vaultPath: 'C:/mock/vault/assets/img_abc.png',
      relativePath: 'assets/img_abc.png',
      hash: 'abc',
      isDuplicate: false,
    })),
    moveToTrashWithMeta: vi.fn(async () => 'C:/mock/vault/.trash/img_abc.png'),
  },
};

Object.defineProperty(window, 'electronAPI', {
  value: electronAPIMock,
  writable: true,
});

// Allow tests to reset mocks easily.
export function resetElectronMocks() {
  Object.values(electronAPIMock).forEach((value) => {
    if (typeof value === 'function' && 'mockClear' in value) {
      value.mockClear();
    }
  });
  Object.values(electronAPIMock.vaultGateway).forEach((value) => {
    if (typeof value === 'function' && 'mockClear' in value) {
      value.mockClear();
    }
  });
}
