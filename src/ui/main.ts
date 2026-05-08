import type { GameState } from '../game/types.js';
import type { Plan } from '../game/plans.js';
import { reduce } from '../game/reducer.js';

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
  app.innerHTML = '<div class="shell"><div class="shell-loading">Loading…</div></div>';
}

if (typeof window !== 'undefined' && document.getElementById('app')) {
  initApp({ initialState: null });
}
