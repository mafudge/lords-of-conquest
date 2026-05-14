import { describe, it, expect } from 'vitest';
import { listAllyCandidates } from '../src/game/combat.js';
import type { GameState, Territory } from '../src/game/types.js';

function makeState(
  players: number,
  ownersByTerritory: Array<number | null>,
): GameState {
  const territories: Territory[] = ownersByTerritory.map((own, id) => ({
    id, ownerId: own as 0 | 1 | 2 | 3 | 4 | 5 | 6 | null,
    resource: null, hasCity: false, hasWeapon: false, hasHorse: false,
    hasStockpile: false, hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
  }));
  const n = territories.length;
  const touching: boolean[][] = Array.from(
    { length: n }, (_, i) => Array.from({ length: n }, (_, j) => i !== j));
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: Array.from({ length: players }, (_, i) => ({
        color: (['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const)[i]!,
        name: `p${i}`, persona: 'human',
      })),
      citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: n,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories, touching, distance: [],
    boats: [], players: Array.from({ length: players }, (_, i) => ({
      id: i as 0 | 1 | 2 | 3 | 4 | 5 | 6, name: `p${i}`,
      color: (['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const)[i]!,
      persona: 'human', status: 'playing',
      stockpile: [0, 0, 0, 0, 0], stockpileLocation: null,
    })),
    turnOrder: Array.from({ length: players }, (_, i) => i as 0 | 1 | 2 | 3 | 4 | 5 | 6),
    currentPhase: 'conquest', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  };
}

describe('listAllyCandidates', () => {
  it('finds third-party players with adjacent forces', () => {
    const s = makeState(4, [1, 2, 3, 0]);
    const allies = listAllyCandidates(s, 0, 1, 0);
    expect(allies).toEqual(new Set([2, 3]));
  });

  it('excludes attacker and defender even if they have force', () => {
    const s = makeState(3, [1, 0, 2]);
    const allies = listAllyCandidates(s, 0, 1, 0);
    expect(allies).toEqual(new Set([2]));
  });

  it('excludes eliminated players', () => {
    const s = makeState(3, [1, 0, 2]);
    s.players[2]!.status = 'eliminated';
    const allies = listAllyCandidates(s, 0, 1, 0);
    expect(allies).toEqual(new Set());
  });

  it('handles unowned target (defenderId null)', () => {
    const s = makeState(3, [null, 0, 2]);
    const allies = listAllyCandidates(s, 0, null, 0);
    expect(allies).toEqual(new Set([2]));
  });
});
