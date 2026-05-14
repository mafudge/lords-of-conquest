import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, Stockpile } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'Red', persona: 'human' },
    { color: 'blue', name: 'Blue', persona: 'aggressive' },
    { color: 'cyan', name: 'Cyan', persona: 'defensive' },
  ],
  citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
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

describe('trade + shipment full sequence', () => {
  it('runs NEW_GAME → selection → production → trade → shipment → conquest', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 12345 });
    while (s.territories.some((t) => t.ownerId === null)) {
      const free = s.territories.find((t) => t.ownerId === null)!;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(s.currentPhase).toBe('production');
    s = reduce(s, { kind: 'production' });
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });

    if (s.currentPhase === 'trade') {
      for (let i = 0; i < s.players.length; i++) {
        s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      }
    }
    expect(['shipment', 'conquest']).toContain(s.currentPhase);
    if (s.currentPhase !== 'shipment') return;

    for (let i = 0; i < s.players.length; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(s.currentPhase).toBe('conquest');
    expect(s.attackNumber).toBe(1);
  });

  it('autoReject blocks future trades from blocked player', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 999 });
    while (s.territories.some((t) => t.ownerId === null)) {
      const free = s.territories.find((t) => t.ownerId === null)!;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    s = reduce(s, { kind: 'production' });
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    if (s.currentPhase !== 'trade') return;
    s.players[s.currentPlayer]!.stockpile = give(3, 0, 0, 0, 0);
    s.players[(s.currentPlayer + 1) % s.players.length]!.stockpile = give(0, 3, 0, 0, 0);
    const tradee = ((s.currentPlayer + 1) % s.players.length) as 0 | 1 | 2;
    s = reduce(s, { kind: 'tradeRejectAll', tradee, trader: s.currentPlayer });
    expect(() => reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee,
      give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0),
    })).toThrow(/auto-reject/i);
  });
});
