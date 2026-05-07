import { describe, it, expect } from 'vitest';
import type { Plan, PlanKind } from '../src/game/plans.js';

describe('plans', () => {
  it('Plan kinds cover the engine surface', () => {
    const kinds: PlanKind[] = [
      'newGame', 'selection', 'production', 'trade', 'tradeResponse',
      'tradeRejectAll', 'horseFrom', 'horseTo', 'shipStockpile',
      'shipHorse', 'shipWeapon', 'shipBoat', 'attack', 'alliesDecision',
      'resolveCombat', 'buildCity', 'buildWeapon', 'buildBoat',
      'endPhase', 'savegame', 'loadgame', 'loadmap',
    ];
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toHaveLength(22);
  });

  it('newGame plan has setup + seed', () => {
    const p: Plan = {
      kind: 'newGame',
      setup: {
        players: [
          { color: 'red', name: 'Red', persona: 'human' },
          { color: 'blue', name: 'Blue', persona: 'aggressive' },
        ],
        citiesToWin: 5,
        elementOfChance: 'high',
        randomizePlayerOrder: false,
        map: {
          waterBoundary: true, waterArea: 'small', numTerritories: 24,
          islands: 'some', shapes: 'regular',
          resourceDensity: { kind: 'fixed', level: 'medium' },
        },
      },
      seed: 12345,
    };
    expect(p.kind).toBe('newGame');
  });

  it('selection plan has player + territoryId', () => {
    const p: Plan = { kind: 'selection', player: 0, territoryId: 5 };
    expect(p.kind).toBe('selection');
  });

  it('endPhase plan has player', () => {
    const p: Plan = { kind: 'endPhase', player: 0 };
    expect(p.kind).toBe('endPhase');
  });
});
