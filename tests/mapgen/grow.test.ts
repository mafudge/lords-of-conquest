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

import { growToBudget } from '../../src/game/mapgen/grow.js';

describe('growToBudget', () => {
  it('grows the territory to roughly the budget on an open board', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;
    const r = createRng(7);
    const placed = growToBudget(sq, r, 0, 'regular', 12);
    expect(placed).toBeGreaterThanOrEqual(11); // 1 seed + ~11 growth
    expect(placed).toBeLessThanOrEqual(13);
    expect(sq.filter((s) => s.territoryId === 0)).toHaveLength(placed);
  });

  it('stops early if no growable parts remain', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;
    sq[99]!.territoryId = 1;   sq[101]!.territoryId = 1;
    sq[60]!.territoryId = 1;   sq[140]!.territoryId = 1;
    const r = createRng(8);
    expect(growToBudget(sq, r, 0, 'regular', 50)).toBe(1);
  });
});

describe('growOnce (irregular)', () => {
  it('jumps 2 squares in same direction when possible (so square count grows by 2)', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;  // seed at (20, 2)
    const r = createRng(0xBEEF);
    let beforeCount = 1;
    let afterCount = 1;
    // Run several growth steps; in irregular mode some should add 2 squares.
    let sawJump = false;
    for (let i = 0; i < 30; i++) {
      const before = sq.filter((s) => s.territoryId === 0).length;
      growOnce(sq, r, 0, 'irregular');
      const after = sq.filter((s) => s.territoryId === 0).length;
      if (after - before === 2) sawJump = true;
    }
    expect(sawJump).toBe(true);
  });
});
