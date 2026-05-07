import type { GameState } from './types.js';
import type { Plan } from './plans.js';
import { applyNewGame } from './reducers/newGame.js';
import { applySelection } from './reducers/selection.js';
import { applyEndPhase } from './reducers/endPhase.js';
import { applyProduction } from './reducers/production.js';
import { applySavegame, applyLoadgame } from './reducers/persistence.js';
import { applyLoadmap } from './reducers/loadmap.js';
import { applyTradePropose, applyTradeResponse, applyHorseFrom, applyHorseTo, applyTradeRejectAll } from './reducers/trade.js';
import { applyShipStockpile, applyShipHorse, applyShipWeapon, applyShipBoat } from './reducers/shipment.js';

const NOT_IMPLEMENTED_KINDS: ReadonlyArray<Plan['kind']> = [
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
      return applyProduction(state);
    case 'savegame':
      return applySavegame(state, plan.slot);
    case 'loadGame':
      return applyLoadgame(state, plan.state);
    case 'loadMap':
      return applyLoadmap(state, plan.mapText);
    case 'endPhase':
      return applyEndPhase(state, plan.player);
    case 'trade':
      return applyTradePropose(state, plan.proposer, plan.tradee, plan.give, plan.receive);
    case 'tradeResponse':
      return applyTradeResponse(state, plan.accept);
    case 'horseFrom':
      return applyHorseFrom(state, plan.player, plan.territoryId);
    case 'horseTo':
      return applyHorseTo(state, plan.player, plan.territoryId);
    case 'tradeRejectAll':
      return applyTradeRejectAll(state, plan.tradee, plan.trader);
    case 'shipStockpile':
      return applyShipStockpile(state, plan.player, plan.from, plan.to);
    case 'shipHorse':
      return applyShipHorse(state, plan);
    case 'shipWeapon':
      return applyShipWeapon(state, plan.player, plan.from, plan.to);
    case 'shipBoat':
      return applyShipBoat(state, plan);
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
