import { describe, it, expect } from 'vitest';
import { initBoard, computeLandBudget } from '../../src/game/mapgen/board.js';

describe('initBoard', () => {
  it('creates 800 squares', () => {
    const sq = initBoard(false);
    expect(sq).toHaveLength(800);
  });

  it('all squares default to open water', () => {
    const sq = initBoard(false);
    for (const s of sq) {
      expect(s.territoryId).toBeNull();
      expect(s.lakeId).toBeNull();
      expect(s.isBoundaryWater).toBe(false);
    }
  });

  it('with boundary, only the outermost ring is boundary water', () => {
    const sq = initBoard(true);
    for (const s of sq) {
      const onEdge = s.x === 0 || s.x === 39 || s.y === 0 || s.y === 19;
      expect(s.isBoundaryWater).toBe(onEdge);
    }
  });
});

describe('computeLandBudget', () => {
  it('matches LocApplet L3650-3680 with boundary', () => {
    expect(computeLandBudget(true, 'small')).toBe(547);
    expect(computeLandBudget(true, 'medium')).toBe(410);
    expect(computeLandBudget(true, 'large')).toBe(274);
  });
  it('matches without boundary', () => {
    expect(computeLandBudget(false, 'small')).toBe(640);
    expect(computeLandBudget(false, 'medium')).toBe(480);
    expect(computeLandBudget(false, 'large')).toBe(320);
  });
});
