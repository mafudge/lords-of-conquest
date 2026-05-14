import { reduce } from '../../game/reducer.js';
import type { GameState, GameSetup } from '../../game/types.js';
import { renderBoard } from '../render/board.js';

export function buildPreviewState(setup: GameSetup, seed: number): GameState {
  const initial: GameState = {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup, squares: [], territories: [], boats: [], players: [],
    touching: [], distance: [],
    turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
    year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  };
  return reduce(initial, { kind: 'newGame', setup, seed });
}

export function renderPreview(host: HTMLElement, setup: GameSetup, seed: number): void {
  const state = buildPreviewState(setup, seed);
  // Wipe ownership for preview (selection happens in-game).
  const wiped: GameState = {
    ...state,
    territories: state.territories.map((t) => ({ ...t, ownerId: null })),
  };
  // Provide a minimal board-host inside the preview container.
  let inner = host.querySelector<HTMLElement>('.preview-board-inner');
  if (!inner) {
    host.innerHTML = '<div class="preview-board-inner board-host"></div>';
    inner = host.querySelector('.preview-board-inner');
  }
  // Move the board-host class onto inner so renderBoard finds it.
  const originalHost = document.querySelector<HTMLElement>('.board-host');
  if (originalHost && originalHost !== inner) originalHost.classList.remove('board-host');
  inner!.classList.add('board-host');
  renderBoard(wiped);
  inner!.classList.remove('board-host');
  if (originalHost) originalHost.classList.add('board-host');

  // Meta line
  const meta = host.parentElement?.querySelector<HTMLElement>('.preview-meta');
  if (meta) {
    const land = wiped.territories.length;
    const lakes = new Set<number>();
    for (const sq of wiped.squares) if (sq.lakeId !== null) lakes.add(sq.lakeId);
    meta.textContent = `${land} territories · ${lakes.size} lakes`;
  }
}
