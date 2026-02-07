import { v4 as uuidv4 } from 'uuid';
import type { CutImportSource } from './cutImport';

export type SupportedMediaType = 'image' | 'video' | 'audio';
export type DragKind = 'asset' | 'externalFiles' | 'none';

export function getMediaType(filename: string): SupportedMediaType | null {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
  const audioExts = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  return null;
}

export function getFilePath(file: File): string | undefined {
  return (file as File & { path?: string }).path;
}

export function getSupportedMediaFiles(dataTransfer: DataTransfer): File[] {
  const items = Array.from(dataTransfer.items || []);
  if (items.length > 0) {
    return items
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => !!file && getMediaType(file.name) !== null);
  }

  return Array.from(dataTransfer.files || [])
    .filter((file) => getMediaType(file.name) !== null);
}

export function hasSupportedMediaDrag(dataTransfer: DataTransfer): boolean {
  const items = Array.from(dataTransfer.items || []);
  if (items.length > 0) {
    for (const item of items) {
      if (item.kind !== 'file') continue;
      if (item.type?.startsWith('image/') || item.type?.startsWith('video/') || item.type?.startsWith('audio/')) {
        return true;
      }
      const file = item.getAsFile();
      if (file && getMediaType(file.name) !== null) {
        return true;
      }
    }
    return false;
  }

  return Array.from(dataTransfer.files || []).some((file) => getMediaType(file.name) !== null);
}

export function hasAssetPanelDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes('text/scene-deck-asset')
    || dataTransfer.types.includes('application/json');
}

export function getDragKind(dataTransfer: DataTransfer): DragKind {
  if (hasAssetPanelDrag(dataTransfer)) return 'asset';
  if (dataTransfer.types.includes('Files')) {
    if (hasSupportedMediaDrag(dataTransfer) || getSupportedMediaFiles(dataTransfer).length > 0) {
      return 'externalFiles';
    }
  }
  return 'none';
}

interface QueueExternalFilesToSceneOptions {
  sceneId: string;
  files: File[];
  createCutFromImport: (
    sceneId: string,
    source: CutImportSource,
    insertIndex?: number,
    vaultPathOverride?: string | null
  ) => Promise<string>;
  insertIndex?: number;
  vaultPathOverride?: string | null;
}

export function queueExternalFilesToScene({
  sceneId,
  files,
  createCutFromImport,
  insertIndex,
  vaultPathOverride,
}: QueueExternalFilesToSceneOptions): void {
  for (const file of files) {
    const mediaType = getMediaType(file.name);
    const filePath = getFilePath(file);
    if (!filePath || !mediaType) continue;

    const assetId = uuidv4();
    createCutFromImport(sceneId, {
      assetId,
      name: file.name,
      sourcePath: filePath,
      type: mediaType,
      fileSize: file.size,
    }, insertIndex, vaultPathOverride).catch(() => {});
  }
}
