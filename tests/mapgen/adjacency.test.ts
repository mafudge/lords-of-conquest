import { describe, it, expect } from 'vitest';
import { buildTouching, buildDistance } from '../../src/game/mapgen/adjacency.js';
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

describe('buildDistance', () => {
  it('adjacent territories have distance 1', () => {
    const t = [
      [false, true, false],
      [true, false, true],
      [false, true, false],
    ];
    const d = buildDistance(t);
    expect(d[0]![1]).toBe(1);
    expect(d[1]![0]).toBe(1);
    expect(d[1]![2]).toBe(1);
  });

  it('two-hop territories have distance 2', () => {
    const t = [
      [false, true, false],
      [true, false, true],
      [false, true, false],
    ];
    const d = buildDistance(t);
    expect(d[0]![2]).toBe(2);
  });

  it('unreachable territories have Infinity', () => {
    const t = [
      [false, true, false],
      [true, false, false],
      [false, false, false],
    ];
    const d = buildDistance(t);
    expect(d[0]![2]).toBe(Infinity);
  });

  it('self distance is 0', () => {
    const t = [[false, true], [true, false]];
    const d = buildDistance(t);
    expect(d[0]![0]).toBe(0);
    expect(d[1]![1]).toBe(0);
  });
});
