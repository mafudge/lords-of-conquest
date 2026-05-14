import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'Red', persona: 'human' },
    { color: 'blue', name: 'Blue', persona: 'aggressive' },
    { color: 'cyan', name: 'Cyan', persona: 'defensive' },
  ],
  citiesToWin: 8, elementOfChance: 'high', randomizePlayerOrder: false,
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

describe('full-year snapshot', () => {
  it('walks through one complete year ending in production of year 2', () => {
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
    if (s.currentPhase === 'shipment') {
      for (let i = 0; i < s.players.length; i++) {
        s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      }
    }
    expect(s.currentPhase).toBe('conquest');
    for (let i = 0; i < s.players.length * 2; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      if (s.currentPhase !== 'conquest') break;
    }
    expect(s.currentPhase).toBe('development');
    for (let i = 0; i < s.players.length; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(['production', 'gameOver']).toContain(s.currentPhase);
    if (s.currentPhase === 'production') {
      expect(s.year).toBe(2);
    }
  });

  it('runs 3 years with no actions and reaches year 4 production', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 9999 });
    while (s.territories.some((t) => t.ownerId === null)) {
      const free = s.territories.find((t) => t.ownerId === null)!;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    for (let yr = 0; yr < 3; yr++) {
      s = reduce(s, { kind: 'production' });
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      if (s.currentPhase === 'trade') {
        for (let i = 0; i < s.players.length; i++) {
          s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
        }
      }
      if (s.currentPhase === 'shipment') {
        for (let i = 0; i < s.players.length; i++) {
          s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
        }
      }
      while (s.currentPhase === 'conquest') {
        s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      }
      while (s.currentPhase === 'development') {
        s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      }
    }
    expect(['production', 'gameOver']).toContain(s.currentPhase);
    if (s.currentPhase === 'production') expect(s.year).toBe(4);
  });
});
