// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { initApp, getState } from '../../src/ui/main.js';

describe('main render loop', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('initApp mounts an app shell into #app', () => {
    initApp({ initialState: null });
    const app = document.getElementById('app')!;
    expect(app.innerHTML.length).toBeGreaterThan(0);
  });

  it('getState returns null before any dispatch', () => {
    initApp({ initialState: null });
    expect(getState()).toBeNull();
  });
});
