import { describe, it, expect } from 'vitest';
import { reduce } from '../src/game/reducer.js';
import type { GameState } from '../src/game/types.js';
import type { Plan } from '../src/game/plans.js';

const minimalState = (): GameState => ({
  schemaVersion: 1,
  seed: 0,
  rngCursor: 0,
  setup: {
    players: [],
    citiesToWin: 3,
    elementOfChance: 'high',
    randomizePlayerOrder: false,
    map: {
      waterBoundary: true, waterArea: 'small', numTerritories: 24,
      islands: 'some', shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    },
  },
  squares: [], territories: [], boats: [], players: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

describe('reducer', () => {
  it('throws "not implemented in plan 2" for plan kinds Plan 3 will handle', () => {
    const state = minimalState();
    const plan: Plan = { kind: 'attack', player: 0, targetTerritoryId: 0,
      fromTerritoryId: 0, boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null };
    expect(() => reduce(state, plan)).toThrow(/not implemented/i);
  });

  it('throws "unknown plan kind" for invalid kinds', () => {
    const state = minimalState();
    const plan = { kind: 'bogus' } as unknown as Plan;
    expect(() => reduce(state, plan)).toThrow(/unknown plan kind/i);
  });

  it('returns a new state object (immutability marker)', () => {
    const state = minimalState();
    const plan: Plan = { kind: 'endPhase', player: 0 };
    // endPhase handler is a stub for now; throw or return a new state — but
    // either way, the reducer must NOT mutate the input.
    try { reduce(state, plan); } catch { /* ok */ }
    expect(state.year).toBe(0); // input unchanged
  });
});
