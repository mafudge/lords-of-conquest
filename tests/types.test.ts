import { describe, it, expect } from 'vitest';
import type { Square, Territory, MapParams, Board } from '../src/game/types.js';
import { Code } from '../src/game/codes.js';

describe('types', () => {
  it('Square accepts the expected shape', () => {
    const s: Square = {
      x: 5, y: 7, territoryId: 0, lakeId: null, isBoundaryWater: false,
    };
    expect(s.x).toBe(5);
  });

  it('Territory accepts the expected shape', () => {
    const t: Territory = {
      id: 0,
      ownerId: null,
      resource: Code.IRON,
      hasCity: false,
      hasWeapon: false,
      hasHorse: false,
      hasStockpile: false,
      hasResourceDouble: false,
      squares: [0, 1, 2],
      bordersLakes: new Set<number>(),
      citiesAdjacent: 0,
    };
    expect(t.id).toBe(0);
  });

  it('MapParams has all expected fields', () => {
    const p: MapParams = {
      waterBoundary: true,
      waterArea: 'small',
      numTerritories: 24,
      islands: 'some',
      shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    };
    expect(p.numTerritories).toBe(24);
  });

  it('Board has squares, territories, touching, and distance', () => {
    const b: Board = { squares: [], territories: [], touching: [], distance: [] };
    expect(b.squares).toHaveLength(0);
    expect(b.touching).toHaveLength(0);
    expect(b.distance).toHaveLength(0);
  });
});
