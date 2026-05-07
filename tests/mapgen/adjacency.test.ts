import { describe, it, expect } from 'vitest';
import { buildTouching } from '../../src/game/mapgen/adjacency.js';
import { initBoard } from '../../src/game/mapgen/board.js';

describe('buildTouching', () => {
  it('two land squares of different territories that share a 4-edge → territories touch', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;
    sq[101]!.territoryId = 1; // east neighbor of (20, 2)
    const t = buildTouching(sq, 2);
    expect(t[0]![1]).toBe(true);
    expect(t[1]![0]).toBe(true);
  });

  it('non-adjacent territories do not touch', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;
    sq[300]!.territoryId = 1;
    const t = buildTouching(sq, 2);
    expect(t[0]![1]).toBe(false);
  });

  it('a territory does not touch itself', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;
    sq[101]!.territoryId = 0;
    const t = buildTouching(sq, 1);
    expect(t[0]![0]).toBe(false);
  });
});
