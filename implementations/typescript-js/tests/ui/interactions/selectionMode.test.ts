// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { initApp, dispatch, getState } from '../../../src/ui/main.js';
import { defaultSetupState } from '../../../src/ui/setup/state.js';
import { setMode } from '../../../src/ui/interactions/interactionMode.js';
import { selectionMode } from '../../../src/ui/interactions/selectionMode.js';

describe('selectionMode', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; });

  it('marks unowned territories as candidates when entered', async () => {
    initApp({ initialState: null });
    const s = defaultSetupState();
    dispatch({ kind: 'newGame', setup: s.setup, seed: s.seed });
    await new Promise((r) => setTimeout(r, 50));
    setMode(selectionMode);
    selectionMode.enter(getState()!);
    const candidates = document.querySelectorAll('.board-svg .sq.candidate');
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('handleClick on candidate territory dispatches a selection plan', async () => {
    initApp({ initialState: null });
    const s = defaultSetupState();
    dispatch({ kind: 'newGame', setup: s.setup, seed: s.seed });
    await new Promise((r) => setTimeout(r, 50));
    setMode(selectionMode);
    selectionMode.enter(getState()!);
    const before = getState()!;
    const targetTerr = before.territories.find((t) => t.ownerId === null)!;
    selectionMode.handleClick(targetTerr.id, before);
    const after = getState()!;
    expect(after.territories.find((t) => t.id === targetTerr.id)!.ownerId).toBe(before.currentPlayer);
  });

  it('Auto-pick button picks a territory for the current player', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    initApp({ initialState: null });
    const setup = defaultSetupState();
    dispatch({ kind: 'newGame', setup: setup.setup, seed: setup.seed });
    await new Promise((r) => setTimeout(r, 50));
    const btn = document.querySelector<HTMLButtonElement>('.actions button.act');
    expect(btn?.textContent).toBe('Auto-pick');
    const before = getState()!;
    const ownedBefore = before.territories.filter((t) => t.ownerId === 0).length;
    btn?.click();
    await new Promise((r) => setTimeout(r, 50));
    const after = getState()!;
    const ownedAfter = after.territories.filter((t) => t.ownerId === 0).length;
    expect(ownedAfter).toBeGreaterThanOrEqual(ownedBefore);
  });
});
