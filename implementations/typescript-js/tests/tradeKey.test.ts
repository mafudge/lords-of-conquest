import { describe, it, expect } from 'vitest';
import { tradeKey, sameTrade } from '../src/game/tradeKey.js';
import type { Stockpile } from '../src/game/types.js';

const give = (a: number, b: number, c: number, d: number, e: number): Stockpile => [a, b, c, d, e];

describe('tradeKey', () => {
  it('produces the same key for identical trades', () => {
    expect(tradeKey(0, 1, give(1, 0, 0, 0, 0), give(0, 1, 0, 0, 0)))
      .toBe(tradeKey(0, 1, give(1, 0, 0, 0, 0), give(0, 1, 0, 0, 0)));
  });

  it('different give amounts produce different keys', () => {
    expect(tradeKey(0, 1, give(1, 0, 0, 0, 0), give(0, 1, 0, 0, 0)))
      .not.toBe(tradeKey(0, 1, give(2, 0, 0, 0, 0), give(0, 1, 0, 0, 0)));
  });

  it('different traders produce different keys', () => {
    expect(tradeKey(0, 1, give(1, 0, 0, 0, 0), give(0, 1, 0, 0, 0)))
      .not.toBe(tradeKey(1, 0, give(1, 0, 0, 0, 0), give(0, 1, 0, 0, 0)));
  });
});

describe('sameTrade', () => {
  it('matches identical trades', () => {
    expect(sameTrade(
      { trader: 0, tradee: 1, give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0) },
      { trader: 0, tradee: 1, give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0) },
    )).toBe(true);
  });

  it('matches symmetric reverse trades (per TradePlan.equals L39-77)', () => {
    expect(sameTrade(
      { trader: 0, tradee: 1, give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0) },
      { trader: 1, tradee: 0, give: give(0, 1, 0, 0, 0), receive: give(1, 0, 0, 0, 0) },
    )).toBe(true);
  });

  it('rejects different amounts', () => {
    expect(sameTrade(
      { trader: 0, tradee: 1, give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0) },
      { trader: 0, tradee: 1, give: give(2, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0) },
    )).toBe(false);
  });
});
