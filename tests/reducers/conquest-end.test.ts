import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, PlayerId } from '../../src/game/types.js';

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

function conquestStart(forfeit?: PlayerId): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 83 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  const ff = [false, false, false];
  if (forfeit !== undefined) ff[forfeit] = true;
  s = { ...s, currentPhase: 'conquest', currentPlayer: s.turnOrder[0]!,
    attackNumber: 1, pendingCombat: null,
    shipmentForfeitsSecondAttack: ff };
  return s;
}

describe('endPhase: conquest rotation', () => {
  it('endPhase from conquest with attackNumber=1 advances to attack #2', () => {
    const s = conquestStart();
    const out = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(out.currentPhase).toBe('conquest');
    expect(out.attackNumber).toBe(2);
    expect(out.currentPlayer).toBe(s.currentPlayer);
  });

  it('endPhase from attack #2 rotates to next player and resets attackNumber', () => {
    let s = conquestStart();
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(s.attackNumber).toBe(1);
    expect(s.currentPlayer).toBe(s.turnOrder[1]!);
  });

  it('shipmentForfeitsSecondAttack[player]=true skips attack #2', () => {
    // Build base state, then forfeit the actual first conquest player
    const base = conquestStart();
    const firstConquestPlayer = base.currentPlayer; // == turnOrder[0]
    const ff = [false, false, false] as boolean[];
    ff[firstConquestPlayer] = true;
    const s = { ...base, shipmentForfeitsSecondAttack: ff };
    const out = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(out.attackNumber).toBe(1);
    expect(out.currentPlayer).toBe(s.turnOrder[1]!);
  });

  it('after last player ends, advances to development', () => {
    let s = conquestStart();
    for (let i = 0; i < 6; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(s.currentPhase).toBe('development');
    expect(s.currentPlayer).toBe(s.turnOrder[0]!);
  });

  it('rejects endPhase when combat is pending', () => {
    const s = conquestStart();
    s.pendingCombat = {
      attackerId: 0, defenderId: 1,
      fromTerritoryId: 0, targetTerritoryId: 1,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
      alliesDecisions: [], alliesPending: new Set<PlayerId>([2 as PlayerId]),
      attackerStrength: 1, defenderStrength: 1,
      resolved: false, attackerWon: false,
    };
    expect(() => reduce(s, { kind: 'endPhase', player: s.currentPlayer }))
      .toThrow(/pending|combat/i);
  });
});
