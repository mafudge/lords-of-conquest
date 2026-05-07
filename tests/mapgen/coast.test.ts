import { describe, it, expect } from 'vitest';
import { computeBordersLakes } from '../../src/game/mapgen/coast.js';
import { initBoard } from '../../src/game/mapgen/board.js';

describe('computeBordersLakes', () => {
  it('attaches each lake id to every territory whose square borders it', () => {
    const sq = initBoard(false);
    // Land at (10, 5) and (12, 5); water (lake 0) between at (11, 5).
    sq[5 * 40 + 10]!.territoryId = 0;
    sq[5 * 40 + 12]!.territoryId = 1;
    sq[5 * 40 + 11]!.lakeId = 0;
    const result = computeBordersLakes(sq, 2);
    expect([...result[0]!]).toEqual([0]);
    expect([...result[1]!]).toEqual([0]);
  });

  it('a territory not touching any lake has empty set', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;
    const result = computeBordersLakes(sq, 1);
    expect(result[0]!.size).toBe(0);
  });
});
