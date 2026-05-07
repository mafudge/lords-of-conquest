import { describe, it, expect } from 'vitest';
import { decideAction } from '../../src/game/ai/decideAction.js';
import type { GameState } from '../../src/game/types.js';

function bareState(phase: GameState['currentPhase']): GameState {
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: [{ color: 'red', name: 'r', persona: 'aggressive' }],
      citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories: [], touching: [], distance: [],
    boats: [], players: [
      { id: 0, name: 'r', color: 'red', persona: 'aggressive', status: 'playing',
        stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
    ],
    turnOrder: [0], currentPhase: phase, currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [false],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  };
}

describe('decideAction skeleton', () => {
  it('throws for unknown phases (gameOver, setup)', () => {
    expect(() => decideAction(bareState('gameOver'), 0))
      .toThrow(/gameOver|caller error/i);
    expect(() => decideAction(bareState('setup'), 0))
      .toThrow(/setup|caller error/i);
  });

  it('throws "not implemented yet" for phases not yet wired', () => {
    expect(() => decideAction(bareState('conquest'), 0))
      .toThrow(/not implemented yet/i);
  });
});
