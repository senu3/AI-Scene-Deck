import { describe, expect, it } from 'vitest';
import { getKeyboardScopeOwner, isSurfaceLocalAppShortcut } from '../keyboardScope';

describe('keyboardScope', () => {
  it('resolves the nearest keyboard scope owner from the target tree', () => {
    const scope = document.createElement('div');
    scope.dataset.keyboardScope = 'storyline';
    const child = document.createElement('button');
    scope.appendChild(child);
    document.body.appendChild(scope);

    expect(getKeyboardScopeOwner(child)).toBe('storyline');

    scope.remove();
  });

  it('treats plain Tab as a surface-local app shortcut', () => {
    expect(isSurfaceLocalAppShortcut({
      key: 'Tab',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
    })).toBe(true);

    expect(isSurfaceLocalAppShortcut({
      key: 'Tab',
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
      altKey: false,
    })).toBe(false);
  });
});
