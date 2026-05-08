// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderShell } from '../../../src/ui/render/shell.js';

describe('renderShell', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; });

  it('mounts a top bar, a board host, and a bottom bar', () => {
    renderShell(document.getElementById('app')!);
    expect(document.querySelector('.top-bar')).not.toBeNull();
    expect(document.querySelector('.board-host')).not.toBeNull();
    expect(document.querySelector('.bottom-bar')).not.toBeNull();
  });

  it('top bar has slots for left/center/right', () => {
    renderShell(document.getElementById('app')!);
    expect(document.querySelector('.top-bar .top-left')).not.toBeNull();
    expect(document.querySelector('.top-bar .top-center')).not.toBeNull();
    expect(document.querySelector('.top-bar .top-right')).not.toBeNull();
  });

  it('bottom bar has slots for pills and actions', () => {
    renderShell(document.getElementById('app')!);
    expect(document.querySelector('.bottom-bar .pills')).not.toBeNull();
    expect(document.querySelector('.bottom-bar .actions')).not.toBeNull();
  });

  it('is idempotent (calling twice does not duplicate)', () => {
    const root = document.getElementById('app')!;
    renderShell(root);
    renderShell(root);
    expect(document.querySelectorAll('.top-bar')).toHaveLength(1);
  });
});
