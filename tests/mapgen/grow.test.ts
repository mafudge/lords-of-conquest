import { describe, it, expect } from 'vitest';
import { growOnce } from '../../src/game/mapgen/grow.js';
import { initBoard } from '../../src/game/mapgen/board.js';
import { createRng } from '../../src/game/rng.js';

describe('growOnce (regular)', () => {
  it('extends the territory by one square in a cardinal direction', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0; // seed at (20, 2)
    const r = createRng(1);
    const grew = growOnce(sq, r, 0, 'regular');
    expect(grew).toBe(true);
    // Count squares now claimed by territory 0
    const claimed = sq.filter((s) => s.territoryId === 0);
    expect(claimed).toHaveLength(2);
  });

  it('returns false when no growable square exists', () => {
    const sq = initBoard(false);
    // Single seed surrounded by other territories
    sq[100]!.territoryId = 0;
    sq[99]!.territoryId = 1;   // west
    sq[101]!.territoryId = 1;  // east
    sq[60]!.territoryId = 1;   // north
    sq[140]!.territoryId = 1;  // south
    const r = createRng(2);
    expect(growOnce(sq, r, 0, 'regular')).toBe(false);
  });

  it('does not pick boundary-water squares', () => {
    const sq = initBoard(true);
    sq[41]!.territoryId = 0; // (1, 1) — adjacent to boundary on west and north
    const r = createRng(3);
    growOnce(sq, r, 0, 'regular');
    const claimed = sq.filter((s) => s.territoryId === 0);
    for (const s of claimed) {
      expect(s.isBoundaryWater).toBe(false);
    }
  });
});
