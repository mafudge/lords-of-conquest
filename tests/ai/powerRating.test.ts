import { describe, it, expect } from 'vitest';
import { getPowerRatingForPl } from '../../src/game/ai/powerRating.js';
import { seededState, setStockpile } from './_fixtures.js';

describe('getPowerRatingForPl', () => {
  it('returns a non-negative integer for a freshly drafted player', () => {
    const s = seededState({ seed: 42 });
    const r = getPowerRatingForPl(s, 0, undefined);
    expect(Number.isInteger(r)).toBe(true);
    expect(r).toBeGreaterThanOrEqual(0);
  });

  it('rating increases when stockpile increases', () => {
    let s = seededState({ seed: 42 });
    const before = getPowerRatingForPl(s, 0, undefined);
    s = setStockpile(s, 0, [4, 4, 4, 4, 0]);
    const after = getPowerRatingForPl(s, 0, undefined);
    expect(after).toBeGreaterThan(before);
  });

  it('rating increases when adding a city', () => {
    let s = seededState({ seed: 42 });
    const before = getPowerRatingForPl(s, 0, undefined);
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasCity)!;
    s = { ...s, territories: s.territories.map((t) =>
      t.id === own.id ? { ...t, hasCity: true } : t) };
    const after = getPowerRatingForPl(s, 0, undefined);
    expect(after).toBeGreaterThan(before);
  });

  it('throws when attackPlan is provided (Task 22 will wire this)', () => {
    const s = seededState({ seed: 42 });
    expect(() => getPowerRatingForPl(s, 0, {
      attackerId: 0, defenderId: 1, fromTerritoryId: 0, targetTerritoryId: 1,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
      alliesDecisions: [], alliesPending: new Set(),
      attackerStrength: 1, defenderStrength: 1,
      resolved: false, attackerWon: false,
    } as any)).toThrow(/not yet implemented/i);
  });
});
