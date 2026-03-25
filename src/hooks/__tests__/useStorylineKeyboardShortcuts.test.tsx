import { describe, expect, it } from 'vitest';
import { shouldHandleStorylineCommandShortcut } from '../useStorylineKeyboardShortcuts';

describe('shouldHandleStorylineCommandShortcut', () => {
  it('allows command shortcuts only when the focused target is inside storyline scope', () => {
    const container = document.createElement('div');
    const target = document.createElement('div');
    container.appendChild(target);
    document.body.appendChild(container);

    expect(shouldHandleStorylineCommandShortcut({
      target,
      container,
      isCommandScopeActive: true,
      isHandToolActive: false,
    })).toBe(true);

    container.remove();
  });

  it('blocks command shortcuts while the hand tool is active', () => {
    const container = document.createElement('div');
    const target = document.createElement('div');
    container.appendChild(target);
    document.body.appendChild(container);

    expect(shouldHandleStorylineCommandShortcut({
      target,
      container,
      isCommandScopeActive: true,
      isHandToolActive: true,
    })).toBe(false);

    container.remove();
  });

  it('blocks command shortcuts on interactive controls inside storyline', () => {
    const container = document.createElement('div');
    const button = document.createElement('button');
    container.appendChild(button);
    document.body.appendChild(container);

    expect(shouldHandleStorylineCommandShortcut({
      target: button,
      container,
      isCommandScopeActive: true,
      isHandToolActive: false,
    })).toBe(false);

    container.remove();
  });
});
