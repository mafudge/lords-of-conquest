import { describe, it, expect } from 'vitest';
import { isPassive, isDefensive, isAggressive } from '../../src/game/ai/personas.js';
import type { GameState } from '../../src/game/types.js';

function makeState(personas: Array<'human' | 'passive' | 'defensive' | 'aggressive'>): GameState {
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: personas.map((p, i) => ({
        color: (['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const)[i]!,
        name: `p${i}`, persona: p,
      })),
      citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories: [], touching: [], distance: [],
    boats: [], players: personas.map((p, i) => ({
      id: i as 0 | 1 | 2 | 3 | 4 | 5 | 6, name: `p${i}`,
      color: (['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const)[i]!,
      persona: p, status: 'playing',
      stockpile: [0, 0, 0, 0, 0], stockpileLocation: null,
    })),
    turnOrder: personas.map((_, i) => i as 0 | 1 | 2 | 3 | 4 | 5 | 6),
    currentPhase: 'setup', currentPlayer: 0,
    year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  };
}

describe('persona predicates', () => {
  it('isPassive matches only the passive persona', () => {
    const s = makeState(['human', 'passive', 'defensive', 'aggressive']);
    expect(isPassive(s, 0)).toBe(false);
    expect(isPassive(s, 1)).toBe(true);
    expect(isPassive(s, 2)).toBe(false);
    expect(isPassive(s, 3)).toBe(false);
  });

  it('isDefensive matches only defensive', () => {
    const s = makeState(['human', 'passive', 'defensive', 'aggressive']);
    expect(isDefensive(s, 2)).toBe(true);
    expect(isDefensive(s, 0)).toBe(false);
    expect(isDefensive(s, 1)).toBe(false);
    expect(isDefensive(s, 3)).toBe(false);
  });

  it('isAggressive matches only aggressive', () => {
    const s = makeState(['human', 'passive', 'defensive', 'aggressive']);
    expect(isAggressive(s, 3)).toBe(true);
    expect(isAggressive(s, 0)).toBe(false);
  });
});
