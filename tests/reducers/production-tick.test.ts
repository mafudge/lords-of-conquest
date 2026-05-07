import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import { Code } from '../../src/game/codes.js';
import type { GameState, Territory, GameSetup } from '../../src/game/types.js';

// Inject a state directly (skip mapgen) so we can pin specific resources.
function injectState(territories: Partial<Territory>[]): GameState {
  const setup: GameSetup = {
    players: [
      { color: 'red', name: 'r', persona: 'human' },
      { color: 'blue', name: 'b', persona: 'human' },
    ],
    citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
    map: {
      waterBoundary: true, waterArea: 'small', numTerritories: territories.length,
      islands: 'some', shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    },
  };
  const ts: Territory[] = territories.map((t, i) => ({
    id: i, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
    ...t,
  }));
  return {
    schemaVersion: 1, seed: 0xC0FFEE, rngCursor: 100, // jump past skip roll
    setup,
    squares: [], territories: ts, touching: [], distance: [],
    boats: new Array(256).fill(null),
    players: [
      { id: 0, name: 'r', color: 'red', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
      { id: 1, name: 'b', color: 'blue', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
    ],
    turnOrder: [0, 1], currentPhase: 'production', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false,
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [[false, false], [false, false]],
    log: [],
  };
}

// Pick a seed where the skip-roll DOES NOT fire. We can verify by inspecting
// the result of `nextFloat({seed:0xC0FFEE, cursor:100})` — but easier: keep
// trying cursors until skipRoll >= 1/6.

describe('production tick', () => {
  it('yields +1 to each resource on owned territories', () => {
    const s = injectState([
      { ownerId: 0, resource: Code.IRON },
      { ownerId: 0, resource: Code.GOLD },
      { ownerId: 1, resource: Code.COAL },
    ]);
    // Use a seed that doesn't trigger skip on the first roll. seed=0xC0FFEE
    // cursor=100 might skip — try several cursors and find a non-skip one.
    let state = s;
    for (let attempts = 0; attempts < 100; attempts++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        // Did not skip. Verify yields.
        expect(out.players[0]!.stockpile[Code.IRON]).toBe(1);
        expect(out.players[0]!.stockpile[Code.GOLD]).toBe(1);
        expect(out.players[1]!.stockpile[Code.COAL]).toBe(1);
        return;
      }
      // Try with a different starting cursor to dodge the skip
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('Could not find a non-skip production roll in 100 attempts');
  });

  it('yields +2 when hasResourceDouble is true', () => {
    let state = injectState([
      { ownerId: 0, resource: Code.IRON, hasResourceDouble: true },
    ]);
    for (let attempts = 0; attempts < 100; attempts++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        expect(out.players[0]!.stockpile[Code.IRON]).toBe(2);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('Could not find a non-skip production roll');
  });

  it('does not yield from unowned territories', () => {
    let state = injectState([{ ownerId: null, resource: Code.IRON }]);
    for (let attempts = 0; attempts < 100; attempts++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        expect(out.players[0]!.stockpile[Code.IRON]).toBe(0);
        expect(out.players[1]!.stockpile[Code.IRON]).toBe(0);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('Could not find a non-skip production roll');
  });

  it('Stable (code 4) does NOT yield to the stockpile via this path', () => {
    let state = injectState([{ ownerId: 0, resource: Code.STABLE }]);
    for (let attempts = 0; attempts < 100; attempts++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        // Slot 4 may be incremented later (Task 15: addHorse via stockpile);
        // for the per-resource tick, slot 4 stays at 0.
        expect(out.players[0]!.stockpile[Code.STABLE]).toBe(0);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('Could not find a non-skip production roll');
  });
});
