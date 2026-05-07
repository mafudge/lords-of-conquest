import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, CombatState, PlayerId } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'medium', randomizePlayerOrder: false,
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

function withCombat(att: number, def: number, seed = 67): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed });
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

describe('applyResolveCombat (Medium)', () => {
  it('attacker wins when strictly greater', () => {
    const s = withCombat(5, 3);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(true);
  });

  it('attacker loses when strictly less', () => {
    const s = withCombat(3, 5);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(false);
  });

  it('tie goes by seeded coin flip (deterministic per seed)', () => {
    const s1 = withCombat(4, 4, 100);
    const out1 = reduce(s1, { kind: 'resolveCombat' });
    const s2 = withCombat(4, 4, 100);
    const out2 = reduce(s2, { kind: 'resolveCombat' });
    expect(out1.pendingCombat!.attackerWon).toBe(out2.pendingCombat!.attackerWon);
    expect(out1.rngCursor).toBe(s1.rngCursor + 1);
  });
});
