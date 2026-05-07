import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [{ color: 'red', name: 'r', persona: 'human' }, { color: 'blue', name: 'b', persona: 'human' }],
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

describe('savegame & loadGame', () => {
  it('savegame appends a log entry without mutating other state', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    const yearBefore = s.year;
    const out = reduce(s, { kind: 'savegame', slot: 'autosave' });
    expect(out.year).toBe(yearBefore);
    const last = out.log[out.log.length - 1]!;
    expect(last.message).toMatch(/saved/i);
    expect(last.message).toMatch(/autosave/);
  });

  it('loadGame replaces the entire state with the provided state', () => {
    const a = reduce(initial(), { kind: 'newGame', setup, seed: 1 });
    const b = reduce(initial(), { kind: 'newGame', setup, seed: 2 });
    const out = reduce(a, { kind: 'loadGame', state: b });
    expect(out.seed).toBe(2);
    expect(out.squares).toEqual(b.squares);
  });

  it('loadGame validates schema version', () => {
    const a = reduce(initial(), { kind: 'newGame', setup, seed: 1 });
    const fake = { ...a, schemaVersion: 999 as 1 };
    expect(() => reduce(a, { kind: 'loadGame', state: fake })).toThrow(/schema/i);
  });
});
