import { describe, it, expect } from 'vitest';
import { runAITurn } from '../../src/game/ai/runAITurn.js';
import type { GameState } from '../../src/game/types.js';

function bareState(
  phase: GameState['currentPhase'],
  persona: 'human' | 'passive' | 'defensive' | 'aggressive',
): GameState {
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: [{ color: 'red', name: 'r', persona }],
      citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories: [], touching: [], distance: [],
    boats: [], players: [
      { id: 0, name: 'r', color: 'red', persona, status: 'playing',
        stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
    ],
    turnOrder: [0], currentPhase: phase, currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [false],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  };
}

describe('runAITurn — early-exit cases', () => {
  it('returns immediately when current player is human', () => {
    const s = bareState('selection', 'human');
    const out = runAITurn(s);
    expect(out).toBe(s);
  });

  it('returns immediately when phase is gameOver', () => {
    const s = bareState('gameOver', 'aggressive');
    const out = runAITurn(s);
    expect(out).toBe(s);
  });
});
