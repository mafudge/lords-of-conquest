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
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 101 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'development', currentPlayer: 0 };
  return s;
}

describe('applyBuildBoat', () => {
  it('builds boat at coastal territory paying 3 trees', () => {
    const s = developmentPhase();
    const coastal = s.territories.find((t) =>
      t.ownerId === 0 && t.bordersLakes.size > 0);
    if (!coastal) return;
    const lakeId = [...coastal.bordersLakes][0]!;
    s.players[0]!.stockpile = [0, 0, 3, 0, 0] as Stockpile;
    const out = reduce(s, {
      kind: 'buildBoat', player: 0, territoryId: coastal.id,
      lakeId, payInGold: false,
    });
    expect(out.players[0]!.stockpile[2]).toBe(0);
    const newBoat = out.boats.find((b) => b !== null && b.homeTerritoryId === coastal.id);
    expect(newBoat).toBeDefined();
    expect(newBoat!.ownerId).toBe(0);
  });

  it('builds boat with 3 gold alternative', () => {
    const s = developmentPhase();
    const coastal = s.territories.find((t) =>
      t.ownerId === 0 && t.bordersLakes.size > 0);
    if (!coastal) return;
    const lakeId = [...coastal.bordersLakes][0]!;
    s.players[0]!.stockpile = [0, 0, 0, 3, 0] as Stockpile;
    const out = reduce(s, {
      kind: 'buildBoat', player: 0, territoryId: coastal.id,
      lakeId, payInGold: true,
    });
    expect(out.players[0]!.stockpile[3]).toBe(0);
  });

  it('rejects on landlocked territory', () => {
    const s = developmentPhase();
    const inland = s.territories.find((t) =>
      t.ownerId === 0 && t.bordersLakes.size === 0);
    if (!inland) return;
    s.players[0]!.stockpile = [0, 0, 3, 0, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildBoat', player: 0, territoryId: inland.id,
      lakeId: 0, payInGold: false,
    })).toThrow(/landlocked/i);
  });

  it('rejects when stockpile insufficient', () => {
    const s = developmentPhase();
    const coastal = s.territories.find((t) =>
      t.ownerId === 0 && t.bordersLakes.size > 0);
    if (!coastal) return;
    const lakeId = [...coastal.bordersLakes][0]!;
    s.players[0]!.stockpile = [0, 0, 2, 0, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildBoat', player: 0, territoryId: coastal.id,
      lakeId, payInGold: false,
    })).toThrow(/insufficient/i);
  });
});
