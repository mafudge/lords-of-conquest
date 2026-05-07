import { describe, it, expect } from 'vitest';
import { getForceCount } from '../src/game/force.js';
import { Code } from '../src/game/codes.js';
import type { GameState, Territory, Player, GameSetup, Boat } from '../src/game/types.js';

function emptyState(numPlayers: number, numTerritories: number, touching: boolean[][]): GameState {
  const players: Player[] = Array.from({ length: numPlayers }, (_, i) => ({
    id: i as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    name: `P${i}`, color: 'red', persona: 'human',
    status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null,
  }));
  const territories: Territory[] = Array.from({ length: numTerritories }, (_, i) => ({
    id: i, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
  }));
  const setup: GameSetup = {
    players: players.map((p) => ({ color: p.color, name: p.name, persona: p.persona })),
    citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
    map: {
      waterBoundary: true, waterArea: 'small', numTerritories,
      islands: 'some', shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    },
  };
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0, setup,
    squares: [], territories,
    touching, distance: [],
    boats: new Array(256).fill(null), players,
    turnOrder: players.map((p) => p.id), currentPhase: 'production',
    currentPlayer: 0, year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: Array.from({ length: numPlayers }, () => new Array(numPlayers).fill(false)),
    log: [],
  };
}

describe('getForceCount', () => {
  it('unowned territory with no neighbors gives only natives', () => {
    const s = emptyState(2, 1, [[false]]);
    const fc = getForceCount(s, 0);
    expect(fc.perPlayer[7]).toBe(1); // T itself, unowned → natives
    expect(fc.perPlayer[0]).toBe(0);
    expect(fc.perPlayer[1]).toBe(0);
  });

  it('player-owned T with no neighbors and no items gives base 1', () => {
    const s = emptyState(2, 1, [[false]]);
    s.territories[0]!.ownerId = 0;
    const fc = getForceCount(s, 0);
    expect(fc.perPlayer[0]).toBe(1);
    expect(fc.perPlayer[7]).toBe(0);
  });

  it('items on T contribute: city +2, weapon +3, horse +1, boats +2 each', () => {
    const s = emptyState(2, 1, [[false]]);
    s.territories[0]!.ownerId = 0;
    s.territories[0]!.hasCity = true;
    s.territories[0]!.hasWeapon = true;
    s.territories[0]!.hasHorse = true;
    s.boats[0] = { id: 0, x: 0, y: 0, homeTerritoryId: 0, ownerId: 0, carryHorse: false, carryWeapon: false };
    s.boats[1] = { id: 1, x: 0, y: 0, homeTerritoryId: 0, ownerId: 0, carryHorse: false, carryWeapon: false };
    // Base 1 + horse 1 + city 2 + weapon 3 + 2 boats × 2 = 11
    const fc = getForceCount(s, 0);
    expect(fc.perPlayer[0]).toBe(11);
  });

  it('adjacent friendly territory contributes its base + horse + city + weapon (boats DO NOT propagate)', () => {
    const s = emptyState(2, 2, [[false, true], [true, false]]);
    s.territories[0]!.ownerId = 0;
    s.territories[1]!.ownerId = 0;
    s.territories[1]!.hasHorse = true;
    s.territories[1]!.hasWeapon = true;
    s.boats[0] = { id: 0, x: 0, y: 0, homeTerritoryId: 1, ownerId: 0, carryHorse: false, carryWeapon: false };
    // For force at T0:
    //   T0 contributes: 1 (base)  → 1
    //   T1 contributes: 1 + horse 1 + weapon 3 = 5 (boats DO NOT propagate from adjacent)
    // Total: 6
    const fc = getForceCount(s, 0);
    expect(fc.perPlayer[0]).toBe(6);
  });

  it('adjacent enemy territory contributes to that enemy player', () => {
    const s = emptyState(2, 2, [[false, true], [true, false]]);
    s.territories[0]!.ownerId = 0;
    s.territories[1]!.ownerId = 1;
    s.territories[1]!.hasWeapon = true;
    const fc = getForceCount(s, 0);
    expect(fc.perPlayer[0]).toBe(1);
    expect(fc.perPlayer[1]).toBe(1 + 3); // base + weapon
  });

  it('adjacent unowned territory adds to natives', () => {
    const s = emptyState(2, 2, [[false, true], [true, false]]);
    s.territories[0]!.ownerId = 0;
    // territories[1] is unowned
    const fc = getForceCount(s, 0);
    expect(fc.perPlayer[7]).toBe(1);
  });
});
