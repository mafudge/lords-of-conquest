// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderBoats, renderForceBadges } from '../../../src/ui/render/boat.js';
import { renderShell } from '../../../src/ui/render/shell.js';
import { renderBoard } from '../../../src/ui/render/board.js';
import type { GameState } from '../../../src/game/types.js';

function squaresFor40x20() {
  const out = [];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 40; x++)
    out.push({ x, y, lakeId: x === 5 && y === 5 ? 1 : null, territoryId: null } as any);
  return out;
}

function baseState(): GameState {
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: { players: [{ color: 'red', name: 'Red', persona: 'aggressive' }],
      citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: 1,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } } },
    squares: squaresFor40x20(),
    territories: [], touching: [], distance: [], boats: [],
    players: [{ id: 0, name: 'Red', color: 'red', persona: 'aggressive', status: 'playing',
      stockpile: [0,0,0,0,0], stockpileLocation: null }],
    turnOrder: [0], currentPhase: 'production', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [false],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  } as GameState;
}

describe('renderBoats / renderForceBadges', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    renderShell(document.getElementById('app')!);
  });

  it('renders one boat sprite per valid boat', () => {
    const s = baseState();
    s.boats = [{ id: 0, x: 5, y: 5, ownerId: 0, homeTerritoryId: 0,
      carryHorse: false, carryWeapon: false } as any];
    renderBoard(s);
    renderBoats(s);
    expect(document.querySelector('.boat-sprite[data-boat-id="0"]')).not.toBeNull();
  });

  it('does not render force badges when toggle is off', () => {
    renderBoard(baseState());
    renderForceBadges(baseState(), false);
    expect(document.querySelectorAll('.force-badge').length).toBe(0);
  });
});
