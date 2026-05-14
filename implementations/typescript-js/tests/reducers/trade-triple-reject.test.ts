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
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

const give = (a: number, b: number, c: number, d: number, e: number): Stockpile => [a, b, c, d, e];

function tradePhase(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 19 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'trade', currentPlayer: 0, pendingTrade: null };
  s.players[0]!.stockpile = give(5, 0, 0, 0, 0);
  s.players[1]!.stockpile = give(0, 5, 0, 0, 0);
  return s;
}

describe('triple-reject lockout', () => {
  it('blocks the 4th identical proposal in a year', () => {
    let s = tradePhase();
    const proposalArgs = {
      proposer: s.currentPlayer, tradee: (1 - s.currentPlayer) as 0 | 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0),
    } as const;

    for (let i = 0; i < 3; i++) {
      s = reduce(s, { kind: 'trade', ...proposalArgs });
      s = reduce(s, { kind: 'tradeResponse', accept: false });
    }
    expect(() => reduce(s, { kind: 'trade', ...proposalArgs })).toThrow(/already rejected|3 times/i);
  });

  it('allows a different trade after 3 rejections of the original', () => {
    let s = tradePhase();
    for (let i = 0; i < 3; i++) {
      s = reduce(s, {
        kind: 'trade',
        proposer: s.currentPlayer, tradee: (1 - s.currentPlayer) as 0 | 1,
        give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0),
      });
      s = reduce(s, { kind: 'tradeResponse', accept: false });
    }
    s = reduce(s, {
      kind: 'trade',
      proposer: s.currentPlayer, tradee: (1 - s.currentPlayer) as 0 | 1,
      give: give(2, 0, 0, 0, 0), receive: give(0, 2, 0, 0, 0),
    });
    expect(s.pendingTrade).not.toBeNull();
  });
});
