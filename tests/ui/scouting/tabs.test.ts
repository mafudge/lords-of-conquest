// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderStockpilesTab } from '../../../src/ui/scouting/stockpilesTab.js';
import { renderSaveMapTab } from '../../../src/ui/scouting/saveMapTab.js';
import { renderBoatInfoTab, setSelectedBoat } from '../../../src/ui/scouting/boatInfoTab.js';
import type { GameState } from '../../../src/game/types.js';

function fakeSquares() {
  const squares = [];
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 40; x++) {
      squares.push({ x, y, territoryId: null, lakeId: null, isBoundaryWater: false });
    }
  }
  return squares;
}

function fakeState(): GameState {
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: { players: [{ color: 'red', name: 'Red', persona: 'aggressive' }],
      citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: 1,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } } },
    squares: fakeSquares(), territories: [], touching: [], distance: [], boats: [],
    players: [{ id: 0, name: 'Red', color: 'red', persona: 'aggressive', status: 'playing',
      stockpile: [3,2,1,0,1], stockpileLocation: 0 }],
    turnOrder: [0], currentPhase: 'production', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [false],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  } as GameState;
}

describe('scouting tabs', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="tab-panel" data-panel="stockpiles"></div>
      <div class="tab-panel" data-panel="save-map"></div>
      <div class="tab-panel" data-panel="boat"></div>`;
  });

  it('Stockpiles tab lists each player', () => {
    renderStockpilesTab(fakeState());
    expect(document.querySelector('[data-panel="stockpiles"]')!.textContent).toContain('Red');
    expect(document.querySelector('[data-panel="stockpiles"]')!.textContent).toContain('Iron');
  });

  it('Save Map tab shows a textarea', () => {
    renderSaveMapTab(fakeState());
    expect(document.querySelector<HTMLTextAreaElement>('[data-panel="save-map"] textarea')).not.toBeNull();
  });

  it('Boat Info tab shows hint when no boat selected', () => {
    setSelectedBoat(null);
    renderBoatInfoTab(fakeState());
    expect(document.querySelector('[data-panel="boat"]')!.textContent).toContain('Click any boat');
  });
});
