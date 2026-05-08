import type { GameState } from '../game/types.js';
import type { Plan } from '../game/plans.js';
import { reduce } from '../game/reducer.js';
import { renderShell } from './render/shell.js';
import { mountSetupWizard } from './setup/setupWizard.js';
import { defaultSetupState } from './setup/state.js';

let state: GameState | null = null;
let prevState: GameState | null = null;
let renderScheduled = false;

export function getState(): GameState | null {
  return state;
}

export function dispatch(plan: Plan): void {
  if (state === null) throw new Error('dispatch called before initApp');
  prevState = state;
  state = reduce(state, plan);
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

function render(_s: GameState, _p?: GameState): void {
  // Filled in by Task 4 (shell render).
}

export function initApp(opts: { initialState: GameState | null }): void {
  state = opts.initialState;
  const app = document.getElementById('app');
  if (!app) throw new Error('No #app element in DOM');
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
    },
  });
}
