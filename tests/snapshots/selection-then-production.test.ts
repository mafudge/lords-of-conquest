import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'Red', persona: 'human' },
    { color: 'blue', name: 'Blue', persona: 'aggressive' },
    { color: 'cyan', name: 'Cyan', persona: 'defensive' },
    { color: 'purple', name: 'Purple', persona: 'passive' },
  ],
  citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
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

describe('selection → first production', () => {
  it('completes deterministically and produces stockpile yield', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 12345 });

    // Drain selection
    while (s.territories.some((t) => t.ownerId === null)) {
      const free = s.territories.find((t) => t.ownerId === null)!;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    expect(s.territories.every((t) => t.ownerId !== null)).toBe(true);

    // Move to production
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(s.currentPhase).toBe('production');
    expect(s.turnOrder).toEqual([3, 2, 1, 0]); // reversed from [0,1,2,3]

    // Run production. It might skip; if so, we're now in 'trade'.
    const beforeStockpiles = s.players.map((p) => [...p.stockpile]);
    s = reduce(s, { kind: 'production' });

    if (s.currentPhase === 'trade') {
      // Skipped — confirm no stockpile change.
      const afterStockpiles = s.players.map((p) => [...p.stockpile]);
      expect(afterStockpiles).toEqual(beforeStockpiles);
      const lastLog = s.log[s.log.length - 1]!;
      expect(lastLog.message).toMatch(/skipped/i);
    } else {
      // Ticked — at least one player should have +1 in some slot.
      const totalProduced = s.players
        .flatMap((p) => p.stockpile)
        .reduce((a, b) => a + b, 0);
      expect(totalProduced).toBeGreaterThan(0);
    }
  });

  it('runs identically on a re-run with the same seed', () => {
    function run(seed: number): GameState {
      let s = reduce(initial(), { kind: 'newGame', setup, seed });
      while (s.territories.some((t) => t.ownerId === null)) {
        const free = s.territories.find((t) => t.ownerId === null)!;
        s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
      }
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      s = reduce(s, { kind: 'production' });
      return s;
    }
    const a = run(12345);
    const b = run(12345);
    expect(a.players.map((p) => p.stockpile)).toEqual(b.players.map((p) => p.stockpile));
    expect(a.currentPhase).toBe(b.currentPhase);
    expect(a.log.length).toBe(b.log.length);
  });
});
