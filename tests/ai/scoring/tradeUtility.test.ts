import { describe, it, expect } from 'vitest';
import { getTradeUtility } from '../../../src/game/ai/scoring/tradeUtility.js';
import { getBFPossible } from '../../../src/game/ai/bfPossible.js';
import { seededState, setStockpile } from '../_fixtures.js';

describe('getTradeUtility', () => {
  it('returns negative score when trading away resources for nothing', () => {
    let s = seededState({ seed: 42 });
    s = setStockpile(s, 0, [2, 2, 2, 2, 0]);
    s = setStockpile(s, 1, [0, 0, 0, 0, 0]);
    const bf = getBFPossible(s, 0);
    const score = getTradeUtility(s, 0, {
      proposerId: 0, tradeeId: 1,
      give: [1, 0, 0, 0, 0], receive: [0, 0, 0, 0, 0],
      status: 'proposed',
    }, 1.0, bf);
    expect(score).toBeLessThan(0);
  });

  it('horse-trade penalty kicks in when give[4] >= 2', () => {
    let s = seededState({ seed: 42 });
    s = setStockpile(s, 0, [0, 0, 0, 0, 5]);
    const bf = getBFPossible(s, 0);
    const score = getTradeUtility(s, 0, {
      proposerId: 0, tradeeId: 1,
      give: [0, 0, 0, 0, 2], receive: [3, 0, 0, 0, 0],
      status: 'proposed',
    }, 1.0, bf);
    expect(score).toBeLessThan(-9000);
  });
});
