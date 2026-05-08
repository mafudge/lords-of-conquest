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
import { locateStockpileMode } from './interactions/locateStockpileMode.js';
import { shipmentMode } from './interactions/shipmentMode.js';
import { decideSelectionAction } from '../game/ai/selection.js';
import { openTradeePicker } from './overlays/tradeePicker.js';
import { openTradeBuilder } from './overlays/tradeBuilder.js';
import { openTradeResponse } from './overlays/tradeResponse.js';
import { openAlliesDialog } from './overlays/alliesDialog.js';
import { conquestMode } from './interactions/conquestMode.js';
import { developmentMode } from './interactions/developmentMode.js';
import { mountKeyboard } from './platform/keyboard.js';

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
  if (s.pendingTrade && s.pendingTrade.status === 'proposed') {
    const tradee = s.players[s.pendingTrade.tradeeId];
    if (tradee?.persona === 'human' && !document.querySelector('.trade-response')) {
      const proposer = s.players[s.pendingTrade.proposerId];
      openTradeResponse({
        proposerName: proposer?.name ?? '?',
        give: s.pendingTrade.give, receive: s.pendingTrade.receive,
        onAccept: () => dispatch({ kind: 'tradeResponse', accept: true }),
        onReject: () => dispatch({ kind: 'tradeResponse', accept: false }),
        onRejectAll: () => dispatch({ kind: 'tradeRejectAll', tradee: s.pendingTrade!.tradeeId, trader: s.pendingTrade!.proposerId } as any),
      });
    }
  }
  if (s.pendingCombat && !s.pendingCombat.resolved
      && [...s.pendingCombat.alliesPending].some((p) =>
        s.players[p]?.persona === 'human')) {
    if (!document.querySelector('.allies-dialog')) {
      const human = [...s.pendingCombat.alliesPending].find((p) =>
        s.players[p]?.persona === 'human')!;
      const att = s.players[s.pendingCombat.attackerId];
      const def = s.pendingCombat.defenderId !== null
        ? s.players[s.pendingCombat.defenderId] : null;
      openAlliesDialog({
        attackerName: att?.name ?? '?',
        defenderName: def?.name ?? 'Natives',
        onChoice: (choice) => dispatch({ kind: 'alliesDecision',
          player: human, choice } as any),
      });
    }
  }
  if (s.currentPhase === 'selection') {
    setMode(selectionMode);
    selectionMode.enter(s);
  }
  const me = s.players[s.currentPlayer];
  const needsLocate = me?.persona === 'human'
    && me.stockpile.some((c) => c > 0)
    && me.stockpileLocation === null
    && (s.currentPhase === 'production' || s.currentPhase === 'trade'
        || s.currentPhase === 'shipment' || s.currentPhase === 'conquest'
        || s.currentPhase === 'development');
  if (needsLocate) {
    setMode(locateStockpileMode);
    locateStockpileMode.enter(s);
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
  const me = s.players[s.currentPlayer];
  if (s.currentPhase === 'shipment' && me?.persona === 'human') {
    if (s.shipmentUsed) {
      return [{ label: 'End Shipment', kind: 'secondary',
        onClick: () => dispatch({ kind: 'endPhase', player: s.currentPlayer }) }];
    }
    return [
      { label: 'Move Stockpile', onClick: () => { setMode(shipmentMode); shipmentMode.setSub('stockpile'); shipmentMode.enter(s); } },
      { label: 'Ship Horse', onClick: () => { setMode(shipmentMode); shipmentMode.setSub('horse'); shipmentMode.enter(s); } },
      { label: 'Ship Weapon', onClick: () => { setMode(shipmentMode); shipmentMode.setSub('weapon'); shipmentMode.enter(s); } },
      { label: 'Move Boat', onClick: () => { setMode(shipmentMode); shipmentMode.setSub('boat'); shipmentMode.enter(s); } },
      { label: 'Skip Shipment', kind: 'secondary',
        onClick: () => dispatch({ kind: 'endPhase', player: s.currentPlayer }) },
    ];
  }
  if (s.currentPhase === 'conquest' && me?.persona === 'human') {
    if (!s.pendingCombat) {
      setMode(conquestMode);
      conquestMode.enter(s);
    }
    return [{ label: 'End Conquest', kind: 'secondary',
      onClick: () => dispatch({ kind: 'endPhase', player: s.currentPlayer }) }];
  }
  if (s.currentPhase === 'trade' && me?.persona === 'human') {
    return [
      { label: 'Propose Trade', kind: 'primary',
        onClick: () => {
          const candidates = s.players
            .filter((p) => p.id !== s.currentPlayer && p.status === 'playing')
            .map((p) => ({ id: p.id, name: p.name, color: p.color }));
          openTradeePicker({
            candidates,
            onPick: (tradeeId) => {
              openTradeBuilder({
                proposerId: s.currentPlayer, tradeeId,
                proposerStock: s.players[s.currentPlayer]!.stockpile,
                tradeeStock: s.players[tradeeId]!.stockpile,
                onSend: (give, receive) => {
                  dispatch({
                    kind: 'trade', proposer: s.currentPlayer, tradee: tradeeId,
                    give, receive,
                  } as any);
                },
                onCancel: () => {},
              });
            },
          });
        } },
      { label: 'Finished Trading', kind: 'secondary',
        onClick: () => dispatch({ kind: 'endPhase', player: s.currentPlayer }) },
    ];
  }
  if (s.currentPhase === 'development' && me?.persona === 'human') {
    return [
      { label: 'Build City', onClick: () => {
        setMode(developmentMode); developmentMode.setSub('city'); developmentMode.enter(s);
      } },
      { label: 'Build Weapon', onClick: () => {
        setMode(developmentMode); developmentMode.setSub('weapon'); developmentMode.enter(s);
      } },
      { label: 'Build Boat', onClick: () => {
        setMode(developmentMode); developmentMode.setSub('boat'); developmentMode.enter(s);
      } },
      { label: 'End Development', kind: 'secondary', onClick: () =>
        dispatch({ kind: 'endPhase', player: s.currentPlayer }) },
    ];
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

  if (typeof window !== 'undefined') mountKeyboard();
}
