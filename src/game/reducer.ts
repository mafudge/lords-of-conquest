import type { GameState } from './types.js';
import type { Plan } from './plans.js';
import { applyNewGame } from './reducers/newGame.js';
import { applySelection } from './reducers/selection.js';

const NOT_IMPLEMENTED_KINDS: ReadonlyArray<Plan['kind']> = [
  'trade', 'tradeResponse', 'tradeRejectAll', 'horseFrom', 'horseTo',
  'shipStockpile', 'shipHorse', 'shipWeapon', 'shipBoat',
  'attack', 'alliesDecision', 'resolveCombat',
  'buildCity', 'buildWeapon', 'buildBoat',
];

export function reduce(state: GameState, plan: Plan): GameState {
  switch (plan.kind) {
    case 'newGame':
      return applyNewGame(state, plan.setup, plan.seed);
    case 'selection':
      return applySelection(state, plan.player, plan.territoryId);
    case 'production':
    case 'endPhase':
    case 'savegame':
    case 'loadgame':
    case 'loadmap':
      throw new Error(`Reducer dispatch for ${plan.kind} is wired in a later task`);
    default: {
      // Distinguish between "Plan 3 territory" and "completely unknown"
      const kind = (plan as { kind?: string }).kind;
      if (kind && (NOT_IMPLEMENTED_KINDS as string[]).includes(kind)) {
        throw new Error(`Reducer for ${kind} is not implemented in plan 2 (Plan 3 territory)`);
      }
      throw new Error(`Reducer received unknown plan kind: ${String(kind)}`);
    }
  }
}
