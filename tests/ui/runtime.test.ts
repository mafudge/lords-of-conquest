// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { initApp, dispatch, getState } from '../../src/ui/main.js';
import { startRuntime, stopRuntime } from '../../src/ui/runtime.js';
import { defaultSetupState } from '../../src/ui/setup/state.js';

describe('runtime tick loop', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    stopRuntime();
  });

  it('advances all-AI selection automatically', async () => {
    initApp({ initialState: null });
    const s = defaultSetupState();
    s.setup.players = s.setup.players.map((p) => ({ ...p, persona: 'aggressive' as const }));
    dispatch({ kind: 'newGame', setup: s.setup, seed: s.seed });
    startRuntime();
    // Allow ticks
    await new Promise((r) => setTimeout(r, 1000));
    const after = getState()!;
    expect(after.territories.filter((t) => t.ownerId !== null).length).toBeGreaterThan(0);
    stopRuntime();
  });
});
