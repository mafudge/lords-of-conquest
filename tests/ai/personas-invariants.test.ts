import { describe, it, expect } from 'vitest';
import { decideAction } from '../../src/game/ai/decideAction.js';
import { decideTradeAction } from '../../src/game/ai/trade.js';
import { decideAlliesAction } from '../../src/game/ai/conquest.js';
import { seededState, setStockpile } from './_fixtures.js';
import type { CombatState } from '../../src/game/types.js';

describe('persona invariants — passive', () => {
  it('decideAction returns endPhase for trade/shipment/conquest/development', () => {
    let s = seededState({ seed: 42, personas: ['passive', 'aggressive', 'aggressive'] });
    s = setStockpile(s, 0, [9, 9, 9, 9, 9]);
    for (const phase of ['trade', 'shipment', 'conquest', 'development'] as const) {
      const sp = { ...s, currentPhase: phase, currentPlayer: 0 as const, attackNumber: 1 as const, shipmentUsed: false };
      const plan = decideAction(sp, 0);
      expect(plan.kind).toBe('endPhase');
    }
  });

  it('decideTradeAction returns false for any offer', () => {
    let s = seededState({ seed: 42, personas: ['aggressive', 'passive', 'aggressive'] });
    s = setStockpile(s, 0, [9, 9, 9, 9, 0]);
    s = { ...s, currentPhase: 'trade', currentPlayer: 0 };
    const accept = decideTradeAction(s, 1, {
      proposerId: 0, tradeeId: 1, give: [9, 9, 9, 9, 0], receive: [0, 0, 0, 0, 0],
      status: 'proposed',
    });
    expect(accept).toBe(false);
  });

  it('decideAlliesAction returns neutral for any combat', () => {
    let s = seededState({ seed: 42, personas: ['aggressive', 'aggressive', 'passive'] });
    s = { ...s, currentPhase: 'conquest', currentPlayer: 0 };
    const c: CombatState = {
      attackerId: 0, defenderId: 1, fromTerritoryId: 0, targetTerritoryId: 0,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
      alliesDecisions: ['neutral', 'neutral', 'neutral'],
      alliesPending: new Set([2]),
      attackerStrength: 9, defenderStrength: 1,
      resolved: false, attackerWon: false,
    };
    expect(decideAlliesAction(s, 2, c)).toBe('neutral');
  });
});

describe('persona invariants — aggressive vs defensive', () => {
  it('aggressive and defensive both terminate without throwing', () => {
    const sA = seededState({ seed: 42, personas: ['aggressive', 'aggressive', 'aggressive'] });
    const sD = seededState({ seed: 42, personas: ['defensive', 'aggressive', 'aggressive'] });
    expect(() => decideAction({ ...sA, currentPhase: 'conquest' }, 0)).not.toThrow();
    expect(() => decideAction({ ...sD, currentPhase: 'conquest' }, 0)).not.toThrow();
  });
});
