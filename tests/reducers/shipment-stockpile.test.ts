import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, Stockpile } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

const give = (a: number, b: number, c: number, d: number, e: number): Stockpile => [a, b, c, d, e];

function shipmentPhase(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 23 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'shipment', currentPlayer: 0, shipmentUsed: false, shipmentForfeitsSecondAttack: false };
  const myTerr = s.territories.find((t) => t.ownerId === 0)!;
  s.territories[myTerr.id]!.hasStockpile = true;
  s.players[0]!.stockpileLocation = myTerr.id;
  s.players[0]!.stockpile = give(2, 1, 0, 0, 0);
  return s;
}

describe('shipStockpile', () => {
  it('moves stockpile to a different owned territory', () => {
    const s = shipmentPhase();
    const from = s.players[0]!.stockpileLocation!;
    const to = s.territories.find((t) => t.ownerId === 0 && t.id !== from)!.id;
    const out = reduce(s, { kind: 'shipStockpile', player: 0, from, to });
    expect(out.players[0]!.stockpileLocation).toBe(to);
    expect(out.territories[from]!.hasStockpile).toBe(false);
    expect(out.territories[to]!.hasStockpile).toBe(true);
    expect(out.shipmentUsed).toBe(true);
    expect(out.shipmentForfeitsSecondAttack).toBe(true);
  });

  it('rejects when already shipped this turn', () => {
    const s = { ...shipmentPhase(), shipmentUsed: true };
    const from = s.players[0]!.stockpileLocation!;
    const to = s.territories.find((t) => t.ownerId === 0 && t.id !== from)!.id;
    expect(() => reduce(s, { kind: 'shipStockpile', player: 0, from, to }))
      .toThrow(/already shipped/i);
  });

  it('rejects when from is not the player\'s stockpile location', () => {
    const s = shipmentPhase();
    const wrong = s.territories.find((t) => t.ownerId === 0 && !t.hasStockpile)!.id;
    const to = s.territories.find((t) => t.ownerId === 0 && t.id !== wrong)!.id;
    expect(() => reduce(s, { kind: 'shipStockpile', player: 0, from: wrong, to }))
      .toThrow(/stockpile/i);
  });

  it('rejects when to is not owned by the player', () => {
    const s = shipmentPhase();
    const from = s.players[0]!.stockpileLocation!;
    const enemy = s.territories.find((t) => t.ownerId === 1)!.id;
    expect(() => reduce(s, { kind: 'shipStockpile', player: 0, from, to: enemy }))
      .toThrow(/owned/i);
  });
});
