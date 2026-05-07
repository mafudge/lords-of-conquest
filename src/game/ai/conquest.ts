import type { GameState, PlayerId, CombatState } from '../types.js';
import { ptRatingsBoundary } from '../aiConstants.js';
import { isPassive } from './personas.js';
import { getPowerRatingForPl } from './powerRating.js';

export function decideAlliesAction(
  state: GameState,
  player: PlayerId,
  combat: CombatState,
): 'attacker' | 'neutral' | 'defender' {
  if (isPassive(state, player)) return 'neutral';
  if (combat.defenderId === null) return 'neutral';

  const attackerCities = state.territories.filter(
    (t) => t.ownerId === combat.attackerId && t.hasCity).length;
  const targetT = state.territories[combat.targetTerritoryId]!;
  const cityCountIfWin = attackerCities + (targetT.hasCity ? 1 : 0);
  if (cityCountIfWin >= state.setup.citiesToWin) {
    return 'defender';
  }

  const attackerRating = getPowerRatingForPl(state, combat.attackerId, undefined);
  const defenderRating = getPowerRatingForPl(state, combat.defenderId, undefined);
  if (attackerRating > defenderRating + ptRatingsBoundary) return 'defender';
  if (defenderRating > attackerRating + ptRatingsBoundary) return 'attacker';
  return 'neutral';
}
