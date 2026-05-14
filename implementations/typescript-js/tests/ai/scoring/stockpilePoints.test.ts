import { describe, it, expect } from 'vitest';
import { getStockpilePoints } from '../../../src/game/ai/scoring/stockpilePoints.js';
import { getBFPossible } from '../../../src/game/ai/bfPossible.js';
import { seededState } from '../_fixtures.js';
import type { Stockpile } from '../../../src/game/types.js';

describe('getStockpilePoints', () => {
  it('returns 0 for empty stockpile (no horses to consider)', () => {
    const s = seededState({ seed: 42 });
    const bf = getBFPossible(s, 0);
    const score = getStockpilePoints(s, 0, [0, 0, 0, 0, 0] as Stockpile, bf);
    expect(score).toBe(0);
  });

  it('rewards a city-buildable stockpile (1 each iron/coal/tree/gold)', () => {
    const s = seededState({ seed: 42 });
    const bf = getBFPossible(s, 0);
    const cityable = getStockpilePoints(s, 0, [1, 1, 1, 1, 0] as Stockpile, bf);
    const empty = getStockpilePoints(s, 0, [0, 0, 0, 0, 0] as Stockpile, bf);
    expect(cityable).toBeGreaterThan(empty);
  });

  it('rewards a weapon-buildable stockpile (1 iron + 1 coal)', () => {
    const s = seededState({ seed: 42 });
    const bf = getBFPossible(s, 0);
    const weaponable = getStockpilePoints(s, 0, [1, 1, 0, 0, 0] as Stockpile, bf);
    const empty = getStockpilePoints(s, 0, [0, 0, 0, 0, 0] as Stockpile, bf);
    expect(weaponable).toBeGreaterThan(empty);
  });

  it('rewards extra trees (boat-buildable)', () => {
    const s = seededState({ seed: 42 });
    const bf = getBFPossible(s, 0);
    const tree3 = getStockpilePoints(s, 0, [0, 0, 3, 0, 0] as Stockpile, bf);
    const tree0 = getStockpilePoints(s, 0, [0, 0, 0, 0, 0] as Stockpile, bf);
    expect(tree3).toBeGreaterThan(tree0);
  });
});
