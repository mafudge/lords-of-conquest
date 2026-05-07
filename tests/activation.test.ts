import { describe, it, expect } from 'vitest';
import { recomputeResourceDoubles } from '../src/game/activation.js';
import { Code } from '../src/game/codes.js';
import type { GameState, Territory } from '../src/game/types.js';

function makeState(touching: boolean[][], territories: Partial<Territory>[]): GameState {
  const ts: Territory[] = territories.map((t, i) => ({
    id: i, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
    ...t,
  }));
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: [{ color: 'red', name: 'r', persona: 'human' }, { color: 'blue', name: 'b', persona: 'human' }],
      citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: ts.length, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories: ts, touching, distance: [],
    boats: new Array(256).fill(null),
    players: [],
    turnOrder: [], currentPhase: 'production', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false,
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  };
}

describe('recomputeResourceDoubles', () => {
  it('city on a resource tile activates its own resource', () => {
    const s = makeState([[false]], [{ ownerId: 0, resource: Code.IRON, hasCity: true }]);
    const out = recomputeResourceDoubles(s);
    expect(out.territories[0]!.hasResourceDouble).toBe(true);
  });

  it('city on adjacent friendly tile activates a resource', () => {
    const s = makeState(
      [[false, true], [true, false]],
      [
        { ownerId: 0, resource: Code.IRON },
        { ownerId: 0, hasCity: true },
      ],
    );
    const out = recomputeResourceDoubles(s);
    expect(out.territories[0]!.hasResourceDouble).toBe(true);
  });

  it('city on adjacent ENEMY tile does NOT activate', () => {
    const s = makeState(
      [[false, true], [true, false]],
      [
        { ownerId: 0, resource: Code.IRON },
        { ownerId: 1, hasCity: true },
      ],
    );
    const out = recomputeResourceDoubles(s);
    expect(out.territories[0]!.hasResourceDouble).toBe(false);
  });

  it('Stable (code 4) is excluded from doubling', () => {
    const s = makeState([[false]], [{ ownerId: 0, resource: Code.STABLE, hasCity: true }]);
    const out = recomputeResourceDoubles(s);
    expect(out.territories[0]!.hasResourceDouble).toBe(false);
  });

  it('Gold (code 3) IS included (per spec note)', () => {
    const s = makeState([[false]], [{ ownerId: 0, resource: Code.GOLD, hasCity: true }]);
    const out = recomputeResourceDoubles(s);
    expect(out.territories[0]!.hasResourceDouble).toBe(true);
  });

  it('clears double flag when city is destroyed', () => {
    const s = makeState([[false]], [{ ownerId: 0, resource: Code.IRON, hasCity: true, hasResourceDouble: true }]);
    s.territories[0]!.hasCity = false;
    const out = recomputeResourceDoubles(s);
    expect(out.territories[0]!.hasResourceDouble).toBe(false);
  });
});
