import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import { encodeMap } from '../../src/game/mapTextCodec.js';
import { generateMap } from '../../src/game/mapgen/index.js';
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
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

describe('loadMap', () => {
  it('replaces the board with a decoded one and resets ownership to null', () => {
    // Generate a board and encode it
    const board = generateMap(123, setup.map, 2);
    const text = encodeMap(board.squares);
    // Start a game with a different seed
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 999 });
    // Take some territory selections
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: 0 });
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: 1 });
    // Now load the other map
    const out = reduce(s, { kind: 'loadMap', mapText: text });
    expect(out.territories.every((t) => t.ownerId === null)).toBe(true);
    expect(out.currentPhase).toBe('selection');
    expect(out.touching).toBeDefined();
    expect(out.touching.length).toBe(out.territories.length);
  });

  it('rejects invalid map text', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    expect(() => reduce(s, { kind: 'loadMap', mapText: 'not a map' }))
      .toThrow(/decode|invalid/i);
  });
});
