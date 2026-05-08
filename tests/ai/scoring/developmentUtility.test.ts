import { describe, it, expect } from 'vitest';
import { getDevelopmentUtility } from '../../../src/game/ai/scoring/developmentUtility.js';
import { getBFPossible } from '../../../src/game/ai/bfPossible.js';
import { seededState, setStockpile } from '../_fixtures.js';

describe('getDevelopmentUtility', () => {
  it('returns a numeric score for an empty bundle (no-op)', () => {
    const s = seededState({ seed: 42 });
    const bf = getBFPossible(s, 0);
    const own = s.territories.find((t) => t.ownerId === 0)!;
    const score = getDevelopmentUtility(s, 0, { territoryId: own.id, builds: [] }, bf);
    expect(typeof score).toBe('number');
  });

  it('rewards a city build (resource path)', () => {
    let s = seededState({ seed: 42 });
    s = setStockpile(s, 0, [4, 4, 4, 4, 0]);
    const bf = getBFPossible(s, 0);
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasCity)!;
    const empty = getDevelopmentUtility(s, 0, { territoryId: own.id, builds: [] }, bf);
    const cityOnly = getDevelopmentUtility(s, 0, {
      territoryId: own.id, builds: [{ kind: 'city', payInGold: false }],
    }, bf);
    expect(cityOnly).toBeGreaterThan(empty);
  });
});
