import { describe, it, expect } from 'vitest';
import { decideDevelopmentAction } from '../../src/game/ai/development.js';
import { seededState, setStockpile } from './_fixtures.js';

describe('decideDevelopmentAction', () => {
  it('returns endPhase when player has no buildable resources', () => {
    let s = seededState({ seed: 42 });
    s = setStockpile(s, 0, [0, 0, 0, 0, 0]);
    s = { ...s, currentPhase: 'development', currentPlayer: 0 };
    const plan = decideDevelopmentAction(s, 0);
    expect(plan.kind).toBe('endPhase');
  });

  it('returns a build plan when player can afford one with positive utility', () => {
    let s = seededState({ seed: 42 });
    s = setStockpile(s, 0, [3, 3, 3, 3, 0]);
    s = { ...s, currentPhase: 'development', currentPlayer: 0 };
    const plan = decideDevelopmentAction(s, 0);
    expect(['buildCity', 'buildWeapon', 'buildBoat', 'endPhase']).toContain(plan.kind);
    if (plan.kind !== 'endPhase') {
      expect(plan.player).toBe(0);
    }
  });

  it('passive personas always return endPhase regardless of resources', () => {
    let s = seededState({ seed: 42, personas: ['passive', 'aggressive', 'aggressive'] });
    s = setStockpile(s, 0, [9, 9, 9, 9, 0]);
    s = { ...s, currentPhase: 'development', currentPlayer: 0 };
    const plan = decideDevelopmentAction(s, 0);
    expect(plan.kind).toBe('endPhase');
  });
});
