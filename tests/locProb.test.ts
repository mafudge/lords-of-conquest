import { describe, it, expect } from 'vitest';
import { combination } from '../src/game/locProb.js';

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
