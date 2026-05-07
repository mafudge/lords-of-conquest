import type { GameState, PlayerId } from '../types.js';
import type { Plan } from '../plans.js';

export function decideAction(state: GameState, player: PlayerId): Plan {
  switch (state.currentPhase) {
    case 'selection':
      throw new Error(`selection AI not implemented yet`);
    case 'production':
      // Production has no AI choice — runAITurn emits the production plan
      // directly; if decideAction is reached for production the caller is wrong.
      throw new Error(`decideAction should not be called for production phase`);
    case 'trade':
      throw new Error(`trade AI not implemented yet`);
    case 'shipment':
      throw new Error(`shipment AI not implemented yet`);
    case 'conquest':
      throw new Error(`conquest AI not implemented yet`);
    case 'development':
      throw new Error(`development AI not implemented yet`);
    case 'gameOver':
    case 'setup':
      throw new Error(`decideAction caller error: phase '${state.currentPhase}'`);
  }
}
