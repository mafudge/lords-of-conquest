// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderBoard } from '../../../src/ui/render/board.js';
import { renderShell } from '../../../src/ui/render/shell.js';
import type { GameState, Square } from '../../../src/game/types.js';

function squaresFor40x20(): Square[] {
  const out: Square[] = [];
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 40; x++) {
      out.push({ x, y, lakeId: null, territoryId: null } as any);
    }
  }
  return out;
}

function fakeState(): GameState {
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

describe('renderBoard', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    renderShell(document.getElementById('app')!);
  });

  it('renders an SVG with 800 squares (40 × 20)', () => {
    renderBoard(fakeState());
    const svg = document.querySelector('.board-svg');
    expect(svg).not.toBeNull();
    const rects = document.querySelectorAll('.board-svg .sq');
    expect(rects).toHaveLength(800);
  });

  it('water squares (lakeId !== null) get the water class', () => {
    const s = fakeState();
    s.squares[0] = { x: 0, y: 0, lakeId: 1, territoryId: null } as any;
    renderBoard(s);
    expect(document.querySelector('.board-svg .sq[data-x="0"][data-y="0"]')!
      .classList.contains('water')).toBe(true);
  });
});
