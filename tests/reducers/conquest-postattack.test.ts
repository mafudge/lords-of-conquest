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

function combatReady(att: number, def: number): { state: GameState; from: number; target: number } {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 73 });
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
  return { state: { ...s, pendingCombat: c }, from, target };
}

describe('post-attack: territory transfer', () => {
  it('attacker takes target on win', () => {
    const { state: s, target } = combatReady(5, 3);
    expect(s.territories[target]!.ownerId).toBe(1);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(true);
    expect(out.territories[target]!.ownerId).toBe(0);
  });

  it('target unchanged on loss', () => {
    const { state: s, target } = combatReady(2, 8);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(false);
    expect(out.territories[target]!.ownerId).toBe(1);
  });

  it('unowned target (defenderId null) becomes attacker on win', () => {
    const { state: s, target } = combatReady(5, 0);
    s.pendingCombat!.defenderId = null;
    s.territories[target]!.ownerId = null;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.territories[target]!.ownerId).toBe(0);
  });
});
