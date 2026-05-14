import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup3: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
    { color: 'cyan', name: 'c', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup: setup3, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function attackWithAllies(): { state: GameState; allyId: number } {
  let s = reduce(initial(), { kind: 'newGame', setup: setup3, seed: 53 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'conquest', currentPlayer: 0,
    attackNumber: 1, pendingCombat: null };
  let from = -1, target = -1, allyId = -1;
  outer: for (let a = 0; a < s.territories.length; a++) {
    if (s.territories[a]!.ownerId !== 0) continue;
    for (let b = 0; b < s.territories.length; b++) {
      if (a === b) continue;
      if (s.territories[b]!.ownerId !== 1) continue;
      if (!s.touching[a]?.[b]) continue;
      for (let c = 0; c < s.territories.length; c++) {
        if (c === b) continue;
        if (s.territories[c]!.ownerId !== 2) continue;
        if (s.touching[c]?.[b]) { from = a; target = b; allyId = 2; break outer; }
      }
    }
  }
  if (from < 0) throw new Error('No tri-party config');
  s = reduce(s, {
    kind: 'attack', player: 0, fromTerritoryId: from, targetTerritoryId: target,
    boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
  });
  return { state: s, allyId };
}

describe('applyAlliesDecision', () => {
  it('collects ally choice and updates alliesPending', () => {
    const { state: s, allyId } = attackWithAllies();
    expect(s.pendingCombat!.alliesPending.has(allyId as 0 | 1 | 2)).toBe(true);
    const out = reduce(s, { kind: 'alliesDecision', player: allyId as 0 | 1 | 2, choice: 'attacker' });
    expect(out.pendingCombat!.alliesPending.has(allyId as 0 | 1 | 2)).toBe(false);
    expect(out.pendingCombat!.alliesDecisions[allyId]).toBe('attacker');
    expect(out.pendingCombat!.attackerStrength).toBeGreaterThanOrEqual(s.pendingCombat!.attackerStrength);
  });

  it('rejects when player is not an ally candidate', () => {
    const { state: s } = attackWithAllies();
    expect(() => reduce(s, { kind: 'alliesDecision', player: 0, choice: 'attacker' }))
      .toThrow(/not.*ally|not.*pending/i);
  });

  it('rejects when no combat is pending', () => {
    const { state: s, allyId } = attackWithAllies();
    const cleared = { ...s, pendingCombat: null };
    expect(() => reduce(cleared, { kind: 'alliesDecision', player: allyId as 0 | 1 | 2, choice: 'neutral' }))
      .toThrow(/no.*combat/i);
  });
});
