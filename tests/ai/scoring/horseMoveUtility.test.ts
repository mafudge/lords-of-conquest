import { describe, it, expect } from 'vitest';
import {
  getHorseMoveUtility,
  getTerrNoHorseToRemove,
  getTerrNoHorseToPlace,
} from '../../../src/game/ai/scoring/horseMoveUtility.js';
import { getBFPossible } from '../../../src/game/ai/bfPossible.js';
import { seededState } from '../_fixtures.js';

describe('horseMoveUtility helpers', () => {
  it('getHorseMoveUtility returns a number for owned-territory move', () => {
    const s = seededState({ seed: 42 });
    const bf = getBFPossible(s, 0);
    const owned = s.territories.filter((t) => t.ownerId === 0);
    if (owned.length < 2) return;
    const score = getHorseMoveUtility(s, 0, owned[0]!.id, owned[1]!.id, bf);
    expect(typeof score).toBe('number');
  });

  it('getTerrNoHorseToPlace returns a numeric score', () => {
    const s = seededState({ seed: 42 });
    const bf = getBFPossible(s, 0);
    const score = getTerrNoHorseToPlace(s, 0, bf, true);
    expect(typeof score).toBe('number');
  });
});
