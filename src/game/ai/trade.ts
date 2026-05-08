import type { GameState, PlayerId, TradeOffer, Stockpile } from '../types.js';
import type { Plan } from '../plans.js';
import { tradeKey } from '../tradeKey.js';
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

export function getProposedTradePlan(state: GameState, player: PlayerId): Plan {
  if (isPassive(state, player)) return { kind: 'endPhase', player };

  const myBf = getBFPossible(state, player);
  const myRating = getPowerRatingForPl(state, player, undefined);

  let bestPlan: Plan | null = null;
  let bestUtility = 0;

  for (let opp = 0; opp < state.players.length; opp++) {
    if (opp === player) continue;
    if (state.players[opp]!.status !== 'playing') continue;
    // autoReject[tradee][trader]: check if opp auto-rejects me
    if (state.autoReject[opp]?.[player]) continue;

    const oppRating = getPowerRatingForPl(state, opp as PlayerId, undefined);
    let myFairness = oppRating === 0 ? 1.0 : oppRating / myRating;
    if (myFairness < 0.5) myFairness = 0.5;
    if (myFairness > 2.0) myFairness = 2.0;
    let oppFairness = myRating === 0 ? 1.0 : myRating / oppRating;
    if (oppFairness < 0.5) oppFairness = 0.5;
    if (oppFairness > 2.0) oppFairness = 2.0;
    const oppBf = getBFPossible(state, opp as PlayerId);

    for (const candidate of enumerateTradesBetween(state, player, opp as PlayerId)) {
      if (candidate.kind !== 'trade') continue;

      // Triple-reject lockout
      const key = tradeKey(player, opp as PlayerId, candidate.give, candidate.receive);
      const prior = state.rejectedTrades.find(
        (r) => r.trader === player && r.tradee === opp && r.tradeKey === key);
      if (prior && prior.count >= 3) continue;

      const fakeOffer: TradeOffer = {
        proposerId: player,
        tradeeId: opp as PlayerId,
        give: candidate.give,
        receive: candidate.receive,
        status: 'proposed',
      };
      const myU = getTradeUtility(state, player, fakeOffer, myFairness, myBf);
      if (myU <= bestUtility) continue;
      const oppU = getTradeUtility(state, opp as PlayerId, fakeOffer, oppFairness, oppBf);
      if (oppU <= 0) continue;

      bestUtility = myU;
      bestPlan = candidate;
    }
  }

  return bestPlan ?? { kind: 'endPhase', player };
}

function* enumerateTradesBetween(
  state: GameState,
  me: PlayerId,
  opp: PlayerId,
): Generator<Plan> {
  const myStock = state.players[me]!.stockpile;
  const oppStock = state.players[opp]!.stockpile;

  for (let g0 = 0; g0 <= 3; g0++)
  for (let g1 = 0; g1 + g0 <= 3; g1++)
  for (let g2 = 0; g2 + g1 + g0 <= 3; g2++)
  for (let g3 = 0; g3 + g2 + g1 + g0 <= 3; g3++)
  for (let g4 = 0; g4 + g3 + g2 + g1 + g0 <= 3; g4++) {
    const give: Stockpile = [g0, g1, g2, g3, g4];
    if (give[0] > myStock[0] || give[1] > myStock[1] || give[2] > myStock[2]
      || give[3] > myStock[3] || give[4] > myStock[4]) continue;

    for (let r0 = 0; r0 <= 3; r0++)
    for (let r1 = 0; r1 + r0 <= 3; r1++)
    for (let r2 = 0; r2 + r1 + r0 <= 3; r2++)
    for (let r3 = 0; r3 + r2 + r1 + r0 <= 3; r3++)
    for (let r4 = 0; r4 + r3 + r2 + r1 + r0 <= 3; r4++) {
      const receive: Stockpile = [r0, r1, r2, r3, r4];
      if (receive[0] > oppStock[0] || receive[1] > oppStock[1]
        || receive[2] > oppStock[2] || receive[3] > oppStock[3]
        || receive[4] > oppStock[4]) continue;
      if (give.every((x) => x === 0) && receive.every((x) => x === 0)) continue;

      yield { kind: 'trade', proposer: me, tradee: opp, give, receive };
    }
  }
}
