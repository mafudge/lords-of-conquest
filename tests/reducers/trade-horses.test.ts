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
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

const give = (a: number, b: number, c: number, d: number, e: number): Stockpile => [a, b, c, d, e];

function horseTradeAccepted(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 13 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'trade', currentPlayer: 0, pendingTrade: null };
  s.players[s.currentPlayer]!.stockpile = give(0, 0, 0, 0, 1);
  s.players[1 - s.currentPlayer as 0 | 1]!.stockpile = give(1, 0, 0, 0, 0);
  const proposerTerr = s.territories.find((t) => t.ownerId === s.currentPlayer)!;
  s.territories[proposerTerr.id]!.hasHorse = true;
  s = reduce(s, {
    kind: 'trade',
    proposer: s.currentPlayer, tradee: (1 - s.currentPlayer) as 0 | 1,
    give: give(0, 0, 0, 0, 1), receive: give(1, 0, 0, 0, 0),
  });
  s = reduce(s, { kind: 'tradeResponse', accept: true });
  return s;
}

describe('horseFrom', () => {
  it('removes horse from the proposer-owned territory and updates pendingTrade', () => {
    const s = horseTradeAccepted();
    const proposerTerr = s.territories.find(
      (t) => t.ownerId === s.pendingTrade!.proposerId && t.hasHorse,
    )!;
    const out = reduce(s, {
      kind: 'horseFrom',
      player: s.pendingTrade!.proposerId,
      territoryId: proposerTerr.id,
    });
    expect(out.territories[proposerTerr.id]!.hasHorse).toBe(false);
    expect(out.pendingTrade!.horseFromTerritoryId).toBe(proposerTerr.id);
  });

  it('rejects when no horse on chosen territory', () => {
    const s = horseTradeAccepted();
    const tWithoutHorse = s.territories.find(
      (t) => t.ownerId === s.pendingTrade!.proposerId && !t.hasHorse,
    )!;
    expect(() => reduce(s, {
      kind: 'horseFrom',
      player: s.pendingTrade!.proposerId,
      territoryId: tWithoutHorse.id,
    })).toThrow(/no horse/i);
  });

  it('rejects when territory not owned by the giving player', () => {
    const s = horseTradeAccepted();
    const enemyTerr = s.territories.find((t) => t.ownerId !== s.pendingTrade!.proposerId)!;
    expect(() => reduce(s, {
      kind: 'horseFrom',
      player: s.pendingTrade!.proposerId,
      territoryId: enemyTerr.id,
    })).toThrow(/not owned/i);
  });

  it('rejects when no trade is pending', () => {
    const s = horseTradeAccepted();
    const cleared = { ...s, pendingTrade: null };
    expect(() => reduce(cleared, { kind: 'horseFrom', player: 0, territoryId: 0 }))
      .toThrow(/no pending|accepted/i);
  });
});

describe('horseTo (completes horse trade)', () => {
  it('places horse on receiver territory and swaps stockpiles', () => {
    let s = horseTradeAccepted();
    const proposerTerrWithHorse = s.territories.find(
      (t) => t.ownerId === s.pendingTrade!.proposerId && t.hasHorse,
    )!;
    s = reduce(s, {
      kind: 'horseFrom',
      player: s.pendingTrade!.proposerId, territoryId: proposerTerrWithHorse.id,
    });
    const tradeeTerrNoHorse = s.territories.find(
      (t) => t.ownerId === s.pendingTrade!.tradeeId && !t.hasHorse,
    )!;
    s = reduce(s, {
      kind: 'horseTo',
      player: s.pendingTrade!.tradeeId, territoryId: tradeeTerrNoHorse.id,
    });
    expect(s.territories[tradeeTerrNoHorse.id]!.hasHorse).toBe(true);
    expect(s.pendingTrade).toBeNull();
  });

  it('rejects when horseFrom has not been resolved', () => {
    const s = horseTradeAccepted();
    expect(() => reduce(s, { kind: 'horseTo', player: 0, territoryId: 0 }))
      .toThrow(/horseFrom|not yet/i);
  });

  it('rejects when target territory already has a horse', () => {
    let s = horseTradeAccepted();
    const proposerTerrWithHorse = s.territories.find(
      (t) => t.ownerId === s.pendingTrade!.proposerId && t.hasHorse,
    )!;
    s = reduce(s, {
      kind: 'horseFrom', player: s.pendingTrade!.proposerId, territoryId: proposerTerrWithHorse.id,
    });
    const tradeeTerr = s.territories.find((t) => t.ownerId === s.pendingTrade!.tradeeId)!;
    s.territories[tradeeTerr.id]!.hasHorse = true;
    expect(() => reduce(s, {
      kind: 'horseTo', player: s.pendingTrade!.tradeeId, territoryId: tradeeTerr.id,
    })).toThrow(/already has a horse/i);
  });
});
