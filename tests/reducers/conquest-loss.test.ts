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

function lossSetup(): { state: GameState; from: number; target: number } {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 79 });
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
    attackerStrength: 1, defenderStrength: 10,
    resolved: false, attackerWon: false,
  };
  return { state: { ...s, pendingCombat: c }, from, target };
}

describe('post-attack: loss cleanup', () => {
  it('destroys committed boat on loss', () => {
    const { state: s, target } = lossSetup();
    s.boats[5] = {
      id: 5, x: 10, y: 10, homeTerritoryId: target, ownerId: 0,
      carryHorse: false, carryWeapon: false,
    };
    s.pendingCombat!.boatId = 5;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(false);
    expect(out.boats[5]).toBeNull();
  });

  it('decrements stockpile slot 4 when brought horse and lost', () => {
    const { state: s, from } = lossSetup();
    s.players[0]!.stockpile[4] = 2;
    s.pendingCombat!.horseFromTerritoryId = from;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.players[0]!.stockpile[4]).toBe(1);
  });

  it('target territory unchanged on loss', () => {
    const { state: s, target } = lossSetup();
    const before = s.territories[target]!.ownerId;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.territories[target]!.ownerId).toBe(before);
  });
});
