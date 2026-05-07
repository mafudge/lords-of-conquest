import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup3: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
    { color: 'cyan', name: 'c', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const setup2: GameSetup = { ...setup3, players: setup3.players.slice(0, 2) };

const initial = (s: GameSetup): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup: s, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function inProductionDone(s: GameSetup, seed: number): GameState {
  let st = reduce(initial(s), { kind: 'newGame', setup: s, seed });
  while (st.territories.some((t) => t.ownerId === null)) {
    const free = st.territories.find((t) => t.ownerId === null)!;
    st = reduce(st, { kind: 'selection', player: st.currentPlayer, territoryId: free.id });
  }
  st = reduce(st, { kind: 'endPhase', player: st.currentPlayer });
  // Force production tick to complete so the next endPhase is from production
  st = reduce(st, { kind: 'production' });
  // If production skipped (advanced to trade), restore to production for testing
  if (st.currentPhase === 'trade') st = { ...st, currentPhase: 'production' };
  return st;
}

describe('endPhase: production → trade', () => {
  it('3+ players: rolls 1/6 skip; advances to trade or shipment', () => {
    const s = inProductionDone(setup3, 42);
    const out = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(['trade', 'shipment']).toContain(out.currentPhase);
    if (out.currentPhase === 'shipment') {
      const last = out.log[out.log.length - 1]!;
      expect(last.message).toMatch(/skipped/i);
    }
  });

  it('2 players: trade is always skipped (regardless of roll)', () => {
    const s = inProductionDone(setup2, 42);
    const out = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(out.currentPhase).toBe('shipment');
    const messages = out.log.map((l) => l.message).join(' ');
    expect(messages).toMatch(/2 players|skipped/i);
  });
});
