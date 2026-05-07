import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, CombatState, PlayerId } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'low', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function withCombat(att: number, def: number): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 59 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'conquest', currentPlayer: 0, attackNumber: 1 };
  const target = s.territories.find((t) => t.ownerId === 1)!.id;
  const from = s.territories.find((t) => t.ownerId === 0
    && s.touching[t.id]?.[target])!.id;
  const c: CombatState = {
    attackerId: 0, defenderId: 1,
    fromTerritoryId: from, targetTerritoryId: target,
    boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    alliesDecisions: ['neutral', 'neutral'],
    alliesPending: new Set<PlayerId>(),
    attackerStrength: att, defenderStrength: def,
    resolved: false, attackerWon: false,
  };
  return { ...s, pendingCombat: c };
}

describe('applyResolveCombat (Low)', () => {
  it('attacker wins when attackerStrength >= defenderStrength', () => {
    const s = withCombat(5, 3);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.resolved).toBe(true);
    expect(out.pendingCombat!.attackerWon).toBe(true);
  });

  it('tie goes to attacker at Low', () => {
    const s = withCombat(4, 4);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(true);
  });

  it('attacker loses when strictly less', () => {
    const s = withCombat(3, 5);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(false);
  });

  it('rejects when allies are still pending', () => {
    const s = withCombat(5, 3);
    s.pendingCombat!.alliesPending.add(1);
    expect(() => reduce(s, { kind: 'resolveCombat' })).toThrow(/allies/i);
  });

  it('rejects when no combat is pending', () => {
    const s = withCombat(5, 3);
    const cleared = { ...s, pendingCombat: null };
    expect(() => reduce(cleared, { kind: 'resolveCombat' })).toThrow(/no.*combat/i);
  });
});
