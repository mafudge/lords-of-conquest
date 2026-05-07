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

function tradePhase(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 17 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'trade', currentPlayer: 0, pendingTrade: null };
  s.players[0]!.stockpile = give(3, 0, 0, 0, 0);
  s.players[1]!.stockpile = give(0, 3, 0, 0, 0);
  s.players[2]!.stockpile = give(0, 0, 3, 0, 0);
  return s;
}

describe('tradeRejectAll', () => {
  it('sets autoReject[tradee][trader] = true', () => {
    const s = tradePhase();
    const out = reduce(s, { kind: 'tradeRejectAll', tradee: 1, trader: 0 });
    expect(out.autoReject[1]![0]).toBe(true);
    expect(out.autoReject[0]![1]).toBe(false);
  });

  it('rejects a pending proposal from trader→tradee at the same time', () => {
    let s = tradePhase();
    s = reduce(s, {
      kind: 'trade',
      proposer: s.currentPlayer, tradee: 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0),
    });
    expect(s.pendingTrade).not.toBeNull();
    s = reduce(s, { kind: 'tradeRejectAll', tradee: 1, trader: s.currentPlayer });
    expect(s.pendingTrade).toBeNull();
  });

  it('blocks future proposals from same trader', () => {
    let s = tradePhase();
    s = reduce(s, { kind: 'tradeRejectAll', tradee: 1, trader: s.currentPlayer });
    expect(() => reduce(s, {
      kind: 'trade',
      proposer: s.currentPlayer, tradee: 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0),
    })).toThrow(/auto-reject/i);
  });
});
