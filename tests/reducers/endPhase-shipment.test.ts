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

function shipmentPhase(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 41 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'shipment', currentPlayer: s.turnOrder[0]!, shipmentUsed: false, shipmentForfeitsSecondAttack: false };
  return s;
}

describe('endPhase: shipment', () => {
  it('rotates player and resets shipmentUsed within phase', () => {
    let s = shipmentPhase();
    s = { ...s, shipmentUsed: true };
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(s.currentPhase).toBe('shipment');
    expect(s.shipmentUsed).toBe(false);
    expect(s.currentPlayer).toBe(s.turnOrder[1]!);
  });

  it('advances to conquest when last player ends shipment', () => {
    let s = shipmentPhase();
    for (let i = 0; i < s.players.length; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(s.currentPhase).toBe('conquest');
    expect(s.attackNumber).toBe(1);
    expect(s.shipmentUsed).toBe(false);
    expect(s.shipmentForfeitsSecondAttack).toBe(false);
    expect(s.currentPlayer).toBe(s.turnOrder[0]!);
  });
});
