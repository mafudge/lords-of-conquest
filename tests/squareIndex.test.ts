import { describe, it, expect } from 'vitest';
import { sqIndex, sqXY, NEIGHBOR_OFFSETS } from '../src/game/types.js';

describe('square indexing', () => {
  it('sqIndex(x, y) = y * GRID_WIDTH + x', () => {
    expect(sqIndex(0, 0)).toBe(0);
    expect(sqIndex(39, 0)).toBe(39);
    expect(sqIndex(0, 1)).toBe(40);
    expect(sqIndex(5, 3)).toBe(125);
  });

  it('sqXY is the inverse of sqIndex', () => {
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 40; x++) {
        const i = sqIndex(x, y);
        expect(sqXY(i)).toEqual({ x, y });
      }
    }
  });

  it('NEIGHBOR_OFFSETS has 4 cardinal directions in clockwise order from East', () => {
    // E, S, W, N
    expect(NEIGHBOR_OFFSETS).toEqual([
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 },
    ]);
  });
});
