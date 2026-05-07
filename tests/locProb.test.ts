import { describe, it, expect } from 'vitest';
import { combination } from '../src/game/locProb.js';
import { probSuccess } from '../src/game/locProb.js';

describe('combination', () => {
  it('C(n, 0) = 1', () => {
    expect(combination(5, 0)).toBe(1);
    expect(combination(0, 0)).toBe(1);
  });
  it('C(n, n) = 1', () => {
    expect(combination(5, 5)).toBe(1);
  });
  it('C(5, 2) = 10', () => {
    expect(combination(5, 2)).toBe(10);
  });
  it('C(10, 3) = 120', () => {
    expect(combination(10, 3)).toBe(120);
  });
  it('C(20, 10) = 184756', () => {
    expect(combination(20, 10)).toBe(184756);
  });
  it('returns 0 for negative inputs (Gettman edge)', () => {
    expect(combination(-1, 2)).toBe(0);
    expect(combination(5, -1)).toBe(0);
  });
});

describe('probSuccess base cases', () => {
  it('attacker <= 0 ⇒ 0', () => {
    expect(probSuccess(0, 5)).toBe(0);
    expect(probSuccess(-3, 5)).toBe(0);
  });
  it('defender <= 0 ⇒ 1', () => {
    expect(probSuccess(5, 0)).toBe(1);
    expect(probSuccess(5, -1)).toBe(1);
  });
  it('attacker == 1 ⇒ 0.5^def', () => {
    expect(probSuccess(1, 1)).toBeCloseTo(0.5, 10);
    expect(probSuccess(1, 3)).toBeCloseTo(0.125, 10);
    expect(probSuccess(1, 5)).toBeCloseTo(1 / 32, 10);
  });
  it('defender == 1 ⇒ 1 - 0.5^att', () => {
    expect(probSuccess(1, 1)).toBeCloseTo(0.5, 10);
    expect(probSuccess(3, 1)).toBeCloseTo(1 - 0.125, 10);
    expect(probSuccess(5, 1)).toBeCloseTo(1 - 1 / 32, 10);
  });
});

describe('probSuccess general case', () => {
  it('symmetric attack 2v2 ≈ 0.5', () => {
    expect(probSuccess(2, 2)).toBeCloseTo(0.5, 10);
  });
  it('larger attacker wins more often', () => {
    expect(probSuccess(5, 3)).toBeGreaterThan(0.5);
    expect(probSuccess(10, 3)).toBeGreaterThan(probSuccess(5, 3));
  });
  it('matches Gettman formula for 3v3', () => {
    // Σ C(att+def-1, k) for k=0..att-1, divided by 2^(att+def-1)
    // For (3,3): (C(5,0) + C(5,1) + C(5,2)) / 2^5 = (1 + 5 + 10) / 32 = 16/32 = 0.5
    expect(probSuccess(3, 3)).toBeCloseTo(0.5, 10);
  });
  it('matches Gettman formula for 4v2', () => {
    // (C(5,0)+C(5,1)+C(5,2)+C(5,3))/32 = (1+5+10+10)/32 = 26/32 = 0.8125
    expect(probSuccess(4, 2)).toBeCloseTo(0.8125, 10);
  });
});
