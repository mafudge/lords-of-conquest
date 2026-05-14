import { describe, it, expect } from 'vitest';
import { assessLakes } from '../../src/game/mapgen/lakes.js';
import { initBoard } from '../../src/game/mapgen/board.js';

describe('assessLakes', () => {
  it('annexes water regions smaller than threshold into the territory above', () => {
    const sq = initBoard(false);
    // Make a single land tile at row 1 above a 3-square pond at row 2.
    // Land at (5, 1)
    sq[1 * 40 + 5]!.territoryId = 0;
    // The 3-square pond is just (5, 2), (5, 3), (5, 4) — already water.
    // The rest of the board is also water; we need to surround it with land
    // to make it a small connected water region. Surround with a large land border:
    for (let i = 0; i < 800; i++) {
      const x = i % 40, y = Math.floor(i / 40);
      // Mark everything except the pond and (5,1) as a separate territory 99
      const isPond = x === 5 && (y >= 2 && y <= 4);
      if (!isPond && sq[i]!.territoryId === null) sq[i]!.territoryId = 99;
    }
    // Re-clear the seed so (5,1) stays in territory 0.
    sq[1 * 40 + 5]!.territoryId = 0;
    assessLakes(sq, 9);
    // The pond (3 squares < 9) should be annexed to territory 0 (the row above)
    expect(sq[2 * 40 + 5]!.territoryId).toBe(0);
    expect(sq[3 * 40 + 5]!.territoryId).toBe(0);
    expect(sq[4 * 40 + 5]!.territoryId).toBe(0);
  });

  it('numbers water regions of size >= threshold as lakes (lakeId set)', () => {
    const sq = initBoard(false);
    // Mark a thin land border around a 5x4=20 sq water pond
    for (let y = 0; y < 20; y++) for (let x = 0; x < 40; x++) {
      const inPond = x >= 10 && x <= 14 && y >= 5 && y <= 8;
      if (!inPond) sq[y * 40 + x]!.territoryId = 99;
    }
    assessLakes(sq, 9);
    for (let y = 5; y <= 8; y++) for (let x = 10; x <= 14; x++) {
      expect(sq[y * 40 + x]!.lakeId).not.toBeNull();
      expect(sq[y * 40 + x]!.territoryId).toBeNull();
    }
    // All 20 cells share the same lakeId
    const ids = new Set(
      [5,6,7,8].flatMap((y) => [10,11,12,13,14].map((x) => sq[y*40+x]!.lakeId)),
    );
    expect(ids.size).toBe(1);
  });
});
