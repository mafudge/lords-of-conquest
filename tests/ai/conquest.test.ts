import { describe, it, expect } from 'vitest';
import { decideAlliesAction } from '../../src/game/ai/conquest.js';
import { seededState } from './_fixtures.js';
import type { CombatState } from '../../src/game/types.js';

describe('decideAlliesAction', () => {
  it('returns neutral when defender is unowned (natives)', () => {
    const s = seededState({ seed: 42, playerCount: 3 });
    const target = s.territories.find((t) => t.ownerId === 1)!;
    const target2 = { ...target, ownerId: null };
    const sNatives = { ...s, territories: s.territories.map((t) =>
      t.id === target.id ? target2 : t) };
    const c: CombatState = {
      attackerId: 0, defenderId: null,
      fromTerritoryId: 0, targetTerritoryId: target.id,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
      alliesDecisions: ['neutral', 'neutral', 'neutral'],
      alliesPending: new Set([2]),
      attackerStrength: 1, defenderStrength: 0,
      resolved: false, attackerWon: false,
    };
    expect(decideAlliesAction(sNatives, 2, c)).toBe('neutral');
  });

  it('returns one of attacker/neutral/defender for normal combat', () => {
    const s = seededState({ seed: 42, playerCount: 3 });
    const target = s.territories.find((t) => t.ownerId === 1)!;
    const c: CombatState = {
      attackerId: 0, defenderId: 1,
      fromTerritoryId: 0, targetTerritoryId: target.id,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
      alliesDecisions: ['neutral', 'neutral', 'neutral'],
      alliesPending: new Set([2]),
      attackerStrength: 1, defenderStrength: 1,
      resolved: false, attackerWon: false,
    };
    const choice = decideAlliesAction(s, 2, c);
    expect(['attacker', 'neutral', 'defender']).toContain(choice);
  });

  it('passive AIs always return neutral', () => {
    const s = seededState({ seed: 42, personas: ['aggressive', 'aggressive', 'passive'] });
    const target = s.territories.find((t) => t.ownerId === 1)!;
    const c: CombatState = {
      attackerId: 0, defenderId: 1,
      fromTerritoryId: 0, targetTerritoryId: target.id,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
      alliesDecisions: ['neutral', 'neutral', 'neutral'],
      alliesPending: new Set([2]),
      attackerStrength: 9, defenderStrength: 1,
      resolved: false, attackerWon: false,
    };
    expect(decideAlliesAction(s, 2, c)).toBe('neutral');
  });
});
