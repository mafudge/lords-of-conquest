import { describe, it, expect } from 'vitest';
import { checkEndOfGame } from '../src/game/checkEndOfGame.js';
import type { GameState, Territory } from '../src/game/types.js';

function stateWith(territoryOwners: Array<number | null>, cities: number[]): GameState {
  const territories: Territory[] = territoryOwners.map((own, id) => ({
    id, ownerId: own as 0 | 1 | 2 | 3 | 4 | 5 | 6 | null,
    resource: null, hasCity: false, hasWeapon: false, hasHorse: false,
    hasStockpile: false, hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
  }));
  for (let p = 0; p < cities.length; p++) {
    let placed = 0;
    for (const t of territories) {
      if (t.ownerId !== p) continue;
      if (placed >= cities[p]!) break;
      t.hasCity = true;
      placed++;
    }
  }
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: cities.map((_, i) => ({
        color: (['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const)[i]!,
        name: `p${i}`, persona: 'human',
      })),
      citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: territories.length,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories, touching: [], distance: [],
    boats: [], players: cities.map((_, i) => ({
      id: i as 0 | 1 | 2 | 3 | 4 | 5 | 6, name: `p${i}`,
      color: (['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const)[i]!,
      persona: 'human', status: 'playing',
      stockpile: [0, 0, 0, 0, 0], stockpileLocation: null,
    })),
    turnOrder: cities.map((_, i) => i as 0 | 1 | 2 | 3 | 4 | 5 | 6),
    currentPhase: 'development', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  };
}

describe('checkEndOfGame', () => {
  it('returns null when no player meets citiesToWin', () => {
    const s = stateWith([0, 0, 1, 1, 2], [2, 1, 0]);
    expect(checkEndOfGame(s)).toBeNull();
  });

  it('returns winner when one player has citiesToWin and is unique max', () => {
    const owners = [0, 0, 0, 0, 0, 1, 1];
    const s = stateWith(owners, [5, 1, 0]);
    expect(checkEndOfGame(s)).toBe(0);
  });

  it('returns null when tied at top (even if both reach citiesToWin)', () => {
    const owners = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1];
    const s = stateWith(owners, [5, 5, 0]);
    expect(checkEndOfGame(s)).toBeNull();
  });

  it('returns winner when one player owns all territories', () => {
    const owners = [0, 0, 0, 0, 0];
    const s = stateWith(owners, [0, 0, 0]);
    expect(checkEndOfGame(s)).toBe(0);
  });

  it('returns null when not all territories owned by same player and no city-winner', () => {
    const owners = [0, 0, 1, 1];
    const s = stateWith(owners, [1, 1]);
    expect(checkEndOfGame(s)).toBeNull();
  });
});
