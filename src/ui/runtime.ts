import { decideAction } from '../game/ai/index.js';
import { decideTradeAction } from '../game/ai/trade.js';
import { decideAlliesAction } from '../game/ai/conquest.js';
import { getState, dispatch } from './main.js';

let running = false;
let scheduled = false;

export function startRuntime(): void {
  running = true;
  schedule();
}

export function stopRuntime(): void {
  running = false;
}

function schedule(): void {
  if (scheduled || !running) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    if (!running) return;
    try {
      tickOnce();
    } catch (_e) {
      // A dispatcher or AI decision error stops the runtime to prevent infinite loops.
      running = false;
      return;
    }
    if (running) schedule();
  });
}

export function tickOnce(): void {
  const s = getState();
  if (!s) return;
  if (s.currentPhase === 'gameOver') return;

  // Pending trade with non-human tradee → respond.
  if (s.pendingTrade && s.pendingTrade.status === 'proposed') {
    const tradee = s.players[s.pendingTrade.tradeeId];
    if (tradee && tradee.persona !== 'human') {
      const accept = decideTradeAction(s, s.pendingTrade.tradeeId, s.pendingTrade);
      dispatch({ kind: 'tradeResponse', accept });
      return;
    }
    return; // waiting on human
  }

  // Pending combat with non-human ally pending → resolve.
  if (s.pendingCombat && !s.pendingCombat.resolved) {
    const pendingNonHuman = [...s.pendingCombat.alliesPending]
      .find((p) => s.players[p]!.persona !== 'human');
    if (pendingNonHuman !== undefined) {
      const choice = decideAlliesAction(s, pendingNonHuman, s.pendingCombat);
      dispatch({ kind: 'alliesDecision', player: pendingNonHuman, choice });
      return;
    }
    if (s.pendingCombat.alliesPending.size === 0) {
      dispatch({ kind: 'resolveCombat' });
      return;
    }
    return; // waiting on human ally
  }

  if (s.pendingCombat && s.pendingCombat.resolved) {
    dispatch({ kind: 'endPhase', player: s.currentPlayer });
    return;
  }

  // During selection, if all territories are owned, end selection phase.
  if (s.currentPhase === 'selection') {
    const unowned = s.territories.filter((t) => t.ownerId === null);
    if (unowned.length === 0) {
      dispatch({ kind: 'endPhase', player: s.currentPlayer });
      return;
    }
  }

  // Current player is human → wait for input.
  const cur = s.players[s.currentPlayer];
  if (!cur || cur.persona === 'human') return;

  if (s.currentPhase === 'production') {
    dispatch({ kind: 'production' });
    // After applying, advance phase if still production.
    const after = getState()!;
    if (after.currentPhase === 'production') {
      dispatch({ kind: 'endPhase', player: after.currentPlayer });
    }
    return;
  }

  const plan = decideAction(s, s.currentPlayer);
  dispatch(plan);
}
