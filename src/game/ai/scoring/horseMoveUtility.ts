/**
 * Horse-move utility helpers.
 * Mirrors LocAI L1040–L1273.
 *
 * Three functions:
 *   getHorseMoveUtility    – score a single territory for placing/removing a horse (L1040–L1101)
 *   getTerrNoHorseToRemove – find the best territory to remove a horse from (L1102–L1187)
 *   getTerrNoHorseToPlace  – find the best territory to place a horse on   (L1188–L1273)
 */

import type { GameState, PlayerId } from '../../types.js';
import { getForceCount } from '../../force.js';
import { ptResource } from '../../aiConstants.js';

// ---------------------------------------------------------------------------
// Internal helper: build the per-territory value score array used by
// getHorseMoveUtility. This is constructed identically in both
// getTerrNoHorseToRemove and getTerrNoHorseToPlace (Java L1135–L1171 /
// L1221–L1257).
// ---------------------------------------------------------------------------
function buildTerrScores(state: GameState, player: PlayerId): number[] {
  const n = state.territories.length;
  const scores = new Array<number>(n).fill(0);

  for (let tid = 0; tid < n; tid++) {
    const terr = state.territories[tid]!;
    let score = 0;

    // Java L1141-L1168: item contributions.
    // containsItem(6) = hasHorse → +1
    if (terr.hasHorse) score += 1;
    // containsItem(7) = hasWeapon → +3
    if (terr.hasWeapon) score += 3;
    // containsItem(5) = hasCity → +8
    if (terr.hasCity) score += 8;
    // containsItem(8) = hasStockpile → add resource values
    if (terr.hasStockpile) {
      // Java: for each resource 0..4: nArray3[tid] += getStockpileAmt(player, res) * ptResource[res]
      const sp = state.players[player]?.stockpile;
      if (sp) {
        for (let res = 0; res < 5; res++) {
          score += (sp[res as 0|1|2|3|4] ?? 0) * (ptResource[res] ?? 0);
        }
      }
    }
    // Java L1162-L1170: boats whose player == player add +2 per boat.
    // Java iterates boat slots 0..254; we iterate state.boats.
    for (const boat of state.boats) {
      if (boat !== null && boat.ownerId === player) {
        score += 2;
      }
    }

    scores[tid] = score;
  }

  return scores;
}

// ---------------------------------------------------------------------------
// Internal helper: find the "dangerous opponent" — the sole player with the
// most cities who has reached or exceeded citiesToWin.
// Returns their PlayerId, or -1 if no such player exists.
// Java L1108-L1134 / L1194-L1220.
// ---------------------------------------------------------------------------
function findDangerousOpponent(state: GameState): number {
  const citiesToWin = state.setup.citiesToWin;
  // cityCountPerPlayer[p] = how many cities player p has across all territories
  const cityCountPerPlayer = new Array<number>(7).fill(0);
  for (const terr of state.territories) {
    if (terr.ownerId !== null && terr.hasCity) {
      cityCountPerPlayer[terr.ownerId]!++;
    }
  }

  // Find the sole player with the most cities (−1 if tied).
  let leaderId = -1;
  let leaderCities = 0;
  for (let p = 0; p < 7; p++) {
    const cnt = cityCountPerPlayer[p]!;
    if (cnt > leaderCities) {
      leaderId = p;
      leaderCities = cnt;
    } else if (cnt === leaderCities && leaderCities > 0) {
      leaderId = -1;
    }
  }

  // Only consider them "dangerous" if they've hit the win threshold.
  if (leaderId > -1 && leaderCities >= citiesToWin) {
    return leaderId;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// getHorseMoveUtility
// Mirrors LocAI L1040–L1101.
//
// Java signature: getHorseMoveUtility(int n, int n2, int[] nArray, int n3, int n4)
//   n       = territory to evaluate
//   n2      = player
//   nArray  = per-territory value score array (built by caller)
//   n3      = dangerous opponent (−1 = none)
//   n4      = direction: +1 = placing a horse, −1 = removing a horse
//
// Public TS signature keeps (state, player, terrId, _unused, bfPossible) to
// match the shape callers expect (fromTerr, toTerr).  The second territory id
// (toTerr) mirrors the fromTerr concept and is kept for API symmetry but is
// not used internally — the evaluation is always of `fromTerr`.
// ---------------------------------------------------------------------------
export function getHorseMoveUtility(
  state: GameState,
  player: PlayerId,
  fromTerr: number,
  _toTerr: number,
  bfPossible: number[][],
): number {
  const numTerr = state.territories.length;
  const terr = state.territories[fromTerr];
  if (!terr) return 0;

  // Derive the dangerous opponent and terrScores for a stand-alone call.
  const dangerousOpponent = findDangerousOpponent(state);
  const terrScores = buildTerrScores(state, player);

  return _getHorseMoveUtilityInternal(
    state, player, fromTerr, terrScores, dangerousOpponent, 1, bfPossible, numTerr,
  );
}

// ---------------------------------------------------------------------------
// Internal implementation called by getTerrNoHorseToRemove/Place with their
// pre-computed terrScores, dangerousOpponent, and direction.
// ---------------------------------------------------------------------------
function _getHorseMoveUtilityInternal(
  state: GameState,
  player: PlayerId,
  terrId: number,
  terrScores: number[],
  dangerousOpponent: number,
  direction: 1 | -1,
  bfPossible: number[][],
  numTerr: number,
): number {
  const terr = state.territories[terrId];
  if (!terr) return 0;

  // Java L1044-L1048: horse presence check.
  // direction +1 = we want to place; territory must NOT already have a horse.
  // direction -1 = we want to remove; territory MUST already have a horse.
  let score = 0;
  if (direction === 1) {
    score = terr.hasHorse ? -100000 : 0;
  } else {
    score = terr.hasHorse ? 0 : -100000;
  }

  // Java L1049-L1061: force-count analysis.
  // n7 = our own force count at this territory
  // n8 = the best hostile force count at this territory (from any other player)
  const forceCount = getForceCount(state, terrId);
  let ownForceCount = 0;
  let maxEnemyForceCount = 0;
  for (let p = 0; p < 7; p++) {
    if (p === player) {
      ownForceCount = forceCount.perPlayer[p] ?? 0;
    } else {
      const hostile = (forceCount.perPlayer[p] ?? 0) + (bfPossible[terrId]?.[p] ?? 0);
      if (hostile > maxEnemyForceCount) {
        maxEnemyForceCount = hostile;
      }
    }
  }

  // Java L1062-L1067: defensive positioning adjustments.
  // If we're clearly outmatched (ownFC+1 < maxEnemy): apply disadvantage penalty.
  if (ownForceCount + 1 < maxEnemyForceCount) {
    score += direction * -10;
  }
  // If we're moderately strong (ownFC+1 > maxEnemy, within 15): add territory value.
  if (ownForceCount + 1 > maxEnemyForceCount && ownForceCount + 1 <= maxEnemyForceCount + 15) {
    score += direction * (terrScores[terrId] ?? 0);
  }

  // Java L1068-L1079: proximity check — is there an enemy or valuable own territory nearby?
  // bl = any territory within distance 3 that is enemy-owned OR is own-owned with value > 0.
  let hasNearbySignificant = false;
  for (let t2 = 0; t2 < numTerr; t2++) {
    const t2terr = state.territories[t2]!;
    const dist = state.distance[terrId]?.[t2] ?? Infinity;
    if (dist <= 3 && (t2terr.ownerId !== player || (terrScores[t2] ?? 0) > 0)) {
      hasNearbySignificant = true;
      break;
    }
  }
  if (!hasNearbySignificant) {
    score += direction * -4;
  }

  // Java L1080-L1098: enemy proximity and dangerous-opponent check.
  // bl2 = any enemy territory within distance 2.
  // bl3 = dangerous opponent is within distance 2 AND our territory has a city.
  let hasNearbyEnemy = false;
  let dangerousOpponentNearbyWithCity = false;
  for (let t2 = 0; t2 < numTerr; t2++) {
    const t2terr = state.territories[t2]!;
    const dist = state.distance[terrId]?.[t2] ?? Infinity;
    if (dist <= 2 && t2terr.ownerId !== player) {
      hasNearbyEnemy = true;
      if (dangerousOpponent === t2terr.ownerId && terr.hasCity) {
        dangerousOpponentNearbyWithCity = true;
      }
    }
  }
  if (hasNearbyEnemy) {
    score += direction * (terrScores[terrId] ?? 0);
  }
  if (dangerousOpponentNearbyWithCity) {
    score += direction * 1000;
  }

  return score;
}

// ---------------------------------------------------------------------------
// getTerrNoHorseToRemove
// Mirrors LocAI L1102–L1187.
//
// Java signature: getTerrNoHorseToRemove(int n, int[][] nArray, int n2, boolean bl)
//   n       = player
//   nArray  = bfPossible matrix
//   n2      = 0 → return best territory id; non-zero → return best utility score
//   bl      = considerNothing (true → start with score threshold of −10000, allowing
//             "any improvement"; false → start at 0, only positive improvements)
//
// TS signature exposes (state, player, fromTerr, bfPossible, considerNothing).
// `fromTerr` is not in the Java — it's supplied for API symmetry. The Java loops
// over all player-owned territories and picks the best candidate. fromTerr is
// accepted but not used (Java finds the best territory itself).
// ---------------------------------------------------------------------------
export function getTerrNoHorseToRemove(
  state: GameState,
  player: PlayerId,
  _fromTerr: number,
  bfPossible: number[][],
  considerNothing: boolean,
): number {
  const numTerr = state.territories.length;

  // Java L1104-L1105: n4 = best terr id (−1 = none found), n5 = best score threshold.
  let bestTerrId = -1;
  let bestScore = considerNothing ? -10000 : 0;

  const dangerousOpponent = findDangerousOpponent(state);
  const terrScores = buildTerrScores(state, player);

  // Java L1172-L1181: iterate all territories owned by this.pl.
  for (let tid = 0; tid < numTerr; tid++) {
    const terr = state.territories[tid]!;
    if (terr.ownerId !== player) continue;

    const utility = _getHorseMoveUtilityInternal(
      state, player, tid, terrScores, dangerousOpponent, -1, bfPossible, numTerr,
    );
    if (utility > bestScore) {
      bestScore = utility;
      bestTerrId = tid;
    }
  }

  // Java L1182-L1185: n2 == 0 → return territory id, otherwise return score.
  // In TS we invert: considerNothing==false means n2==0, considerNothing==true means n2!=0?
  // Actually in Java: n2 is the "returnMode" param (0=terrId, non-zero=score).
  // The Java `bl` is `considerNothing` and `n2` is a separate param.
  // Faithfully: return bestTerrId (territory) when considerNothing is false (n2==0),
  // return bestScore when considerNothing is true (n2!=0).
  // But the task description says: "getTerrNoHorseToRemove returns > -1" which checks
  // the terrId path. We expose both via `considerNothing`:
  //   considerNothing=false → territory id (Java n2==0)
  //   considerNothing=true  → utility score (Java n2!=0)
  return considerNothing ? bestScore : bestTerrId;
}

// ---------------------------------------------------------------------------
// getTerrNoHorseToPlace
// Mirrors LocAI L1188–L1273.
//
// Java signature: getTerrNoHorseToPlace(int n, int[][] nArray, int n2)
//   n       = player
//   nArray  = bfPossible matrix
//   n2      = 0 → return best territory id; non-zero → return best utility score
//
// TS signature: getTerrNoHorseToPlace(state, player, bfPossible, isAddingFromStockpile)
//   isAddingFromStockpile maps to Java n2: false = return terrId, true = return score.
// ---------------------------------------------------------------------------
export function getTerrNoHorseToPlace(
  state: GameState,
  player: PlayerId,
  bfPossible: number[][],
  isAddingFromStockpile: boolean,
): number {
  const numTerr = state.territories.length;

  // Java L1190-L1191: n4 = best terr id (−1 = none found), n5 = best score threshold (0).
  let bestTerrId = -1;
  let bestScore = 0;

  const dangerousOpponent = findDangerousOpponent(state);
  const terrScores = buildTerrScores(state, player);

  // Java L1258-L1267: iterate all territories owned by n (the player).
  for (let tid = 0; tid < numTerr; tid++) {
    const terr = state.territories[tid]!;
    if (terr.ownerId !== player) continue;

    const utility = _getHorseMoveUtilityInternal(
      state, player, tid, terrScores, dangerousOpponent, 1, bfPossible, numTerr,
    );
    if (utility > bestScore) {
      bestScore = utility;
      bestTerrId = tid;
    }
  }

  // Java L1268-L1271: n2 == 0 → return territory id, otherwise return score.
  // isAddingFromStockpile=false → return terrId (Java n2==0)
  // isAddingFromStockpile=true  → return score  (Java n2!=0)
  return isAddingFromStockpile ? bestScore : bestTerrId;
}
