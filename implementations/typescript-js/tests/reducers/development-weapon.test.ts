import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, Stockpile } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
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

function developmentPhase(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 97 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'development', currentPlayer: 0 };
  return s;
}

describe('applyBuildWeapon', () => {
  it('builds weapon paying 1 iron + 1 coal', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasWeapon)!;
    s.players[0]!.stockpile = [1, 1, 0, 0, 0] as Stockpile;
    const out = reduce(s, {
      kind: 'buildWeapon', player: 0, territoryId: own.id, payInGold: false,
    });
    expect(out.territories[own.id]!.hasWeapon).toBe(true);
    expect(out.players[0]!.stockpile).toEqual([0, 0, 0, 0, 0]);
  });

  it('builds weapon with 2 gold alternative', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasWeapon)!;
    s.players[0]!.stockpile = [0, 0, 0, 2, 0] as Stockpile;
    const out = reduce(s, {
      kind: 'buildWeapon', player: 0, territoryId: own.id, payInGold: true,
    });
    expect(out.territories[own.id]!.hasWeapon).toBe(true);
  });

  it('rejects when territory already has a weapon', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0)!;
    s.territories[own.id]!.hasWeapon = true;
    s.players[0]!.stockpile = [1, 1, 0, 0, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildWeapon', player: 0, territoryId: own.id, payInGold: false,
    })).toThrow(/already has a weapon/i);
  });

  it('rejects when stockpile insufficient', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasWeapon)!;
    s.players[0]!.stockpile = [1, 0, 0, 0, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildWeapon', player: 0, territoryId: own.id, payInGold: false,
    })).toThrow(/insufficient/i);
  });
});
