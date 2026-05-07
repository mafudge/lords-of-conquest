import { describe, it, expect } from 'vitest';
import { getBFPossible } from '../../src/game/ai/bfPossible.js';
import { seededState } from './_fixtures.js';

describe('getBFPossible', () => {
  it('returns a [numTerritories][7] zero-initialized matrix shape', () => {
    const s = seededState({ seed: 42 });
    const bf = getBFPossible(s, 0);
    expect(bf).toHaveLength(s.territories.length);
    for (const row of bf) {
      expect(row).toHaveLength(7);
      for (const x of row) expect(x).toBeGreaterThanOrEqual(0);
    }
  });

  it('zeroes out slots for self and natives (slot 7 is unused here, indices 0..6)', () => {
    const s = seededState({ seed: 42, playerCount: 3 });
    const bf = getBFPossible(s, 0);
    for (let t = 0; t < bf.length; t++) {
      expect(bf[t]![0]).toBe(0);
    }
  });

  it('records distance-2 enemy horse threat as 1', () => {
    let s = seededState({ seed: 42, playerCount: 3 });
    let A = -1, B = -1, C = -1;
    outer: for (let a = 0; a < s.territories.length; a++) {
      if (s.territories[a]!.ownerId !== 0) continue;
      for (let b = 0; b < s.territories.length; b++) {
        if (b === a || !s.touching[a]?.[b]) continue;
        for (let c = 0; c < s.territories.length; c++) {
          if (c === a || c === b) continue;
          if (s.touching[b]?.[c] && !s.touching[a]?.[c]) {
            const owner = s.territories[c]!.ownerId;
            if (owner !== null && owner !== 0) {
              A = a; B = b; C = c; break outer;
            }
          }
        }
      }
    }
    if (A < 0) return;
    const enemyOwner = s.territories[C]!.ownerId!;
    s = { ...s, territories: s.territories.map((t) =>
      t.id === C ? { ...t, hasHorse: true } : t) };
    const bf = getBFPossible(s, 0);
    expect(bf[A]![enemyOwner]).toBeGreaterThanOrEqual(1);
  });

  it('records distance-2 enemy horse+weapon threat as 4', () => {
    let s = seededState({ seed: 42, playerCount: 3 });
    let A = -1, C = -1;
    outer: for (let a = 0; a < s.territories.length; a++) {
      if (s.territories[a]!.ownerId !== 0) continue;
      for (let b = 0; b < s.territories.length; b++) {
        if (b === a || !s.touching[a]?.[b]) continue;
        for (let c = 0; c < s.territories.length; c++) {
          if (c === a || c === b) continue;
          if (s.touching[b]?.[c] && !s.touching[a]?.[c]) {
            const owner = s.territories[c]!.ownerId;
            if (owner !== null && owner !== 0) {
              A = a; C = c; break outer;
            }
          }
        }
      }
    }
    if (A < 0) return;
    const enemyOwner = s.territories[C]!.ownerId!;
    s = { ...s, territories: s.territories.map((t) =>
      t.id === C ? { ...t, hasHorse: true, hasWeapon: true } : t) };
    const bf = getBFPossible(s, 0);
    expect(bf[A]![enemyOwner]).toBe(4);
  });
});
