// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { serializeState, deserializeState } from '../../../src/ui/platform/persistence.js';
import type { GameState } from '../../../src/game/types.js';

function fixtureState(): GameState {
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: [{ color: 'red', name: 'r', persona: 'aggressive' }],
      citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories: [
      { id: 0, ownerId: 0, resource: null, hasResourceDouble: false,
        hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
        squares: [], bordersLakes: new Set([1, 2]), citiesAdjacent: 0 } as any,
    ],
    touching: [], distance: [], boats: [],
    players: [{ id: 0, name: 'r', color: 'red', persona: 'aggressive', status: 'playing',
      stockpile: [0,0,0,0,0], stockpileLocation: null }],
    turnOrder: [0], currentPhase: 'production', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [false],
    pendingTrade: null,
    pendingCombat: {
      attackerId: 0, defenderId: 1, fromTerritoryId: 0, targetTerritoryId: 0,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
      alliesDecisions: ['neutral'], alliesPending: new Set([2, 3]),
      attackerStrength: 1, defenderStrength: 1,
      resolved: false, attackerWon: false,
    } as any,
    rejectedTrades: [], autoReject: [], log: [],
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('serializeState / deserializeState', () => {
  it('round-trips Set fields back to Set instances', () => {
    const s = fixtureState();
    const json = serializeState(s);
    const back = deserializeState(json);
    expect(back.territories[0]!.bordersLakes).toBeInstanceOf(Set);
    expect([...back.territories[0]!.bordersLakes]).toEqual([1, 2]);
    expect(back.pendingCombat!.alliesPending).toBeInstanceOf(Set);
    expect([...back.pendingCombat!.alliesPending]).toEqual([2, 3]);
  });

  it('returns valid JSON', () => {
    const s = fixtureState();
    expect(() => JSON.parse(serializeState(s))).not.toThrow();
  });
});

describe('autosave', () => {
  it('writes to localStorage["loc:save:autosave"] after debounce', async () => {
    const { autosave, loadAutosave } = await import('../../../src/ui/platform/persistence.js');
    const s = fixtureState();
    autosave(s);
    await new Promise((r) => setTimeout(r, 600));
    const restored = loadAutosave();
    expect(restored).not.toBeNull();
    expect(restored!.year).toBe(s.year);
  });

  it('schemaVersion mismatch refuses to load', async () => {
    const { loadAutosave } = await import('../../../src/ui/platform/persistence.js');
    localStorage.setItem('loc:save:autosave', JSON.stringify({
      schemaVersion: 999, savedAt: new Date().toISOString(), state: fixtureState(),
    }));
    expect(loadAutosave()).toBeNull();
  });
});
