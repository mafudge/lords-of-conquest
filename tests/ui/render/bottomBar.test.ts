// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderBottomBar } from '../../../src/ui/render/bottomBar.js';
import { renderShell } from '../../../src/ui/render/shell.js';
import type { GameState } from '../../../src/game/types.js';

function fakeState(): GameState {
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: { players: [
      { color: 'red', name: 'Red', persona: 'aggressive' },
      { color: 'blue', name: 'Blue', persona: 'aggressive' },
    ], citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } } },
    squares: [], territories: [], touching: [], distance: [], boats: [],
    players: [
      { id: 0, name: 'Red', color: 'red', persona: 'aggressive', status: 'playing',
        stockpile: [3,2,1,0,1], stockpileLocation: null },
      { id: 1, name: 'Blue', color: 'blue', persona: 'aggressive', status: 'playing',
        stockpile: [0,0,0,0,0], stockpileLocation: null },
    ],
    turnOrder: [0, 1], currentPhase: 'trade', currentPlayer: 0,
    year: 3, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [false, false],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  } as GameState;
}

describe('renderBottomBar', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    renderShell(document.getElementById('app')!);
  });

  it('renders one pill per active player', () => {
    renderBottomBar(fakeState(), []);
    expect(document.querySelectorAll('.pills .pill')).toHaveLength(2);
  });

  it('marks the current player pill as active', () => {
    renderBottomBar(fakeState(), []);
    const pills = document.querySelectorAll('.pills .pill');
    expect(pills[0]!.getAttribute('data-active')).toBe('true');
    expect(pills[1]!.getAttribute('data-active')).toBeNull();
  });

  it('renders the provided actions in the actions slot', () => {
    renderBottomBar(fakeState(), [
      { label: 'End Trade', kind: 'primary', onClick: () => {} },
    ]);
    expect(document.querySelector('.actions button')!.textContent).toBe('End Trade');
  });
});
