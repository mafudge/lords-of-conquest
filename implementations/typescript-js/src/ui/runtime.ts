import { decideAction } from '../game/ai/index.js';
import { decideTradeAction } from '../game/ai/trade.js';
import { decideAlliesAction } from '../game/ai/conquest.js';
import { getState, dispatch } from './main.js';
import type { Plan } from '../game/plans.js';
import { animatePlan } from './render/animations.js';

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
  // Use setTimeout(0) rather than queueMicrotask so the event loop can process
  // UI events and Playwright CDP messages between AI ticks. queueMicrotask would
  // starve the event loop in fast-forward mode (no animation awaits to yield).
  setTimeout(async () => {
    scheduled = false;
    if (!running) return;
    try {
      await tickOnce();
    } catch (_e) {
      // A dispatcher or AI decision error stops the runtime to prevent infinite loops.
      running = false;
      return;
    }
    if (running) schedule();
  }, 0);
}

async function dispatchAnimated(plan: Plan): Promise<void> {
  const prev = getState();
  if (!prev) { dispatch(plan); return; }
  dispatch(plan);
  const next = getState();
  if (next) await animatePlan(prev, next, plan);
}

export async function tickOnce(): Promise<void> {
  const s = getState();
  if (!s) return;
  if (s.currentPhase === 'gameOver') return;

  // Pending trade with non-human tradee → respond.
  if (s.pendingTrade && s.pendingTrade.status === 'proposed') {
    const tradee = s.players[s.pendingTrade.tradeeId];
    if (tradee && tradee.persona !== 'human') {
      const accept = decideTradeAction(s, s.pendingTrade.tradeeId, s.pendingTrade);
      await dispatchAnimated({ kind: 'tradeResponse', accept });
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
      await dispatchAnimated({ kind: 'alliesDecision', player: pendingNonHuman, choice });
      return;
    }
    if (s.pendingCombat.alliesPending.size === 0) {
      await dispatchAnimated({ kind: 'resolveCombat' });
      return;
    }
    return; // waiting on human ally
  }

  if (s.pendingCombat && s.pendingCombat.resolved) {
    await dispatchAnimated({ kind: 'endPhase', player: s.currentPlayer });
    return;
  }

  // During selection, if all territories are owned, end selection phase.
  if (s.currentPhase === 'selection') {
    const unowned = s.territories.filter((t) => t.ownerId === null);
    if (unowned.length === 0) {
      await dispatchAnimated({ kind: 'endPhase', player: s.currentPlayer });
      return;
    }
  }

  // Current player is human → wait for input.
  const cur = s.players[s.currentPlayer];
  if (!cur || cur.persona === 'human') return;

  if (s.currentPhase === 'production') {
    await dispatchAnimated({ kind: 'production' });
    // After applying, advance phase if still production.
    const after = getState()!;
    if (after.currentPhase === 'production') {
      await dispatchAnimated({ kind: 'endPhase', player: after.currentPlayer });
    }
    return;
  }

  const plan = decideAction(s, s.currentPlayer);
  await dispatchAnimated(plan);
}
