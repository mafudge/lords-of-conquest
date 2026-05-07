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

function devEndState(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 107 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'development', currentPlayer: s.turnOrder[0]! };
  return s;
}

describe('endPhase: development → year wrap or game-over', () => {
  it('triggers gameOver when winner exists at year wrap', () => {
    let s = devEndState();
    let placed = 0;
    s.territories.forEach((t) => {
      if (t.ownerId === 0 && placed < 3) { t.hasCity = true; placed++; }
    });
    for (let i = 0; i < s.players.length; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(s.currentPhase).toBe('gameOver');
    const lastLog = s.log[s.log.length - 1]!;
    expect(lastLog.message).toMatch(/won|winner/i);
  });

  it('runs year wrap when no winner', () => {
    let s = devEndState();
    const startYear = s.year;
    for (let i = 0; i < s.players.length; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(s.currentPhase).toBe('production');
    expect(s.year).toBe(startYear + 1);
    expect(s.turnOrder[0]).not.toBe(2);
  });

  it('eliminates a player with zero territories', () => {
    let s = devEndState();
    s.territories.forEach((t) => {
      if (t.ownerId === 2) t.ownerId = 0;
    });
    for (let i = 0; i < s.players.length; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(s.players[2]!.status).toBe('eliminated');
    expect(s.turnOrder).not.toContain(2);
  });
});
