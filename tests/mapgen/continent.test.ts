import { describe, it, expect } from 'vitest';
import { pickSeedSquare } from '../../src/game/mapgen/continent.js';
import { initBoard } from '../../src/game/mapgen/board.js';
import { createRng } from '../../src/game/rng.js';

describe('pickSeedSquare', () => {
  it('with boundary, never picks ring squares', () => {
    const sq = initBoard(true);
    const r = createRng(1);
    for (let i = 0; i < 200; i++) {
      const idx = pickSeedSquare(sq, r, true);
      const s = sq[idx]!;
      expect(s.isBoundaryWater).toBe(false);
      expect(s.x).toBeGreaterThanOrEqual(1);
      expect(s.x).toBeLessThanOrEqual(38);
      expect(s.y).toBeGreaterThanOrEqual(1);
      expect(s.y).toBeLessThanOrEqual(18);
    }
  });

  it('without boundary, can pick any open-water square', () => {
    const sq = initBoard(false);
    const r = createRng(2);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      seen.add(pickSeedSquare(sq, r, false));
    }
    // Should hit at least 100 distinct cells
    expect(seen.size).toBeGreaterThan(100);
  });

  it('skips squares already claimed by a territory', () => {
    const sq = initBoard(false);
    // Claim 5 squares
    for (let i = 0; i < 5; i++) sq[i]!.territoryId = 0;
    const r = createRng(3);
    for (let i = 0; i < 200; i++) {
      const idx = pickSeedSquare(sq, r, false);
      expect(sq[idx]!.territoryId).toBeNull();
    }
  });
});
