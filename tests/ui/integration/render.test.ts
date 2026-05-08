// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { initApp, dispatch } from '../../../src/ui/main.js';
import { defaultSetupState } from '../../../src/ui/setup/state.js';

describe('top-level render after newGame', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; });

  it('initApp + newGame renders shell with top bar, board, bottom bar', async () => {
    initApp({ initialState: null });
    const setup = defaultSetupState();
    dispatch({ kind: 'newGame', setup: setup.setup, seed: setup.seed });
    // Wait for rAF (happy-dom approximates with setTimeout)
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('.top-bar')).not.toBeNull();
    expect(document.querySelector('.board-svg')).not.toBeNull();
    expect(document.querySelectorAll('.pills .pill').length).toBeGreaterThan(0);
  });
});
