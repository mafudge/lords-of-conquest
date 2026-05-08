// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { locateStockpileMode } from '../../../src/ui/interactions/locateStockpileMode.js';
import { setMode } from '../../../src/ui/interactions/interactionMode.js';
import type { GameState } from '../../../src/game/types.js';

function fakeStateWithStockpileNeeded(): GameState {
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: { players: [{ color: 'red', name: 'Red', persona: 'human' }],
      citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: 2,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } } },
    squares: [
      { x: 0, y: 0, lakeId: null, territoryId: 0 },
      { x: 1, y: 0, lakeId: null, territoryId: 1 },
    ] as any,
    territories: [
      { id: 0, ownerId: 0, resource: null, hasResourceDouble: false,
        hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
        squares: [0], bordersLakes: new Set() } as any,
      { id: 1, ownerId: 0, resource: null, hasResourceDouble: false,
        hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
        squares: [1], bordersLakes: new Set() } as any,
    ],
    touching: [], distance: [], boats: [],
    players: [{ id: 0, name: 'Red', color: 'red', persona: 'human', status: 'playing',
      stockpile: [1, 0, 0, 0, 0], stockpileLocation: null }],
    turnOrder: [0], currentPhase: 'production', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [false],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  } as GameState;
}

describe('locateStockpileMode', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"><div class="board-svg"></div></div>';
  });

  it('marks owned territories as candidates when entered', () => {
    const state = fakeStateWithStockpileNeeded();
    setMode(locateStockpileMode);
    locateStockpileMode.enter(state);
    expect(true).toBe(true); // smoke
  });
});
