/**
 * Metadata store utilities for persisting asset attachments in .metadata.json
 */

import type { MetadataStore, AssetMetadata } from '../types';

const METADATA_FILE = '.metadata.json';
const CURRENT_VERSION = 1;

/**
 * Load metadata store from vault
 * @param vaultPath - Path to the vault directory
 * @returns MetadataStore object
 */
export async function loadMetadataStore(vaultPath: string): Promise<MetadataStore> {
  const metadataPath = `${vaultPath}/${METADATA_FILE}`.replace(/\\/g, '/');

  if (!window.electronAPI) {
    return { version: CURRENT_VERSION, metadata: {} };
  }

  try {
    const exists = await window.electronAPI.pathExists(metadataPath);
    if (!exists) {
      return { version: CURRENT_VERSION, metadata: {} };
    }

    // Load project from path returns JSON parsed data
    const result = await window.electronAPI.loadProjectFromPath(metadataPath);
    if (result?.data) {
      const data = result.data as MetadataStore;
      // Ensure version compatibility
      if (typeof data.version === 'number' && typeof data.metadata === 'object') {
        return data;
      }
    }
  } catch (error) {
    console.error('Failed to load metadata store:', error);
  }

  return { version: CURRENT_VERSION, metadata: {} };
}

/**
 * Save metadata store to vault
 * @param vaultPath - Path to the vault directory
 * @param store - MetadataStore to save
 * @returns true if saved successfully
 */
export async function saveMetadataStore(
  vaultPath: string,
  store: MetadataStore
): Promise<boolean> {
  const metadataPath = `${vaultPath}/${METADATA_FILE}`.replace(/\\/g, '/');

  if (!window.electronAPI) {
    return false;
  }

  try {
    // Use saveProject which handles JSON stringification
    const result = await window.electronAPI.saveProject(
      JSON.stringify(store, null, 2),
      metadataPath
    );
    return result !== null;
  } catch (error) {
    console.error('Failed to save metadata store:', error);
    return false;
  }
}

/**
 * Get metadata for a specific asset
 * @param store - MetadataStore
 * @param assetId - Asset ID to look up
 * @returns AssetMetadata or undefined if not found
 */
export function getAssetMetadata(
  store: MetadataStore,
  assetId: string
): AssetMetadata | undefined {
  return store.metadata[assetId];
}

/**
 * Update metadata for an asset (immutable)
 * @param store - Current MetadataStore
 * @param metadata - AssetMetadata to update/add
 * @returns New MetadataStore with updated metadata
 */
export function updateAssetMetadata(
  store: MetadataStore,
  metadata: AssetMetadata
): MetadataStore {
  return {
    ...store,
    metadata: {
      ...store.metadata,
      [metadata.assetId]: metadata,
    },
  };
}

/**
 * Remove metadata for an asset (immutable)
 * @param store - Current MetadataStore
 * @param assetId - Asset ID to remove metadata for
 * @returns New MetadataStore with metadata removed
 */
export function removeAssetMetadata(
  store: MetadataStore,
  assetId: string
): MetadataStore {
  const { [assetId]: _, ...remaining } = store.metadata;
  return {
    ...store,
    metadata: remaining,
  };
}

/**
 * Attach audio to an asset (immutable)
 * @param store - Current MetadataStore
 * @param assetId - Asset to attach audio to
 * @param audioAssetId - Audio asset ID
 * @param offset - Optional audio offset in seconds
 * @returns New MetadataStore with audio attached
 */
export function attachAudio(
  store: MetadataStore,
  assetId: string,
  audioAssetId: string,
  offset: number = 0
): MetadataStore {
  const existing = store.metadata[assetId] || { assetId };
  return updateAssetMetadata(store, {
    ...existing,
    attachedAudioId: audioAssetId,
    attachedAudioOffset: offset,
  });
}

/**
 * Detach audio from an asset (immutable)
 * @param store - Current MetadataStore
 * @param assetId - Asset to detach audio from
 * @returns New MetadataStore with audio detached
 */
export function detachAudio(
  store: MetadataStore,
  assetId: string
): MetadataStore {
  const existing = store.metadata[assetId];
  if (!existing) return store;

  const { attachedAudioId: _, attachedAudioOffset: __, ...rest } = existing;

  // If no other metadata, remove the entry entirely
  if (Object.keys(rest).length <= 1) { // Only assetId remains
    return removeAssetMetadata(store, assetId);
  }

  return updateAssetMetadata(store, rest as AssetMetadata);
}

/**
 * Update audio offset for an asset (immutable)
 * @param store - Current MetadataStore
 * @param assetId - Asset ID
 * @param offset - New offset in seconds
 * @returns New MetadataStore with updated offset
 */
export function updateAudioOffset(
  store: MetadataStore,
  assetId: string,
  offset: number
): MetadataStore {
  const existing = store.metadata[assetId];
  if (!existing || !existing.attachedAudioId) return store;

  return updateAssetMetadata(store, {
    ...existing,
    attachedAudioOffset: offset,
  });
}
