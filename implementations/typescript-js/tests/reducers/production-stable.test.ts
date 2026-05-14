import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import { Code } from '../../src/game/codes.js';
import type { GameState, Territory, GameSetup } from '../../src/game/types.js';

function injectState(territories: Partial<Territory>[], touching: boolean[][]): GameState {
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
    schemaVersion: 1, seed: 0xCAFEBABE, rngCursor: 100, setup,
    squares: [], territories: ts, touching, distance: [],
    boats: new Array(256).fill(null),
    players: [
      { id: 0, name: 'r', color: 'red', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
      { id: 1, name: 'b', color: 'blue', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
    ],
    turnOrder: [0, 1], currentPhase: 'production', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [[false, false], [false, false]],
    log: [],
  };
}

describe('production: Stable → horse', () => {
  it('places a horse on the Stable tile when it has no horse', () => {
    let state = injectState(
      [{ ownerId: 0, resource: Code.STABLE, hasHorse: false }],
      [[false]],
    );
    for (let i = 0; i < 100; i++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        expect(out.territories[0]!.hasHorse).toBe(true);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('non-skip production not found');
  });

  it('spreads to a neighbor when Stable tile already has a horse', () => {
    let state = injectState(
      [
        { ownerId: 0, resource: Code.STABLE, hasHorse: true },
        { ownerId: 0, hasHorse: false },
      ],
      [[false, true], [true, false]],
    );
    for (let i = 0; i < 100; i++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        expect(out.territories[1]!.hasHorse).toBe(true);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('non-skip production not found');
  });

  it('does not spread to enemy neighbors', () => {
    let state = injectState(
      [
        { ownerId: 0, resource: Code.STABLE, hasHorse: true },
        { ownerId: 1, hasHorse: false },
      ],
      [[false, true], [true, false]],
    );
    for (let i = 0; i < 100; i++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        expect(out.territories[1]!.hasHorse).toBe(false);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('non-skip production not found');
  });

  it('horse is lost if no friendly neighbor has space', () => {
    let state = injectState(
      [
        { ownerId: 0, resource: Code.STABLE, hasHorse: true },
        { ownerId: 0, hasHorse: true },
      ],
      [[false, true], [true, false]],
    );
    for (let i = 0; i < 100; i++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        // Both still have horse — original placement preserved, no overflow.
        expect(out.territories[0]!.hasHorse).toBe(true);
        expect(out.territories[1]!.hasHorse).toBe(true);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('non-skip production not found');
  });
});
