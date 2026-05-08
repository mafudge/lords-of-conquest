// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderTopBar } from '../../../src/ui/render/topBar.js';
import { renderShell } from '../../../src/ui/render/shell.js';
import type { GameState } from '../../../src/game/types.js';

function fakeState(overrides: Partial<GameState> = {}): GameState {
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: [
        { color: 'red', name: 'Red', persona: 'aggressive' },
        { color: 'blue', name: 'Blue', persona: 'defensive' },
      ],
      citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories: [], touching: [], distance: [], boats: [],
    players: [
      { id: 0, name: 'Red', color: 'red', persona: 'aggressive', status: 'playing',
        stockpile: [0,0,0,0,0], stockpileLocation: null },
      { id: 1, name: 'Blue', color: 'blue', persona: 'defensive', status: 'playing',
        stockpile: [0,0,0,0,0], stockpileLocation: null },
    ],
    turnOrder: [0, 1], currentPhase: 'trade', currentPlayer: 0,
    year: 3, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [false, false],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
    ...overrides,
  } as GameState;
}

describe('renderTopBar', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    renderShell(document.getElementById('app')!);
  });

  it('renders year and phase labels', () => {
    renderTopBar(fakeState());
    expect(document.querySelector('.year-badge')!.textContent).toContain('Year 3');
    expect(document.querySelector('.phase-label')!.textContent).toContain('Trade');
  });

  it('renders one mini-avatar per active player and rings the active one', () => {
    renderTopBar(fakeState());
    const avatars = document.querySelectorAll('.turn-strip .avatar');
    expect(avatars).toHaveLength(2);
    expect(avatars[0]!.getAttribute('data-active')).toBe('true');
  });

  it('renders Scouting Report button and gear menu button', () => {
    renderTopBar(fakeState());
    expect(document.querySelector('.btn-scouting')).not.toBeNull();
    expect(document.querySelector('.btn-menu')).not.toBeNull();
  });

  it('renders empty status banner during human turn', () => {
    const s = fakeState();
    s.players[0]!.persona = 'human';
    renderTopBar(s);
    expect(document.querySelector('.status-banner')!.textContent!.trim()).toBe('');
  });
});
