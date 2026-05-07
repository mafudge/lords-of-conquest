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
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 89 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'development', currentPlayer: 0 };
  return s;
}

describe('applyBuildCity', () => {
  it('builds city paying 1 of each iron/coal/tree/gold', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasCity)!;
    s.players[0]!.stockpile = [1, 1, 1, 1, 0] as Stockpile;
    const out = reduce(s, {
      kind: 'buildCity', player: 0, territoryId: own.id, payInGold: false,
    });
    expect(out.territories[own.id]!.hasCity).toBe(true);
    expect(out.players[0]!.stockpile).toEqual([0, 0, 0, 0, 0]);
  });

  it('builds city with gold alternative (4 gold)', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasCity)!;
    s.players[0]!.stockpile = [0, 0, 0, 4, 0] as Stockpile;
    const out = reduce(s, {
      kind: 'buildCity', player: 0, territoryId: own.id, payInGold: true,
    });
    expect(out.territories[own.id]!.hasCity).toBe(true);
    expect(out.players[0]!.stockpile).toEqual([0, 0, 0, 0, 0]);
  });

  it('rejects when stockpile insufficient (resource path)', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasCity)!;
    s.players[0]!.stockpile = [1, 0, 1, 1, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildCity', player: 0, territoryId: own.id, payInGold: false,
    })).toThrow(/insufficient/i);
  });

  it('rejects when stockpile insufficient (gold path)', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasCity)!;
    s.players[0]!.stockpile = [0, 0, 0, 3, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildCity', player: 0, territoryId: own.id, payInGold: true,
    })).toThrow(/insufficient/i);
  });

  it('rejects when territory already has a city', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0)!;
    s.territories[own.id]!.hasCity = true;
    s.players[0]!.stockpile = [1, 1, 1, 1, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildCity', player: 0, territoryId: own.id, payInGold: false,
    })).toThrow(/already has a city/i);
  });

  it('rejects when territory not owned', () => {
    const s = developmentPhase();
    const enemy = s.territories.find((t) => t.ownerId === 1)!;
    s.players[0]!.stockpile = [1, 1, 1, 1, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildCity', player: 0, territoryId: enemy.id, payInGold: false,
    })).toThrow(/not owned/i);
  });

  it('city activates adjacent friendly resource', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasCity)!;
    const adjFriendly = s.territories.find((t) =>
      t.id !== own.id && t.ownerId === 0 && s.touching[own.id]?.[t.id]
        && t.resource !== null && t.resource !== 4);
    if (!adjFriendly) return;
    s.players[0]!.stockpile = [1, 1, 1, 1, 0] as Stockpile;
    const out = reduce(s, {
      kind: 'buildCity', player: 0, territoryId: own.id, payInGold: false,
    });
    expect(out.territories[adjFriendly.id]!.hasResourceDouble).toBe(true);
  });
});
