import { describe, it, expect } from 'vitest';
import { getConquestUtility } from '../../../src/game/ai/scoring/conquestUtility.js';
import { getBFPossible } from '../../../src/game/ai/bfPossible.js';
import { seededState } from '../_fixtures.js';
import type { CombatState } from '../../../src/game/types.js';

describe('getConquestUtility', () => {
  it('returns a numeric score for a valid attack plan', () => {
    const s = seededState({ seed: 42 });
    const bf = getBFPossible(s, 0);
    const target = s.territories.find((t) => t.ownerId === 1 && t.resource !== null);
    if (!target) return;
    const from = s.territories.find((t) => t.ownerId === 0 && s.touching[t.id]?.[target.id]);
    if (!from) return;
    const c: CombatState = {
      attackerId: 0, defenderId: 1,
      fromTerritoryId: from.id, targetTerritoryId: target.id,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
      alliesDecisions: ['neutral', 'neutral'],
      alliesPending: new Set(),
      attackerStrength: 5, defenderStrength: 3,
      resolved: false, attackerWon: false,
    };
    const alliesMatrix: number[][] = [];
    const u = getConquestUtility(s, 0, c, bf, alliesMatrix);
    expect(typeof u).toBe('number');
  });
});
