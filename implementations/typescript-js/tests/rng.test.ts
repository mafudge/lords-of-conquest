import { describe, it, expect } from 'vitest';
import { createRng, nextFloat, nextInt, type RngState } from '../src/game/rng.js';

describe('rng', () => {
  it('createRng returns state with seed and zero cursor', () => {
    const r = createRng(42);
    expect(r.seed).toBe(42);
    expect(r.cursor).toBe(0);
  });

  it('same seed produces identical sequence', () => {
    const a = createRng(123);
    const b = createRng(123);
    const seqA = [nextFloat(a), nextFloat(a), nextFloat(a)];
    const seqB = [nextFloat(b), nextFloat(b), nextFloat(b)];
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different first draws', () => {
    expect(nextFloat(createRng(1))).not.toBe(nextFloat(createRng(2)));
  });

  it('nextFloat returns values in [0, 1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = nextFloat(r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt(r, n) returns 0..n-1', () => {
    const r = createRng(99);
    const counts = new Array<number>(5).fill(0);
    for (let i = 0; i < 5000; i++) {
      const v = nextInt(r, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      counts[v]!++;
    }
    // Loosely uniform — every bucket got hit
    counts.forEach((c) => expect(c).toBeGreaterThan(500));
  });

  it('cursor increments on each draw', () => {
    const r = createRng(5);
    nextFloat(r);
    nextFloat(r);
    nextInt(r, 10);
    expect(r.cursor).toBe(3);
  });
});
