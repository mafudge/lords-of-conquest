import type { GameState } from '../types.js';
import type { Plan } from '../plans.js';
import { reduce } from '../reducer.js';
import { decideAction } from './decideAction.js';
import { decideTradeAction } from './trade.js';
import { decideAlliesAction } from './conquest.js';

const MAX_ITER = 1000;

export function runAITurn(state: GameState): GameState {
  let s = state;
  let iter = 0;
  while (iter++ < MAX_ITER) {
    if (s.currentPhase === 'gameOver') return s;

    if (s.pendingTrade && s.pendingTrade.status === 'proposed') {
      const tradee = s.pendingTrade.tradeeId;
      if (s.players[tradee]!.persona === 'human') return s;
      const accept = decideTradeAction(s, tradee, s.pendingTrade);
      s = reduce(s, { kind: 'tradeResponse', accept });
      continue;
    }

    if (s.pendingCombat && !s.pendingCombat.resolved) {
      const pendingNonHuman = [...s.pendingCombat.alliesPending]
        .find((p) => s.players[p]!.persona !== 'human');
      if (pendingNonHuman !== undefined) {
        const choice = decideAlliesAction(s, pendingNonHuman, s.pendingCombat);
        s = reduce(s, { kind: 'alliesDecision', player: pendingNonHuman, choice });
        continue;
      }
      if (s.pendingCombat.alliesPending.size === 0) {
        s = reduce(s, { kind: 'resolveCombat' });
        continue;
      }
      return s; // human ally still pending
    }

    // Combat resolved but endPhase not yet called — advance turn.
    if (s.pendingCombat && s.pendingCombat.resolved) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      continue;
    }

    if (s.players[s.currentPlayer]!.persona === 'human') return s;

    if (s.currentPhase === 'production') {
      s = reduce(s, { kind: 'production' });
      // After the production tick the phase stays 'production'; endPhase advances to trade/shipment.
      if (s.currentPhase === 'production') {
        s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      }
      continue;
    }

    const plan = decideAction(s, s.currentPlayer);
    s = reduce(s, plan);
  }
  throw new Error(`runAITurn exceeded MAX_ITER=${MAX_ITER} — likely a no-progress bug`);
}
