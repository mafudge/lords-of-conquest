import type { GameState, PlayerId } from '../../types.js';
import { ptResource } from '../../aiConstants.js';
import { getForceCount } from '../../force.js';

/**
 * A sequence of build plans targeted at a single territory.
 * Mirrors LocAI PlanBundle / DevelopmentPlan (item codes 5=city, 7=weapon, 9=boat).
 */
export type DevelopmentBundle = {
  territoryId: number;
  builds: Array<
    | { kind: 'city'; payInGold: boolean }
    | { kind: 'weapon'; payInGold: boolean }
    | { kind: 'boat'; lakeId: number; payInGold: boolean }
  >;
};

/**
 * Scores a development bundle for a player.
 * Mirrors LocAI.getDevelopmentUtility L631–L799.
 *
 * The Java method iterates every territory, computes own-force vs max-enemy-force
 * (incorporating the bundle's effect via adjacency), then accumulates bonus/penalty
 * points based on items (stockpile, horse, weapon) and boats present.
 *
 * No state mutation; uses getForceCount on the live state and overlays the
 * bundle's additional force contributions.
 *
 * @param state      - current game state
 * @param player     - the AI player being evaluated
 * @param bundle     - sequence of builds to score
 * @param bfPossible - enemy battle-force projection matrix [terrId][playerId]
 */
export function getDevelopmentUtility(
  state: GameState,
  player: PlayerId,
  bundle: DevelopmentBundle,
  bfPossible: number[][],
): number {
  const numTerritories = state.territories.length;
  let score = 0;
  // cityTerrNo tracks territory where a city is being built (used for resource bonuses).
  // -1 means no city build in bundle.
  let cityTerrNo = -1;

  // Pre-compute per-resource stockpile counts owned by the player.
  // resourceCounts[r] = total count of resource r across player-owned territories.
  const resourceCounts: number[] = [0, 0, 0, 0, 0];
  for (let ti = 0; ti < numTerritories; ti++) {
    const terr = state.territories[ti];
    if (!terr) continue;
    if (terr.ownerId !== player) continue;
    if (terr.resource !== null) {
      const r = terr.resource as number;
      resourceCounts[r] = (resourceCounts[r] ?? 0) + 1;
    }
  }

  // Main loop: for every territory evaluate force posture and accumulate score.
  for (let ti = 0; ti < numTerritories; ti++) {
    const terr = state.territories[ti];
    if (!terr) continue;

    // myForce and enemyForce start at 0; we only compute for player-owned territories.
    let myForce = 0;
    let enemyForce = 0;

    if (terr.ownerId === player) {
      // Get base force counts from the live state.
      const fc = getForceCount(state, ti);
      for (let p = 0; p < 7; p++) {
        const fc_p = fc.perPlayer[p] ?? 0;
        if (p === player) {
          if (fc_p > myForce) myForce = fc_p;
        } else {
          // Enemy: base force + projected possible reinforcement
          const projected = fc_p + (bfPossible[ti]?.[p] ?? 0);
          if (projected > enemyForce) enemyForce = projected;
        }
      }
    }

    // Apply bundle plans to adjust myForce on relevant territories.
    // Java switch: case 7 (weapon) adds 3 if dist ≤ 1, case 5 (city) adds 2 if dist ≤ 1,
    // case 9 (boat) adds 2 if same territory.
    for (const build of bundle.builds) {
      const planTerrId = bundle.territoryId;
      const dist = state.distance[planTerrId]?.[ti] ?? Infinity;

      if (build.kind === 'weapon') {
        // Java case 7: weapon adds +3 if minDist ≤ 1
        if (dist <= 1) {
          myForce += 3;
        }
      } else if (build.kind === 'city') {
        // Java case 5: city adds +2 if minDist ≤ 1, sets cityTerrNo
        if (dist <= 1) {
          myForce += 2;
          cityTerrNo = planTerrId;
        }
      } else if (build.kind === 'boat') {
        // Java case 9: boat adds +2 if same territory
        if (planTerrId === ti) {
          myForce += 2;
        }
      }
    }

    // --- Force advantage/disadvantage scoring ---
    if (myForce < enemyForce) {
      // Disadvantaged: -5
      score -= 5;
    } else if (myForce > enemyForce) {
      // Advantaged: clamp bonus to 10
      score += myForce > enemyForce + 10 ? 10 : myForce - enemyForce;
    }

    // --- Resource territory bonus (LocAI L702–L742) ---
    // "resource territory at distance 1 from cityTerrNo owned by player"
    const multiplier = 2;
    const resourceCode = terr.resource;

    if (resourceCode !== null) {
      // City-adjacent resource bonus: only applies when a city plan covers this territory,
      // the territory is adjacent to an enemy territory (expansion value check),
      // and when cityTerrNo is set and distance is exactly 1 to a non-player territory.
      if (
        cityTerrNo !== -1 &&
        terr.resource !== null &&
        (terr.resource as number) !== 4 && // not stable
        (state.distance[cityTerrNo]?.[ti] ?? Infinity) <= 1 &&
        terr.ownerId !== player
      ) {
        if (myForce > enemyForce + 6) {
          score += 1;
        }
      }

      // Doubling resource bonus: when a city is being built adjacent to this player-owned
      // resource territory with single resource count.
      if (
        cityTerrNo !== -1 &&
        terr.ownerId === player &&
        (terr.resource as number) !== 4 && // not stable
        (state.distance[cityTerrNo]?.[ti] ?? Infinity) <= 1
      ) {
        if (myForce > enemyForce) {
          // Java L710: score += multiplier * ptResource[resourceCode]
          score += multiplier * (ptResource[resourceCode as number] ?? 0);
          // Bonus for resource scarcity (fewer of this resource type vs others)
          const r = resourceCode as number;
          const rc = resourceCounts[r] ?? 0;
          if (r === 0) {
            // iron: bonus if iron < coal
            if (rc < (resourceCounts[1] ?? 0)) {
              score += 10;
              if (rc < (resourceCounts[2] ?? 0) && rc < (resourceCounts[3] ?? 0)) {
                score += 5;
              }
            }
          } else if (r === 1) {
            // coal: bonus if coal < iron
            if (rc < (resourceCounts[0] ?? 0)) {
              score += 10;
              if (rc < (resourceCounts[2] ?? 0) && rc < (resourceCounts[3] ?? 0)) {
                score += 5;
              }
            }
          } else if (r === 2) {
            // tree: bonus if tree < iron, coal, and gold
            if (
              rc < (resourceCounts[0] ?? 0) &&
              rc < (resourceCounts[1] ?? 0) &&
              rc < (resourceCounts[3] ?? 0)
            ) {
              score += 15;
            }
          } else if (r === 3) {
            // gold: bonus if gold < iron, coal, and tree
            if (
              rc < (resourceCounts[0] ?? 0) &&
              rc < (resourceCounts[1] ?? 0) &&
              rc < (resourceCounts[2] ?? 0)
            ) {
              score += 15;
            }
          }
        } else if (enemyForce > myForce) {
          // Disadvantaged: lose resource value
          score -= multiplier * (ptResource[resourceCode as number] ?? 0);
        }
      }
    }

    // --- Stockpile (item code 8) bonus/penalty (LocAI L744–L755) ---
    if (terr.hasStockpile) {
      for (let r = 0; r < 4; r++) {
        const stockAmt = state.players[player]?.stockpile[r as 0|1|2|3] ?? 0;
        if (myForce > enemyForce) {
          score += (ptResource[r] ?? 0) * stockAmt;
        } else if (enemyForce > myForce) {
          score -= (ptResource[r] ?? 0) * stockAmt;
        }
      }
    }

    // --- Horse (item code 6) bonus/penalty (LocAI L756–L762) ---
    if (terr.hasHorse) {
      if (myForce > enemyForce) {
        score += 1;
      } else if (enemyForce > myForce) {
        score -= 1;
      }
    }

    // --- Weapon (item code 7) bonus/penalty (LocAI L763–L769) ---
    if (terr.hasWeapon) {
      if (myForce > enemyForce) {
        score += 3;
      } else if (enemyForce > myForce) {
        score -= 3;
      }
    }

    // --- Horse+Weapon group bonus (LocAI L770–L776) ---
    if (terr.hasHorse && terr.hasWeapon) {
      if (myForce > enemyForce) {
        score += 1;
      } else if (enemyForce > myForce) {
        score -= 1;
      }
    }

    // --- Boat bonus/penalty (LocAI L777–L795) ---
    // Iterate all boats; if the boat belongs to the player and is on this territory, score it.
    for (let bi = 0; bi < state.boats.length; bi++) {
      const boat = state.boats[bi];
      if (!boat) continue;
      if (boat.ownerId !== player) continue;
      if (boat.homeTerritoryId !== ti) continue;

      if (myForce > enemyForce) {
        score += 2;
      } else if (enemyForce > myForce) {
        score -= 2;
      }

      // Boat + horse or weapon group bonus
      if (terr.hasHorse || terr.hasWeapon) {
        if (myForce > enemyForce) {
          score += 1;
        } else if (enemyForce > myForce) {
          score -= 1;
        }
      }
    }
  }

  return score;
}
