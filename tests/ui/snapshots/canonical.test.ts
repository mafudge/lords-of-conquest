// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { initApp, dispatch, getState } from '../../../src/ui/main.js';
import { stopRuntime } from '../../../src/ui/runtime.js';
import { defaultSetupState } from '../../../src/ui/setup/state.js';

describe('canonical state snapshots', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    stopRuntime();
  });

  it('post-newGame: shell + board mounted', async () => {
    initApp({ initialState: null });
    const setup = defaultSetupState();
    dispatch({ kind: 'newGame', setup: setup.setup, seed: 12345 });
    await new Promise((r) => setTimeout(r, 50));
    const html = document.getElementById('app')!.innerHTML;
    expect(html).toContain('top-bar');
    expect(html).toContain('board-svg');
    expect(html).toContain('bottom-bar');
    expect(document.querySelectorAll('.board-svg .sq').length).toBe(800);
  });

  it('selection mid-draft: at least one territory owned', async () => {
    initApp({ initialState: null });
    const setup = defaultSetupState();
    setup.setup.players = setup.setup.players.map((p) => ({ ...p, persona: 'aggressive' as const }));
    dispatch({ kind: 'newGame', setup: setup.setup, seed: 12345 });
    const cur = getState()!;
    const free = cur.territories.find((t) => t.ownerId === null)!;
    dispatch({ kind: 'selection', player: 0, territoryId: free.id });
    await new Promise((r) => setTimeout(r, 50));
    const after = getState()!;
    expect(after.territories.find((t) => t.ownerId !== null)).toBeDefined();
  });
});
