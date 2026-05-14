import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';
import { REASONS } from '../../src/game/reasons.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
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

function drainSelection(s: GameState): GameState {
  for (let i = 0; i < s.territories.length; i++) {
    const free = s.territories.find((t) => t.ownerId === null);
    if (!free) break;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  return s;
}

describe('production phase skip behavior', () => {
  it('production plan applies a skip-or-tick decision (deterministic by seed)', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    s = drainSelection(s);
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    // Now in 'production' phase. Issue the production plan.
    const out = reduce(s, { kind: 'production' });
    // Either we ticked (still in production, ready for endPhase) OR we skipped
    // (phase advanced to trade with a log entry from REASONS).
    if (out.currentPhase === 'trade') {
      const lastLog = out.log[out.log.length - 1]!;
      expect(REASONS).toContain(lastLog.message.replace(/^Production skipped: /, ''));
    } else {
      expect(out.currentPhase).toBe('production');
    }
  });

  it('production decision is deterministic per (seed, year, rngCursor)', () => {
    let a = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    a = drainSelection(a);
    a = reduce(a, { kind: 'endPhase', player: a.currentPlayer });
    a = reduce(a, { kind: 'production' });

    let b = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    b = drainSelection(b);
    b = reduce(b, { kind: 'endPhase', player: b.currentPlayer });
    b = reduce(b, { kind: 'production' });

    expect(a.currentPhase).toBe(b.currentPhase);
    expect(a.log.length).toBe(b.log.length);
  });

  it('production plan rejects when not in production phase', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    expect(() => reduce(s, { kind: 'production' })).toThrow(/phase/i);
  });
});
