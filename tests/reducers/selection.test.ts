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
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function bootstrap(seed: number): GameState {
  return reduce(initial(), { kind: 'newGame', setup, seed });
}

describe('selection plan', () => {
  it('assigns owner of an unowned territory and advances currentPlayer', () => {
    const s0 = bootstrap(99);
    const player = s0.currentPlayer;
    const target = s0.territories.find((t) => t.ownerId === null)!.id;
    const s1 = reduce(s0, { kind: 'selection', player, territoryId: target });
    expect(s1.territories.find((t) => t.id === target)!.ownerId).toBe(player);
    // currentPlayer rotates within turnOrder
    const idx = s0.turnOrder.indexOf(player);
    expect(s1.currentPlayer).toBe(s0.turnOrder[(idx + 1) % s0.turnOrder.length]);
  });

  it('rejects selection when phase is not selection', () => {
    const s0 = bootstrap(99);
    const s1 = { ...s0, currentPhase: 'production' as const };
    expect(() => reduce(s1, { kind: 'selection', player: s0.currentPlayer, territoryId: 0 }))
      .toThrow(/phase/i);
  });

  it('rejects selection by wrong player', () => {
    const s0 = bootstrap(99);
    const wrong = (s0.currentPlayer === 0 ? 1 : 0) as 0 | 1;
    expect(() => reduce(s0, { kind: 'selection', player: wrong, territoryId: 0 }))
      .toThrow(/current player/i);
  });

  it('rejects selecting an already-owned territory', () => {
    const s0 = bootstrap(99);
    const target = s0.territories[0]!.id;
    const s1 = reduce(s0, { kind: 'selection', player: s0.currentPlayer, territoryId: target });
    expect(() => reduce(s1, { kind: 'selection', player: s1.currentPlayer, territoryId: target }))
      .toThrow(/unowned/i);
  });

  it('rejects nonexistent territory', () => {
    const s0 = bootstrap(99);
    expect(() => reduce(s0, { kind: 'selection', player: s0.currentPlayer, territoryId: 9999 }))
      .toThrow(/territory/i);
  });

  it('handles a 3-player draft of all 24 territories', () => {
    let s = bootstrap(7);
    for (let i = 0; i < 24; i++) {
      const free = s.territories.find((t) => t.ownerId === null);
      if (!free) break;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    const owned = s.territories.filter((t) => t.ownerId !== null);
    expect(owned).toHaveLength(24);
    // Even distribution-ish: each player owns 7 or 8
    const counts = [0, 0, 0];
    for (const t of s.territories) counts[t.ownerId!]!++;
    expect(counts.reduce((a, b) => a + b, 0)).toBe(24);
  });
});
