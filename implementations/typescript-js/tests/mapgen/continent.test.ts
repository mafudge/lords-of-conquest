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

import { isAdjacentToLand, enforceContinentConstraint } from '../../src/game/mapgen/continent.js';

describe('isAdjacentToLand', () => {
  it('returns true if any 4-neighbor has a territoryId', () => {
    const sq = initBoard(false);
    sq[5]!.territoryId = 0; // (5, 0)
    expect(isAdjacentToLand(sq, 4, 0)).toBe(true);   // west neighbor of (5,0)
    expect(isAdjacentToLand(sq, 6, 0)).toBe(true);   // east neighbor of (5,0)
    expect(isAdjacentToLand(sq, 5, 1)).toBe(true);   // south neighbor of (5,0)
    expect(isAdjacentToLand(sq, 7, 0)).toBe(false);  // not adjacent
    expect(isAdjacentToLand(sq, 5, 5)).toBe(false);  // not adjacent
  });

  it('treats edges correctly (no out-of-bounds wrap)', () => {
    const sq = initBoard(false);
    sq[0]!.territoryId = 0; // (0, 0)
    expect(isAdjacentToLand(sq, 0, 1)).toBe(true);
    expect(isAdjacentToLand(sq, 1, 0)).toBe(true);
    expect(isAdjacentToLand(sq, 39, 19)).toBe(false);
  });
});

describe('enforceContinentConstraint', () => {
  it("'lots' returns the proposed seed unchanged", () => {
    const sq = initBoard(false);
    sq[0]!.territoryId = 0;
    const r = createRng(1);
    expect(enforceContinentConstraint(sq, r, 100, 'lots', false, 1)).toBe(100);
  });

  it("'none' rerolls until adjacent to existing land (n>0)", () => {
    const sq = initBoard(false);
    sq[40]!.territoryId = 0; // (0, 1)
    const r = createRng(1);
    const idx = enforceContinentConstraint(sq, r, 999, 'none', false, 1);
    // The chosen idx must be adjacent to (0,1)
    const x = idx % 40;
    const y = Math.floor(idx / 40);
    const adjacentToSeed =
      (x === 0 && y === 0) || (x === 0 && y === 2) || (x === 1 && y === 1);
    expect(adjacentToSeed).toBe(true);
  });

  it("for n == 0 (first territory), returns proposed seed unchanged regardless of mode", () => {
    const sq = initBoard(false);
    const r = createRng(1);
    expect(enforceContinentConstraint(sq, r, 100, 'none', false, 0)).toBe(100);
  });
});
