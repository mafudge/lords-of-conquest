import type { GameState, PlayerId, TradeOffer, Stockpile } from '../../types.js';
import { getStockpilePoints } from './stockpilePoints.js';
import { getBFPossible } from '../bfPossible.js';
import { getForceCount } from '../../force.js';

/**
 * Score a trade offer from the perspective of `player`.
 * Mirrors LocAI.getTradeUtility L1310–L1528.
 *
 * @param state      Current game state.
 * @param player     The AI player evaluating the trade.
 * @param offer      The trade offer (proposerId gives `give`, receives `receive`).
 * @param fairness   Weighting factor for the opponent's gain (typically 0.5–2.0).
 * @param bfPossible Battle-force projection matrix for `player`, from getBFPossible.
 * @returns          Utility score (higher = better for `player`).
 */
export function getTradeUtility(
  state: GameState,
  player: PlayerId,
  offer: TradeOffer,
  fairness: number,
  bfPossible: number[][],
): number {
  // --- Resolve perspective -------------------------------------------------
  // n21 = actionTaker (proposer), n22 = tradee, n23 = 0 if player==proposer,
  // n24 = the opponent from player's viewpoint.
  const proposerId = offer.proposerId;
  const tradeeId   = offer.tradeeId;

  // myGive / myReceive from player's perspective.
  let myGive: Stockpile;
  let myReceive: Stockpile;
  let opponent: PlayerId;

  // n23: 0 = player is proposer (getTradeAmount(0,*) = proposer's give = myGive)
  //      1 = player is tradee   (getTradeAmount(1,*) = tradee's give   = myGive)
  let perspectiveIdx: 0 | 1;

  if (player === proposerId) {
    myGive    = offer.give;
    myReceive = offer.receive;
    opponent  = tradeeId;
    perspectiveIdx = 0;
  } else if (player === tradeeId) {
    myGive    = offer.receive;
    myReceive = offer.give;
    opponent  = proposerId;
    perspectiveIdx = 1;
  } else {
    throw new Error(`Player ${player} is not a participant in this trade`);
  }

  // --- Build pre/post stockpiles for both sides ----------------------------
  // Java uses full 7-player arrays; we only need entries for `player` and `opponent`.
  const myPre: Stockpile  = [...state.players[player]!.stockpile]   as Stockpile;
  const oppPre: Stockpile = [...state.players[opponent]!.stockpile] as Stockpile;
  const myPost: Stockpile  = [...myPre]  as Stockpile;
  const oppPost: Stockpile = [...oppPre] as Stockpile;

  // TradePlan.getTradeAmount(0, res) = what proposer gives (= tradee receives)
  // TradePlan.getTradeAmount(1, res) = what tradee gives   (= proposer receives)
  // Java nArray7[n22] += getTradeAmount(0,..) - getTradeAmount(1,..)  (tradee post)
  // Java nArray7[n21] += getTradeAmount(1,..) - getTradeAmount(0,..)  (proposer post)
  for (let i = 0; i < 5; i++) {
    myPost[i]  = (myPost[i]  ?? 0) - (myGive[i]    ?? 0) + (myReceive[i] ?? 0);
    oppPost[i] = (oppPost[i] ?? 0) - (myReceive[i] ?? 0) + (myGive[i]   ?? 0);
  }

  // --- Stockpile point deltas (n17, n3, n18, n19 in Java) ------------------
  // n17 = myPre score, n3 = myPost score
  // n18 = oppPre score, n19 = oppPost score
  const myPreScore  = getStockpilePoints(state, player,   myPre,  bfPossible); // n17
  const myPostScore = getStockpilePoints(state, player,   myPost, bfPossible); // n3
  const oppPreScore = getStockpilePoints(state, opponent, oppPre, bfPossible); // n18
  const oppPostScore= getStockpilePoints(state, opponent, oppPost, bfPossible); // n19

  // --- Kingmaker / leader analysis ----------------------------------------
  // Java builds nArray2 (territory-only city count), nArray3 (pre-trade projected),
  // nArray4 (post-trade projected), and nArray5 (city vacancy count per player).
  // We track only the entries for `player` and `opponent` since only those change.
  const citiesToWin = state.setup.citiesToWin; // n5

  // Count current cities per player from territories.
  // Java nArray2[p] iterates all territories checking containsItem(5) = hasCity.
  const cityCounts = new Array<number>(7).fill(0);
  for (const terr of state.territories) {
    if (terr.ownerId !== null && terr.hasCity) {
      cityCounts[terr.ownerId]!++;
    }
  }

  // Count city vacancies per player (territories without a city) = nArray5.
  const cityVacancies = new Array<number>(7).fill(0);
  for (const terr of state.territories) {
    if (terr.ownerId !== null && !terr.hasCity) {
      cityVacancies[terr.ownerId]!++;
    }
  }

  // Helper: compute how many additional cities a stockpile can build
  // (using the min-of-four + extra-gold formula from the Java).
  // Returns buildable count, capped by vacancy if capByVacancy is provided.
  function buildableCities(sp: Stockpile, vacancy: number): number {
    const iron = sp[0], coal = sp[1], tree = sp[2], gold = sp[3];
    const minIC   = iron < coal ? iron : coal;
    const minTG   = tree < gold ? tree : gold;
    const minAll  = minIC < minTG ? minIC : minTG;
    const extraG  = Math.trunc((gold - minAll) / 4);
    const total   = minAll + extraG;
    return total < vacancy ? total : vacancy;
  }

  // Uncapped buildable (used for n24/opponent's pre-trade nArray3 update, line 1449).
  function buildableCitiesUncapped(sp: Stockpile): number {
    const iron = sp[0], coal = sp[1], tree = sp[2], gold = sp[3];
    const minIC  = iron < coal ? iron : coal;
    const minTG  = tree < gold ? tree : gold;
    const minAll = minIC < minTG ? minIC : minTG;
    const extraG = Math.trunc((gold - minAll) / 4);
    return minAll + extraG;
  }

  // Determine the territory-only sole leader (n6 / n10).
  // n6 = sole leader player id (−1 if tie), n10 = leader's territory-city count.
  let n6 = -1;
  let n10 = 0;
  for (let p = 0; p < 7; p++) {
    const cnt = cityCounts[p]!;
    if (cnt > n10) {
      n6 = p; n10 = cnt;
    } else if (cnt === n10 && n10 > 0) {
      n6 = -1;
    }
  }

  // nArray3: city counts = territory cities + buildable from pre-trade stockpile.
  // We start as copies of territory-only counts, then add buildable cities.
  const preProjected = [...cityCounts];  // nArray3 (will be mutated)
  const postProjected = [...cityCounts]; // nArray4 (will be mutated)

  // Java L1393-L1413: adds capped buildable for `this.pl` using pre-trade stockpile → nArray3,
  // then determines nArray3 pre-trade leader (n7/n11).
  const myPreBuildable = buildableCities(myPre, cityVacancies[player]!);
  preProjected[player]! += myPreBuildable;

  // Java L1414-L1434: adds capped buildable for `this.pl` using post-trade stockpile → nArray4,
  // then determines nArray4 post-trade leader (n8/n12).
  const myPostBuildable = buildableCities(myPost, cityVacancies[player]!);
  postProjected[player]! += myPostBuildable;

  // Java L1435-L1455: adds UNCAPPED buildable for `n24` using pre-trade stockpile → nArray3.
  // Note: line 1449 uses n38 (uncapped), not n40 (capped). This seems intentional.
  const oppPreBuildable = buildableCitiesUncapped(oppPre);
  preProjected[opponent]! += oppPreBuildable;

  // Java L1456-L1476: adds CAPPED buildable for `n24` using post-trade stockpile → nArray4.
  const oppPostBuildable = buildableCities(oppPost, cityVacancies[opponent]!);
  postProjected[opponent]! += oppPostBuildable;

  // Determine pre-trade projected sole leader (n7 / n11).
  let n7 = -1;
  let n11 = 0;
  for (let p = 0; p < 7; p++) {
    const cnt = preProjected[p]!;
    if (cnt > n11) {
      n7 = p; n11 = cnt;
    } else if (cnt === n11 && n11 > 0) {
      n7 = -1;
    }
  }

  // Determine post-trade projected sole leader (n8 / n12).
  let n8 = -1;
  let n12 = 0;
  for (let p = 0; p < 7; p++) {
    const cnt = postProjected[p]!;
    if (cnt > n12) {
      n8 = p; n12 = cnt;
    } else if (cnt === n12 && n12 > 0) {
      n8 = -1;
    }
  }

  // --- Bonus / penalty accumulator (n20) -----------------------------------
  let adjustment = 0;

  // Horse penalty: if player gives ≥ 2 horses (L1477-L1480).
  // n23 = perspectiveIdx; getTradeAmount(perspectiveIdx, 4) = how many horses player gives.
  const horsesGiven = perspectiveIdx === 0 ? offer.give[4] : offer.receive[4];
  if (horsesGiven >= 2) {
    adjustment -= 10000;
  }

  // Kingmaker block 1 (L1481-L1491):
  // Condition: there was a sole territory-leader before (n6>-1), they hadn't won yet,
  // pre-trade projection shows a new sole leader (n7>-1) who hits citiesToWin.
  if (n6 > -1 && n10 < citiesToWin && n7 > -1 && n11 >= citiesToWin) {
    // If opponent was the prior leader: pushing them over hurts us.
    if (opponent === n6) {
      adjustment -= 100;
    }
    // Post-trade leaves no winner (n8==-1) and prior leader was not us → we benefit.
    // OR post-trade we win (n8==player and count ≥ win threshold).
    if ((n8 === -1 && n6 !== player) || (n8 === player && n12 >= citiesToWin)) {
      adjustment += 1000;
    }
    // Post-trade leaves no winner and prior leader was us → we lose advantage.
    // OR post-trade opponent wins.
    if ((n8 === -1 && n6 === player) || (n8 !== player && n8 !== -1 && n12 >= citiesToWin)) {
      adjustment -= 1000;
    }
  }

  // Kingmaker block 2 (L1492-L1499):
  // Condition: pre-trade shows a tie for the lead (n7==-1) at a winning count.
  if (n7 === -1 && n11 >= citiesToWin) {
    if (n8 !== player && n8 !== -1 && n12 >= citiesToWin) {
      adjustment -= 1000;
    }
    if (n8 === player && n12 >= citiesToWin) {
      adjustment += 1000;
    }
  }

  // Kingmaker block 3 (L1500-L1507):
  // Condition: no territory-only leader (n6==-1), but pre-trade projection found a leader
  // who is already at a winning count.
  if (n6 === -1 && n7 > -1 && n10 >= citiesToWin) {
    if (n7 === player && n8 !== player) {
      adjustment -= 1000;
    }
    if (n7 !== player && (n8 === player || n8 === -1)) {
      adjustment += 1000;
    }
  }

  // --- Stockpile-loss penalty (L1508-L1525) --------------------------------
  // If the opponent has a stockpile location, check whether their stockpile
  // territory would be under-defended after the trade.
  // Java: checks n24's stockpile location (opponent's).
  const oppStockpileLoc = state.players[opponent]!.stockpileLocation;
  if (oppStockpileLoc !== null && oppStockpileLoc > -1) {
    const forceCount = getForceCount(state, oppStockpileLoc);
    // Compute BF projections from opponent's perspective.
    const oppBfPossible = getBFPossible(state, opponent);
    let friendlyStrength = 0;  // n46: opponent's own forces at that territory
    let maxHostileStrength = 0; // n47: best hostile threat
    for (let p = 0; p < 7; p++) {
      const fc = forceCount.perPlayer[p] ?? 0;
      if (p === opponent) {
        friendlyStrength = fc;
      } else {
        const bfThreat = oppBfPossible[oppStockpileLoc]?.[p] ?? 0;
        const total = fc + bfThreat;
        if (total > maxHostileStrength) {
          maxHostileStrength = total;
        }
      }
    }
    if (maxHostileStrength >= friendlyStrength) {
      adjustment -= 100;
    }
  }

  // --- Final score (L1526) -------------------------------------------------
  // f2 = (n3 - n17) - f * (n19 - n18) + n20
  const score = (myPostScore - myPreScore) - fairness * (oppPostScore - oppPreScore) + adjustment;
  return score;
}
