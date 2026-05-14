// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderTileGlyphs, getCentroidSquare } from '../../../src/ui/render/tile.js';
import { renderShell } from '../../../src/ui/render/shell.js';
import { renderBoard } from '../../../src/ui/render/board.js';
import type { GameState } from '../../../src/game/types.js';

function fakeState(opts: { hasCity?: boolean; hasWeapon?: boolean; hasHorse?: boolean; hasStockpile?: boolean } = {}): GameState {
  const squares = [];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 40; x++)
    squares.push({ x, y, lakeId: null, territoryId: x < 4 && y < 4 ? 0 : null } as any);
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: { players: [{ color: 'red', name: 'Red', persona: 'aggressive' }],
      citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: 1,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } } },
    squares,
    territories: [{
      id: 0, ownerId: 0, resource: null, hasResourceDouble: false,
      hasCity: opts.hasCity ?? false, hasWeapon: opts.hasWeapon ?? false,
      hasHorse: opts.hasHorse ?? false, hasStockpile: opts.hasStockpile ?? false,
      squares: [0, 1, 2, 3, 40, 41, 42, 43], bordersLakes: new Set(), citiesAdjacent: 0,
    } as any],
    touching: [], distance: [], boats: [],
    players: [{ id: 0, name: 'Red', color: 'red', persona: 'aggressive', status: 'playing',
      stockpile: [0,0,0,0,0], stockpileLocation: null }],
    turnOrder: [0], currentPhase: 'production', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [false],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  } as GameState;
}

describe('renderTileGlyphs', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    renderShell(document.getElementById('app')!);
  });

  it('renders a city glyph when territory.hasCity', () => {
    renderBoard(fakeState({ hasCity: true }));
    renderTileGlyphs(fakeState({ hasCity: true }));
    expect(document.querySelector('.glyph-city')).not.toBeNull();
  });

  it('renders a weapon glyph when territory.hasWeapon', () => {
    renderBoard(fakeState({ hasWeapon: true }));
    renderTileGlyphs(fakeState({ hasWeapon: true }));
    expect(document.querySelector('.glyph-weapon')).not.toBeNull();
  });

  it('renders a horse glyph when territory.hasHorse', () => {
    renderBoard(fakeState({ hasHorse: true }));
    renderTileGlyphs(fakeState({ hasHorse: true }));
    expect(document.querySelector('.glyph-horse')).not.toBeNull();
  });

  it('renders a stockpile glyph when territory.hasStockpile', () => {
    renderBoard(fakeState({ hasStockpile: true }));
    renderTileGlyphs(fakeState({ hasStockpile: true }));
    expect(document.querySelector('.glyph-stockpile')).not.toBeNull();
  });

  it('getCentroidSquare returns the median square index', () => {
    const t = { squares: [0, 1, 2, 3, 40, 41, 42, 43] } as any;
    const c = getCentroidSquare(t);
    expect(typeof c).toBe('number');
    expect(t.squares).toContain(c);
  });
});
