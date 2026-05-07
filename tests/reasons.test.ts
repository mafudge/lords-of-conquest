import { describe, it, expect } from 'vitest';
import { REASONS, pickReason } from '../src/game/reasons.js';
import { createRng } from '../src/game/rng.js';

describe('reasons', () => {
  it('exports the original 21 reason strings', () => {
    expect(REASONS).toHaveLength(21);
    expect(REASONS).toContain('Plagues of Cockroaches');
    expect(REASONS).toContain('Y2K Bug');
    expect(REASONS).toContain('Presidential Vote Recounts');
  });

  it('pickReason returns a string from REASONS deterministically per RNG state', () => {
    const r = createRng(7);
    const a = pickReason(r);
    const r2 = createRng(7);
    const b = pickReason(r2);
    expect(a).toBe(b);
    expect(REASONS).toContain(a);
  });

  it('pickReason advances the RNG cursor', () => {
    const r = createRng(7);
    const beforeCursor = r.cursor;
    pickReason(r);
    expect(r.cursor).toBeGreaterThan(beforeCursor);
  });
});
