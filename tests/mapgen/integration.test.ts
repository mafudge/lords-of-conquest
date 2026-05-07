import { describe, it, expect } from 'vitest';
import { generateMap } from '../../src/game/mapgen/index.js';
import type { MapParams } from '../../src/game/types.js';
import { Code } from '../../src/game/codes.js';

const baseParams: MapParams = {
  waterBoundary: true,
  waterArea: 'small',
  numTerritories: 24,
  islands: 'some',
  shapes: 'regular',
  resourceDensity: { kind: 'fixed', level: 'medium' },
};

describe('generateMap', () => {
  it('produces the requested number of territories', () => {
    const board = generateMap(12345, baseParams, 4);
    expect(board.territories).toHaveLength(24);
  });

  it('every territory has at least the minimum square count', () => {
    const board = generateMap(12345, baseParams, 4);
    for (const t of board.territories) {
      expect(t.squares.length).toBeGreaterThanOrEqual(9); // regular minSize
    }
  });

  it('same seed + params produces identical output (determinism)', () => {
    const a = generateMap(12345, baseParams, 4);
    const b = generateMap(12345, baseParams, 4);
    expect(a.squares).toEqual(b.squares);
    expect(a.territories.map((t) => ({
      ...t, bordersLakes: [...t.bordersLakes].sort()
    }))).toEqual(b.territories.map((t) => ({
      ...t, bordersLakes: [...t.bordersLakes].sort()
    })));
  });

  it('different seeds produce different maps', () => {
    const a = generateMap(1, baseParams, 4);
    const b = generateMap(2, baseParams, 4);
    expect(a.squares).not.toEqual(b.squares);
  });

  it('all territories are reachable from each other (transitively, via touching)', () => {
    const board = generateMap(42, baseParams, 4);
    const t = board.touching!;
    const visited = new Set<number>([0]);
    const queue = [0];
    while (queue.length) {
      const cur = queue.shift()!;
      for (let i = 0; i < board.territories.length; i++) {
        if (t[cur]![i] && !visited.has(i)) {
          visited.add(i);
          queue.push(i);
        }
      }
    }
    // Note: with islands enabled, full graph connectivity is NOT guaranteed.
    // For 'none' islands mode it should be — assert that path explicitly.
    const noIslands = generateMap(42, { ...baseParams, islands: 'none' }, 4);
    const tn = noIslands.touching!;
    const visN = new Set<number>([0]);
    const qN = [0];
    while (qN.length) {
      const cur = qN.shift()!;
      for (let i = 0; i < noIslands.territories.length; i++) {
        if (tn[cur]![i] && !visN.has(i)) { visN.add(i); qN.push(i); }
      }
    }
    expect(visN.size).toBe(noIslands.territories.length);
  });

  it('every resource code appears the expected number of times for fixed-medium 4P', () => {
    const board = generateMap(12345, baseParams, 4);
    const counts = new Map<number, number>();
    for (const t of board.territories) {
      if (t.resource !== null) counts.set(t.resource, (counts.get(t.resource) ?? 0) + 1);
    }
    expect(counts.get(Code.IRON)).toBe(4);
    expect(counts.get(Code.COAL)).toBe(4);
    expect(counts.get(Code.TREE)).toBe(4);
    expect(counts.get(Code.GOLD)).toBe(4);
    expect(counts.get(Code.STABLE)).toBe(5);
  });
});
