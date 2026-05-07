import type { GameState, PlayerId, TradeOffer } from '../types.js';
import { isPassive } from './personas.js';
import { getBFPossible } from './bfPossible.js';
import { getPowerRatingForPl } from './powerRating.js';
import { getTradeUtility } from './scoring/tradeUtility.js';

export function decideTradeAction(
  state: GameState,
  player: PlayerId,
  offer: TradeOffer,
): boolean {
  if (isPassive(state, player)) return false;
  const opponent = player === offer.proposerId ? offer.tradeeId : offer.proposerId;
  const ratingMe = getPowerRatingForPl(state, player, undefined);
  const ratingOpp = getPowerRatingForPl(state, opponent, undefined);
  let fairness = ratingMe === 0 ? 1.0 : ratingOpp / ratingMe;
  if (fairness < 0.5) fairness = 0.5;
  if (fairness > 2.0) fairness = 2.0;
  const bf = getBFPossible(state, player);
  return getTradeUtility(state, player, offer, fairness, bf) > 0;
}
