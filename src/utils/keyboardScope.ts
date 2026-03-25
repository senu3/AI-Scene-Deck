export type KeyboardScopeOwner = 'preview' | 'storyline';

const KEYBOARD_SCOPE_OWNERS = new Set<KeyboardScopeOwner>(['preview', 'storyline']);

export function getKeyboardScopeOwner(target: EventTarget | null): KeyboardScopeOwner | null {
  if (!(target instanceof HTMLElement)) return null;
  const scopeValue = target.closest<HTMLElement>('[data-keyboard-scope]')?.dataset.keyboardScope;
  if (!scopeValue || !KEYBOARD_SCOPE_OWNERS.has(scopeValue as KeyboardScopeOwner)) {
    return null;
  }
  return scopeValue as KeyboardScopeOwner;
}

export function isSurfaceLocalAppShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): boolean {
  return event.key === 'Tab'
    && !event.ctrlKey
    && !event.metaKey
    && !event.shiftKey
    && !event.altKey;
}
