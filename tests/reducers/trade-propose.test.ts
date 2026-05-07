import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
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
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

const give = (a: number, b: number, c: number, d: number, e: number): Stockpile => [a, b, c, d, e];

function tradePhaseState(seed = 7): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'trade', currentPlayer: 0, pendingTrade: null };
  s.players[0]!.stockpile = give(3, 1, 0, 0, 0);
  s.players[1]!.stockpile = give(0, 0, 2, 1, 0);
  s.players[2]!.stockpile = give(0, 0, 0, 0, 0);
  return s;
}

describe('trade propose', () => {
  it('valid proposal sets pendingTrade with status "proposed"', () => {
    const s = tradePhaseState();
    const out = reduce(s, {
      kind: 'trade',
      proposer: s.currentPlayer, tradee: 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 0, 1, 0, 0),
    });
    expect(out.pendingTrade).not.toBeNull();
    expect(out.pendingTrade!.proposerId).toBe(s.currentPlayer);
    expect(out.pendingTrade!.tradeeId).toBe(1);
    expect(out.pendingTrade!.status).toBe('proposed');
    expect(out.players[s.currentPlayer]!.stockpile).toEqual(s.players[s.currentPlayer]!.stockpile);
  });

  it('rejects when phase is not trade', () => {
    const s = { ...tradePhaseState(), currentPhase: 'production' as const };
    expect(() => reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee: 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 0, 1, 0, 0),
    })).toThrow(/phase/i);
  });

  it('rejects when proposer is not currentPlayer', () => {
    const s = tradePhaseState();
    const wrong = (s.currentPlayer === 0 ? 1 : 0) as 0 | 1;
    expect(() => reduce(s, {
      kind: 'trade', proposer: wrong, tradee: 2,
      give: give(1, 0, 0, 0, 0), receive: give(0, 0, 1, 0, 0),
    })).toThrow(/current player/i);
  });

  it('rejects when proposer cannot cover give', () => {
    const s = tradePhaseState();
    expect(() => reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee: 1,
      give: give(99, 0, 0, 0, 0), receive: give(0, 0, 1, 0, 0),
    })).toThrow(/insufficient/i);
  });

  it('rejects when tradee cannot cover receive', () => {
    const s = tradePhaseState();
    expect(() => reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee: 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 0, 99, 0, 0),
    })).toThrow(/insufficient/i);
  });

  it('rejects all-zeros (null) trade', () => {
    const s = tradePhaseState();
    expect(() => reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee: 1,
      give: give(0, 0, 0, 0, 0), receive: give(0, 0, 0, 0, 0),
    })).toThrow(/empty trade|null trade/i);
  });

  it('rejects when a trade is already pending', () => {
    let s = tradePhaseState();
    s = reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee: 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 0, 1, 0, 0),
    });
    expect(() => reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee: 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 0, 1, 0, 0),
    })).toThrow(/already pending/i);
  });

  it('rejects when tradee is the proposer', () => {
    const s = tradePhaseState();
    expect(() => reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee: s.currentPlayer,
      give: give(1, 0, 0, 0, 0), receive: give(0, 0, 1, 0, 0),
    })).toThrow(/different player/i);
  });
});
