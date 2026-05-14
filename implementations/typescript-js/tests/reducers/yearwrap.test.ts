import { describe, it, expect } from 'vitest';
import { applyYearWrap } from '../../src/game/reducers/yearWrap.js';
import type { GameState, Territory } from '../../src/game/types.js';

function makeState(turnOrder: number[], terrOwners: Array<number | null>): GameState {
  const territories: Territory[] = terrOwners.map((own, id) => ({
    id, ownerId: own as 0 | 1 | 2 | 3 | 4 | 5 | 6 | null,
    resource: null, hasCity: false, hasWeapon: false, hasHorse: false,
    hasStockpile: false, hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
  }));
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: turnOrder.map((_, i) => ({
        color: (['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const)[i]!,
        name: `p${i}`, persona: 'human',
      })),
      citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: territories.length,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories, touching: [], distance: [],
    boats: [], players: turnOrder.map((_, i) => ({
      id: i as 0 | 1 | 2 | 3 | 4 | 5 | 6, name: `p${i}`,
      color: (['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const)[i]!,
      persona: 'human', status: 'playing',
      stockpile: [0, 0, 0, 0, 0], stockpileLocation: null,
    })),
    turnOrder: turnOrder as Array<0 | 1 | 2 | 3 | 4 | 5 | 6>,
    currentPhase: 'development', currentPlayer: turnOrder[0]! as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    year: 1, attackNumber: 1, shipmentUsed: false,
    shipmentForfeitsSecondAttack: [true, false, true],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [{ trader: 0, tradee: 1, tradeKey: 'k', count: 2 }],
    autoReject: [[false, true, false], [true, false, false], [false, false, false]],
    log: [],
  };
}

describe('applyYearWrap', () => {
  it('rotates turnOrder by 1 (last → first)', () => {
    const s = makeState([0, 1, 2], [0, 1, 2, 0, 1, 2]);
    const out = applyYearWrap(s);
    expect(out.turnOrder).toEqual([2, 0, 1]);
    expect(out.currentPlayer).toBe(2);
  });

  it('eliminates players with no territories', () => {
    const s = makeState([0, 1, 2], [0, 0, 0, 1, 1]);
    const out = applyYearWrap(s);
    expect(out.players[2]!.status).toBe('eliminated');
    expect(out.turnOrder).not.toContain(2);
  });

  it('increments year', () => {
    const s = makeState([0, 1, 2], [0, 1, 2]);
    const out = applyYearWrap(s);
    expect(out.year).toBe(s.year + 1);
  });

  it('clears year-scoped state', () => {
    const s = makeState([0, 1, 2], [0, 1, 2]);
    const out = applyYearWrap(s);
    expect(out.rejectedTrades).toEqual([]);
    expect(out.autoReject).toEqual([[false, false, false], [false, false, false], [false, false, false]]);
    expect(out.shipmentForfeitsSecondAttack).toEqual([false, false, false]);
  });

  it('transitions to production phase, attackNumber 1, no pending combat', () => {
    const s = makeState([0, 1, 2], [0, 1, 2]);
    const out = applyYearWrap(s);
    expect(out.currentPhase).toBe('production');
    expect(out.attackNumber).toBe(1);
    expect(out.shipmentUsed).toBe(false);
    expect(out.pendingCombat).toBeNull();
  });
});
