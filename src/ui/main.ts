import type { GameState } from '../game/types.js';
import type { Plan } from '../game/plans.js';
import { reduce } from '../game/reducer.js';
import { startRuntime } from './runtime.js';
import { renderShell } from './render/shell.js';
import { renderTopBar } from './render/topBar.js';
import { renderBottomBar, type BarAction } from './render/bottomBar.js';
import { renderBoard } from './render/board.js';
import { mountSetupWizard } from './setup/setupWizard.js';
import { defaultSetupState } from './setup/state.js';
import { getMode, setMode } from './interactions/interactionMode.js';
import { selectionMode } from './interactions/selectionMode.js';
import { decideSelectionAction } from '../game/ai/selection.js';

let state: GameState | null = null;
let prevState: GameState | null = null;
let renderScheduled = false;

export function getState(): GameState | null {
  return state;
}

export function dispatch(plan: Plan): void {
  // Allow 'newGame' before state is initialised (state === null means no
  // prior game; newGame ignores prev entirely).
  const prev = state ?? ({} as GameState);
  prevState = state;
  state = reduce(prev, plan);
  scheduleRender();
}

function scheduleRender(): void {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    render(state!, prevState ?? undefined);
  });
}

function attachBoardClicks(_state: GameState): void {
  const svg = document.querySelector('.board-svg');
  if (!svg || svg.hasAttribute('data-clicks-bound')) return;
  svg.setAttribute('data-clicks-bound', 'true');
  svg.addEventListener('click', (e) => {
    const t = e.target as SVGElement;
    if (!t.classList?.contains('sq')) return;
    const x = Number(t.getAttribute('data-x'));
    const y = Number(t.getAttribute('data-y'));
    const cur = getState();
    if (!cur) return;
    const sqIdx = y * 40 + x;
    const sq = cur.squares[sqIdx];
    if (!sq || sq.territoryId === null) return;
    getMode()?.handleClick(sq.territoryId, cur);
  });
}

function render(s: GameState, _prev?: GameState): void {
  const app = document.getElementById('app');
  if (!app) return;
  renderShell(app);
  renderTopBar(s);
  renderBoard(s);
  attachBoardClicks(s);
  if (s.currentPhase === 'selection') {
    setMode(selectionMode);
    selectionMode.enter(s);
  }
  renderBottomBar(s, defaultActionsFor(s));
}

function defaultActionsFor(s: GameState): BarAction[] {
  if (s.currentPhase === 'gameOver') return [];
  if (s.currentPhase === 'selection') {
    return [{ label: 'Auto-pick', kind: 'secondary',
      onClick: () => {
        const plan = decideSelectionAction(s, s.currentPlayer);
        dispatch(plan);
      } }];
  }
  return [{ label: 'End Phase', kind: 'secondary',
    onClick: () => dispatch({ kind: 'endPhase', player: s.currentPlayer }) }];
}

export function initApp(opts: { initialState: GameState | null }): void {
  state = opts.initialState;
  const app = document.getElementById('app');
  if (!app) throw new Error('No #app element in DOM');
  app.innerHTML = ''; // clear any existing wizard
  renderShell(app);
}

if (typeof window !== 'undefined' && document.getElementById('app')) {
  const initial = defaultSetupState();
  // URL seed override
  try {
    const m = window.location.search.match(/[?&]seed=([^&]+)/);
    if (m) {
      const parsed = parseInt(m[1]!, 10);
      if (!isNaN(parsed)) initial.seed = parsed;
    }
  } catch {}
  mountSetupWizard(document.getElementById('app')!, {
    initial,
    onStart: (s) => {
      // Replace setup wizard with shell + dispatch newGame
      initApp({ initialState: null });
      dispatch({ kind: 'newGame', setup: s.setup, seed: s.seed });
      startRuntime();
    },
  });
}
