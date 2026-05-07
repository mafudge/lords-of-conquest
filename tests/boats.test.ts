import { describe, it, expect } from 'vitest';
import { addBoat, findFreeBoatSlot } from '../src/game/boats.js';
import type { GameState, Territory } from '../src/game/types.js';

function emptyStateWithTerritories(numTerritories: number, lakesPerTerr: number[]): GameState {
  const territories: Territory[] = Array.from({ length: numTerritories }, (_, i) => ({
    id: i, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(Array.from({ length: lakesPerTerr[i] ?? 0 }, (_, k) => k)),
    citiesAdjacent: 0,
  }));
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: [{ color: 'red', name: 'r', persona: 'human' }, { color: 'blue', name: 'b', persona: 'human' }],
      citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories, touching: [], distance: [],
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

describe('boat pool', () => {
  it('findFreeBoatSlot returns 0 for an empty pool', () => {
    const s = emptyStateWithTerritories(2, [1, 1]);
    expect(findFreeBoatSlot(s.boats)).toBe(0);
  });

  it('findFreeBoatSlot finds the next null slot', () => {
    const s = emptyStateWithTerritories(2, [1, 1]);
    s.boats[0] = { id: 0, x: 0, y: 0, homeTerritoryId: 0, ownerId: 0, carryHorse: false, carryWeapon: false };
    s.boats[1] = { id: 1, x: 0, y: 0, homeTerritoryId: 0, ownerId: 0, carryHorse: false, carryWeapon: false };
    expect(findFreeBoatSlot(s.boats)).toBe(2);
  });

  it('findFreeBoatSlot returns -1 (dock strike) when pool is full', () => {
    const s = emptyStateWithTerritories(2, [1, 1]);
    for (let i = 0; i < 256; i++) {
      s.boats[i] = { id: i, x: 0, y: 0, homeTerritoryId: 0, ownerId: 0, carryHorse: false, carryWeapon: false };
    }
    expect(findFreeBoatSlot(s.boats)).toBe(-1);
  });

  it('addBoat returns -1 if territory does not border the requested lake', () => {
    const s = emptyStateWithTerritories(2, [1, 1]);
    expect(addBoat(s, 0, 99, 0).kind).toBe('landlocked');
  });

  it('addBoat returns -3 (dock strike) when pool is exhausted', () => {
    const s = emptyStateWithTerritories(2, [1, 1]);
    for (let i = 0; i < 256; i++) {
      s.boats[i] = { id: i, x: 0, y: 0, homeTerritoryId: 0, ownerId: 0, carryHorse: false, carryWeapon: false };
    }
    expect(addBoat(s, 0, 0, 0).kind).toBe('dockStrike');
  });

  it('addBoat returns ok with new slot id on success', () => {
    const s = emptyStateWithTerritories(2, [1, 1]);
    const result = addBoat(s, 0, 0, 0);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.boatId).toBe(0);
      expect(result.boats[0]).toMatchObject({
        id: 0, homeTerritoryId: 0, ownerId: 0, carryHorse: false, carryWeapon: false,
      });
    }
  });
});
