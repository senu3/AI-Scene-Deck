// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createSaveProjectHandler } from '../handlers/saveProject';

describe('save-project handler', () => {
  it('writes to provided path with correct contents', async () => {
    const writeFileSync = vi.fn();
    const showSaveDialog = vi.fn();

    const handler = createSaveProjectHandler({
      dialog: { showSaveDialog },
      fs: { writeFileSync },
      getMainWindow: () => ({}) as any,
    });

    const result = await handler({}, '{"ok":true}', 'C:/vault/project.sdp');

    expect(result).toBe('C:/vault/project.sdp');
    expect(showSaveDialog).not.toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalledWith('C:/vault/project.sdp', '{"ok":true}', 'utf-8');
  });

  it('uses dialog when path not provided and writes once', async () => {
    const writeFileSync = vi.fn();
    const showSaveDialog = vi.fn(async () => ({ canceled: false, filePath: 'C:/vault/choose.sdp' }));

    const handler = createSaveProjectHandler({
      dialog: { showSaveDialog },
      fs: { writeFileSync },
      getMainWindow: () => ({}) as any,
    });

    const result = await handler({}, '{"ok":true}');

    expect(result).toBe('C:/vault/choose.sdp');
    expect(showSaveDialog).toHaveBeenCalledTimes(1);
    expect(writeFileSync).toHaveBeenCalledWith('C:/vault/choose.sdp', '{"ok":true}', 'utf-8');
  });

  it('returns null when dialog is canceled', async () => {
    const writeFileSync = vi.fn();
    const showSaveDialog = vi.fn(async () => ({ canceled: true, filePath: null }));

    const handler = createSaveProjectHandler({
      dialog: { showSaveDialog },
      fs: { writeFileSync },
      getMainWindow: () => ({}) as any,
    });

    const result = await handler({}, '{"ok":true}');

    expect(result).toBeNull();
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('returns null when write fails', async () => {
    const writeFileSync = vi.fn(() => { throw new Error('disk error'); });
    const showSaveDialog = vi.fn();

    const handler = createSaveProjectHandler({
      dialog: { showSaveDialog },
      fs: { writeFileSync },
      getMainWindow: () => ({}) as any,
    });

    const result = await handler({}, '{"ok":true}', 'C:/vault/project.sdp');

    expect(result).toBeNull();
    expect(writeFileSync).toHaveBeenCalledTimes(1);
  });
});
