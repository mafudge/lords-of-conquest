import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { Plan } from '../../src/game/plans.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'Red', persona: 'human' },
    { color: 'blue', name: 'Blue', persona: 'aggressive' },
    { color: 'cyan', name: 'Cyan', persona: 'defensive' },
    { color: 'purple', name: 'Purple', persona: 'passive' },
  ],
  citiesToWin: 5,
  elementOfChance: 'high',
  randomizePlayerOrder: false,
  map: {
    waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' },
  },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], touching: [], distance: [], boats: [], players: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

describe('NEW_GAME', () => {
  it('initializes 4 players with empty stockpiles', () => {
    const out = reduce(initial(), { kind: 'newGame', setup, seed: 12345 });
    expect(out.players).toHaveLength(4);
    expect(out.players[0]!.stockpile).toEqual([0, 0, 0, 0, 0]);
    expect(out.players[0]!.stockpileLocation).toBeNull();
    expect(out.players.map((p) => p.color)).toEqual(['red', 'blue', 'cyan', 'purple']);
  });

  it('runs map generation deterministically per seed', () => {
    const a = reduce(initial(), { kind: 'newGame', setup, seed: 12345 });
    const b = reduce(initial(), { kind: 'newGame', setup, seed: 12345 });
    expect(a.squares).toEqual(b.squares);
    expect(a.territories.map((t) => t.squares)).toEqual(b.territories.map((t) => t.squares));
  });

  it('transitions to selection phase, year=1, currentPlayer=turnOrder[0]', () => {
    const out = reduce(initial(), { kind: 'newGame', setup, seed: 1 });
    expect(out.currentPhase).toBe('selection');
    expect(out.year).toBe(1);
    expect(out.currentPlayer).toBe(out.turnOrder[0]!);
  });

  it('non-randomized order is [0, 1, …, n-1]', () => {
    const out = reduce(initial(), { kind: 'newGame', setup, seed: 1 });
    expect(out.turnOrder).toEqual([0, 1, 2, 3]);
  });

  it('randomized order shuffles via seeded RNG (deterministic)', () => {
    const setupRand = { ...setup, randomizePlayerOrder: true };
    const a = reduce(initial(), { kind: 'newGame', setup: setupRand, seed: 7 });
    const b = reduce(initial(), { kind: 'newGame', setup: setupRand, seed: 7 });
    expect(a.turnOrder).toEqual(b.turnOrder);
    expect(new Set(a.turnOrder)).toEqual(new Set([0, 1, 2, 3]));
  });

  it('boats slot pool is 256 nulls, autoReject is N×N false', () => {
    const out = reduce(initial(), { kind: 'newGame', setup, seed: 1 });
    expect(out.boats).toHaveLength(256);
    expect(out.boats.every((b) => b === null)).toBe(true);
    expect(out.autoReject).toHaveLength(4);
    expect(out.autoReject.every((row) => row.length === 4 && row.every((v) => v === false))).toBe(true);
  });

  it('rejects setup with fewer than 2 players', () => {
    const bad = { ...setup, players: setup.players.slice(0, 1) };
    expect(() => reduce(initial(), { kind: 'newGame', setup: bad, seed: 1 })).toThrow(/at least 2/i);
  });

  it('rejects setup with more than 7 players', () => {
    const bad = {
      ...setup,
      players: [
        { color: 'red' as const, name: 'r', persona: 'human' as const },
        { color: 'blue' as const, name: 'b', persona: 'human' as const },
        { color: 'cyan' as const, name: 'c', persona: 'human' as const },
        { color: 'purple' as const, name: 'p', persona: 'human' as const },
        { color: 'orange' as const, name: 'o', persona: 'human' as const },
        { color: 'green' as const, name: 'g', persona: 'human' as const },
        { color: 'yellow' as const, name: 'y', persona: 'human' as const },
        { color: 'red' as const, name: 'r2', persona: 'human' as const },
      ],
    };
    expect(() => reduce(initial(), { kind: 'newGame', setup: bad, seed: 1 })).toThrow(/at most 7/i);
  });
});
