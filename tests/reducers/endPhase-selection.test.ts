import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
    { color: 'cyan', name: 'c', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: {
    waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' },
  },
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

describe('endPhase: selection → production', () => {
  it('reverses turn order and transitions to production', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    const originalOrder = [...s.turnOrder];
    // Drain all 24 territories
    for (let i = 0; i < 24; i++) {
      const free = s.territories.find((t) => t.ownerId === null);
      if (!free) break;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(s.currentPhase).toBe('production');
    expect(s.turnOrder).toEqual([...originalOrder].reverse());
    expect(s.currentPlayer).toBe(s.turnOrder[0]!);
  });

  it('rejects endPhase from selection when territories remain unowned', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    // Only one selection
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    expect(() => reduce(s, { kind: 'endPhase', player: s.currentPlayer }))
      .toThrow(/unowned territories/i);
  });

  it('rejects endPhase from a phase Plan 2 does not handle', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    // Drain selection
    for (let i = 0; i < 24; i++) {
      const free = s.territories.find((t) => t.ownerId === null);
      if (!free) break;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    // Now in production; endPhase from production is not in Plan 2
    expect(() => reduce(s, { kind: 'endPhase', player: s.currentPlayer }))
      .toThrow(/not implemented|production/i);
  });
});
