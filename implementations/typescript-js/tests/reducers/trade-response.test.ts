import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import { tradeKey } from '../../src/game/tradeKey.js';
import type { GameState, GameSetup, Stockpile } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
    { color: 'cyan', name: 'c', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
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

const give = (a: number, b: number, c: number, d: number, e: number): Stockpile => [a, b, c, d, e];

function inTradeWithProposal(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 11 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'trade', currentPlayer: 0, pendingTrade: null };
  s.players[s.currentPlayer]!.stockpile = give(3, 0, 0, 0, 0);
  s.players[1]!.stockpile = give(0, 3, 0, 0, 0);
  return reduce(s, {
    kind: 'trade',
    proposer: s.currentPlayer, tradee: 1,
    give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0),
  });
}

describe('tradeResponse: reject', () => {
  it('clears pendingTrade and adds to rejectedTrades with count 1', () => {
    const s = inTradeWithProposal();
    const out = reduce(s, { kind: 'tradeResponse', accept: false });
    expect(out.pendingTrade).toBeNull();
    expect(out.rejectedTrades).toHaveLength(1);
    expect(out.rejectedTrades[0]!.count).toBe(1);
    expect(out.rejectedTrades[0]!.trader).toBe(s.pendingTrade!.proposerId);
    expect(out.rejectedTrades[0]!.tradee).toBe(s.pendingTrade!.tradeeId);
    expect(out.rejectedTrades[0]!.tradeKey).toBe(
      tradeKey(s.pendingTrade!.proposerId, s.pendingTrade!.tradeeId,
               s.pendingTrade!.give, s.pendingTrade!.receive));
  });

  it('increments count when the same trade is rejected twice', () => {
    let s = inTradeWithProposal();
    const trade = s.pendingTrade!;
    s = reduce(s, { kind: 'tradeResponse', accept: false });
    s = reduce(s, {
      kind: 'trade',
      proposer: trade.proposerId, tradee: trade.tradeeId,
      give: trade.give, receive: trade.receive,
    });
    s = reduce(s, { kind: 'tradeResponse', accept: false });
    expect(s.rejectedTrades).toHaveLength(1);
    expect(s.rejectedTrades[0]!.count).toBe(2);
  });

  it('rejects when no trade is pending', () => {
    const s = inTradeWithProposal();
    const cleared = { ...s, pendingTrade: null };
    expect(() => reduce(cleared, { kind: 'tradeResponse', accept: false })).toThrow(/no pending/i);
  });

  it('rejects when phase is not trade', () => {
    const s = inTradeWithProposal();
    const out = { ...s, currentPhase: 'production' as const };
    expect(() => reduce(out, { kind: 'tradeResponse', accept: false })).toThrow(/phase/i);
  });
});

describe('tradeResponse: accept (no horses)', () => {
  it('swaps stockpiles and clears pendingTrade', () => {
    const s = inTradeWithProposal();
    const beforeP = [...s.players[s.pendingTrade!.proposerId]!.stockpile];
    const beforeT = [...s.players[s.pendingTrade!.tradeeId]!.stockpile];
    const out = reduce(s, { kind: 'tradeResponse', accept: true });
    expect(out.pendingTrade).toBeNull();
    const afterP = out.players[s.pendingTrade!.proposerId]!.stockpile;
    const afterT = out.players[s.pendingTrade!.tradeeId]!.stockpile;
    expect(afterP[0]).toBe(beforeP[0]! - s.pendingTrade!.give[0]! + s.pendingTrade!.receive[0]!);
    expect(afterP[1]).toBe(beforeP[1]! - s.pendingTrade!.give[1]! + s.pendingTrade!.receive[1]!);
    expect(afterT[0]).toBe(beforeT[0]! - s.pendingTrade!.receive[0]! + s.pendingTrade!.give[0]!);
    expect(afterT[1]).toBe(beforeT[1]! - s.pendingTrade!.receive[1]! + s.pendingTrade!.give[1]!);
  });

  it('does NOT add to rejectedTrades on accept', () => {
    const s = inTradeWithProposal();
    const out = reduce(s, { kind: 'tradeResponse', accept: true });
    expect(out.rejectedTrades).toHaveLength(0);
  });
});
