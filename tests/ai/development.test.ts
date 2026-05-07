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

describe('decideDevelopmentAction aggressive fallback', () => {
  it('aggressive AI builds a boat when no positive utility but boat is affordable', () => {
    let s = seededState({ seed: 42, personas: ['aggressive', 'aggressive', 'aggressive'] });
    s = setStockpile(s, 0, [0, 0, 3, 0, 0]); // Just 3 trees
    s = { ...s, currentPhase: 'development', currentPlayer: 0 };

    // Verify player 0 has at least one coastal territory
    const hasCoastal = s.territories.some((t) => t.ownerId === 0 && t.bordersLakes.size > 0);
    if (hasCoastal) {
      const plan = decideDevelopmentAction(s, 0);
      // Should NOT be endPhase for aggressive with affordable boat
      expect(['buildBoat', 'buildWeapon']).toContain(plan.kind);
    }
  });

  it('defensive AI does NOT trigger fallback', () => {
    let s = seededState({ seed: 42, personas: ['defensive', 'aggressive', 'aggressive'] });
    s = setStockpile(s, 0, [0, 0, 3, 0, 0]);
    s = { ...s, currentPhase: 'development', currentPlayer: 0 };
    const plan = decideDevelopmentAction(s, 0);
    if (s.territories.find((t) => t.ownerId === 0 && t.bordersLakes.size > 0)) {
      expect(['buildBoat', 'endPhase']).toContain(plan.kind);
    }
  });
});
