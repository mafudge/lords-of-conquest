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

// ---------------------------------------------------------------------------
// Task 10: Boat re-flag tests (appended after Task 9 describe block)
// ---------------------------------------------------------------------------

describe('post-attack: boat re-flag', () => {
  it('all boats docked at target switch to attacker', () => {
    const { state: s, target } = combatReady(5, 3);
    s.boats[0] = {
      id: 0, x: -1, y: -1, homeTerritoryId: target, ownerId: 1,
      carryHorse: false, carryWeapon: false,
    };
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.boats[0]!.ownerId).toBe(0);
    expect(out.boats[0]!.homeTerritoryId).toBe(target);
  });

  it('boats elsewhere are not affected', () => {
    const { state: s, target } = combatReady(5, 3);
    const otherTerr = s.territories.find((t) => t.id !== target && t.ownerId === 1)!.id;
    s.boats[0] = {
      id: 0, x: -1, y: -1, homeTerritoryId: otherTerr, ownerId: 1,
      carryHorse: false, carryWeapon: false,
    };
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.boats[0]!.ownerId).toBe(1);
  });
});

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

describe('post-attack: horse and weapon transfer', () => {
  it('defender loses 1 from stockpile[4] when target had a horse', () => {
    const { state: s, target } = combatReady(5, 3);
    s.territories[target]!.hasHorse = true;
    s.players[1]!.stockpile[4] = 2;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.players[1]!.stockpile[4]).toBe(1);
  });

  it('attacker gains +1 in stockpile[4] when not bringing horse and target had one', () => {
    const { state: s, target } = combatReady(5, 3);
    s.territories[target]!.hasHorse = true;
    const before = s.players[0]!.stockpile[4];
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.players[0]!.stockpile[4]).toBe(before + 1);
  });

  it('attacker does NOT gain stockpile[4] when bringing own horse', () => {
    const { state: s, from, target } = combatReady(5, 3);
    s.pendingCombat!.horseFromTerritoryId = from;
    s.territories[target]!.hasHorse = true;
    const before = s.players[0]!.stockpile[4];
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.players[0]!.stockpile[4]).toBe(before);
  });

  it('brought horse lands on captured tile if target had none', () => {
    const { state: s, from, target } = combatReady(5, 3);
    s.territories[target]!.hasHorse = false;
    s.pendingCombat!.horseFromTerritoryId = from;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.territories[target]!.hasHorse).toBe(true);
  });

  it('brought weapon lands on captured tile if target had none', () => {
    const { state: s, from, target } = combatReady(5, 3);
    s.territories[target]!.hasWeapon = false;
    s.pendingCombat!.weaponFromTerritoryId = from;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.territories[target]!.hasWeapon).toBe(true);
  });
});

describe('post-attack: stockpile transfer', () => {
  it('captures defender stockpile slots 0-3 when target held the stockpile', () => {
    const { state: s, target } = combatReady(5, 3);
    s.territories[target]!.hasStockpile = true;
    s.players[1]!.stockpileLocation = target;
    s.players[1]!.stockpile = [3, 2, 1, 4, 7];
    s.players[0]!.stockpile = [1, 1, 1, 1, 0];
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.players[0]!.stockpile.slice(0, 4)).toEqual([4, 3, 2, 5]);
    expect(out.players[1]!.stockpile.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(out.players[1]!.stockpile[4]).toBe(7);
    expect(out.territories[target]!.hasStockpile).toBe(false);
    expect(out.players[1]!.stockpileLocation).toBeNull();
  });

  it('does nothing if target did not hold the stockpile', () => {
    const { state: s, target } = combatReady(5, 3);
    s.territories[target]!.hasStockpile = false;
    s.players[1]!.stockpile = [3, 2, 1, 4, 0];
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.players[1]!.stockpile).toEqual([3, 2, 1, 4, 0]);
  });
});
