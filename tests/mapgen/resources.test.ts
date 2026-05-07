import { describe, it, expect } from 'vitest';
import { placeResourcesFixed } from '../../src/game/mapgen/resources.js';
import { Code } from '../../src/game/codes.js';
import { createRng } from '../../src/game/rng.js';
import type { Territory } from '../../src/game/types.js';

function makeTerrs(n: number): Territory[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
  }));
}

describe('placeResourcesFixed', () => {
  it('places exactly N copies of each resource for "medium" with 4 players', () => {
    const terrs = makeTerrs(40);
    const r = createRng(1);
    placeResourcesFixed(terrs, 'medium', 4, r);
    const counts = new Map<number, number>();
    for (const t of terrs) {
      if (t.resource !== null) counts.set(t.resource, (counts.get(t.resource) ?? 0) + 1);
    }
    // Medium = numPlayers (4) of each, +1 extra Stable.
    expect(counts.get(Code.IRON)).toBe(4);
    expect(counts.get(Code.COAL)).toBe(4);
    expect(counts.get(Code.TREE)).toBe(4);
    expect(counts.get(Code.GOLD)).toBe(4);
    expect(counts.get(Code.STABLE)).toBe(5);
  });

  it('"low" with 3 players → 2 of each, no stable bonus', () => {
    const terrs = makeTerrs(30);
    placeResourcesFixed(terrs, 'low', 3, createRng(2));
    const counts = new Map<number, number>();
    for (const t of terrs) {
      if (t.resource !== null) counts.set(t.resource, (counts.get(t.resource) ?? 0) + 1);
    }
    expect(counts.get(Code.IRON)).toBe(2);
    expect(counts.get(Code.STABLE)).toBe(2);
  });

  it('throws if there are not enough territories to host all resources', () => {
    const terrs = makeTerrs(5); // need at least 4*5 + (1 if medium) = 21
    expect(() => placeResourcesFixed(terrs, 'medium', 4, createRng(3)))
      .toThrow(/not enough territories/i);
  });
});
