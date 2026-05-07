import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import { Code } from '../../src/game/codes.js';
import { playersNeedingStockpileLocation } from '../../src/game/reducers/production.js';
import type { GameState, Territory, GameSetup } from '../../src/game/types.js';

function injectState(territories: Partial<Territory>[]): GameState {
  const setup: GameSetup = {
    players: [{ color: 'red', name: 'r', persona: 'human' }, { color: 'blue', name: 'b', persona: 'human' }],
    citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
    map: { waterBoundary: true, waterArea: 'small', numTerritories: territories.length, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
  };
  const ts: Territory[] = territories.map((t, i) => ({
    id: i, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
    ...t,
  }));
  return {
    schemaVersion: 1, seed: 0xBEEF1234, rngCursor: 100, setup,
    squares: [], territories: ts, touching: ts.map(() => ts.map(() => false)), distance: [],
    boats: new Array(256).fill(null),
    players: [
      { id: 0, name: 'r', color: 'red', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
      { id: 1, name: 'b', color: 'blue', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
    ],
    turnOrder: [0, 1], currentPhase: 'production', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: false,
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [[false, false], [false, false]],
    log: [],
  };
}

describe('playersNeedingStockpileLocation', () => {
  it('returns players who own land, have a non-empty stockpile, but no stockpileLocation', () => {
    let state = injectState([
      { ownerId: 0, resource: Code.IRON },
      { ownerId: 1, resource: Code.GOLD },
    ]);
    for (let i = 0; i < 100; i++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        const need = playersNeedingStockpileLocation(out);
        expect(need.sort()).toEqual([0, 1]);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('non-skip production not found');
  });

  it('does not include players whose stockpile is still empty', () => {
    let state = injectState([
      { ownerId: 0 /* no resource */ },
      { ownerId: 1, resource: Code.GOLD },
    ]);
    for (let i = 0; i < 100; i++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        const need = playersNeedingStockpileLocation(out);
        expect(need).toEqual([1]);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('non-skip production not found');
  });

  it('does not include players who already have stockpileLocation set', () => {
    let state = injectState([
      { ownerId: 0, resource: Code.IRON },
    ]);
    state.players[0]!.stockpileLocation = 0;
    state.territories[0]!.hasStockpile = true;
    for (let i = 0; i < 100; i++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        const need = playersNeedingStockpileLocation(out);
        expect(need).toEqual([]);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('non-skip production not found');
  });
});
