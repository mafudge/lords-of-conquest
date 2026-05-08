// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mountKeyboard } from '../../../src/ui/platform/keyboard.js';
import { setFastForward, getFastForward } from '../../../src/ui/render/animations.js';

describe('keyboard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    setFastForward(false);
  });

  it('Space toggles fastForward', () => {
    mountKeyboard();
    expect(getFastForward()).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(getFastForward()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(getFastForward()).toBe(false);
  });

  it('ESC removes the topmost overlay', () => {
    mountKeyboard();
    const o = document.createElement('div');
    o.className = 'overlay-backdrop test';
    document.body.appendChild(o);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.test')).toBeNull();
  });
});
