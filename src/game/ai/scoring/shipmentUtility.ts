// Mirrors LocAI.getShipmentUtility L2535–L2726.
import type { GameState, PlayerId } from '../../types.js';
import type { Plan } from '../../plans.js';
import {
  PERSONA_AGGRESSIVE,
  ptFCAdvOwnTerr,
  ptFCDisOwnTerr,
  ptFCAdvOppTerr,
  ptFCDisOppTerr,
  ptVulnerableHorse,
  ptVulnerableWeapon,
  ptVulnerableCity,
  ptVulnerableBoat,
  ptResource,
  ptFCAdvStockpile,
  ptFCDisStockpile,
  ptGroupHorseWeapon,
  ptGroupBoatHW,
} from '../../aiConstants.js';
import { getForceCount } from '../../force.js';
import { GRID_WIDTH } from '../../constants.js';

export type ShipmentPlan = Extract<Plan,
  { kind: 'shipStockpile' | 'shipHorse' | 'shipWeapon' | 'shipBoat' }>;

/**
 * Scores a hypothetical shipment plan by computing per-territory force/resource
 * posture after applying the plan's force-count adjustments.
 *
 * Unlike getDevelopmentUtility, no state clone is created; force adjustments are
 * derived analytically from the plan fields, exactly as in the Java source.
 *
 * @param state      - current game state
 * @param player     - the AI player being evaluated
 * @param plan       - one of shipStockpile | shipHorse | shipWeapon | shipBoat
 * @param bfPossible - enemy battle-force projection matrix [terrId][playerId]
 */
export function getShipmentUtility(
  state: GameState,
  player: PlayerId,
  plan: ShipmentPlan,
  bfPossible: number[][],
): number {
  const numTerritories = state.territories.length;
  // n2 in Java: player persona status (3 = aggressive)
  const playerPersona = state.players[player]?.persona;
  const isAggressive = playerPersona === 'aggressive'; // equivalent to n2 == 3

  let score = 0;
  // n4 in Java: tracks where stockpile will be AFTER the plan.
  // -1 = no stockpile move; when stockpile is moved, n4 = destination territory id.
  let stockpileNewTerrId = -1;

  // Decode plan fields into Java's ShipmentPlan field equivalents.
  // Java variables: n5 = terrMoveFrom, n6 = terrMoveTo,
  //                 n11 = pickUpHorseFrom, n10 = pickUpWeaponFrom, n9 = moveWeaponTo
  const terrMoveFrom: number = plan.kind === 'shipBoat'
    ? getBoatHomeTerr(state, plan.boatId)  // n5: boat's current home territory
    : plan.from;
  const terrMoveTo: number = plan.kind === 'shipBoat'
    ? getBoatDestTerr(state, plan.toX, plan.toY) // n6: territory adjacent to destination
    : plan.to;

  // Shipment type codes (Java: shipWhat):
  //   6 = shipHorse, 7 = shipWeapon, 8 = shipStockpile, 9 = shipBoat
  const shipWhat =
    plan.kind === 'shipHorse'      ? 6 :
    plan.kind === 'shipWeapon'     ? 7 :
    plan.kind === 'shipStockpile'  ? 8 :
    /* shipBoat */                   9;

  // pickUpHorseFrom (n11 in Java): only used by shipBoat
  const pickUpHorseFrom: number =
    plan.kind === 'shipBoat' && plan.pickUpHorseFrom !== undefined
      ? plan.pickUpHorseFrom : -1;

  // pickUpWeaponFrom (n10 in Java): used by shipHorse (pickUpWeaponFrom) and shipBoat
  const pickUpWeaponFrom: number =
    plan.kind === 'shipHorse' && plan.pickUpWeaponFrom !== undefined
      ? plan.pickUpWeaponFrom :
    plan.kind === 'shipBoat' && plan.pickUpWeaponFrom !== undefined
      ? plan.pickUpWeaponFrom : -1;

  // moveWeaponTo (n9 in Java): only used by shipHorse
  const moveWeaponTo: number =
    plan.kind === 'shipHorse' && plan.moveWeaponTo !== undefined
      ? plan.moveWeaponTo : -1;

  // Main territory loop — mirrors Java L2543–L2724
  for (let ti = 0; ti < numTerritories; ti++) {
    const terr = state.territories[ti];
    if (!terr) continue;

    // For Java booleans bl..bl6 — represent synthetic force adjustments
    // bl   = horse leaves adjacency of this territory (myForce -= 1)
    // bl2  = horse arrives in adjacency of this territory (myForce += 1)
    // bl3  = weapon leaves adjacency of this territory (myForce -= 3)
    // bl4  = weapon arrives in adjacency of this territory (myForce += 3)
    // bl5  = boat leaves this territory (myForce -= 2)
    // bl6  = boat arrives at this territory (myForce += 2)
    let horseLeavesHere = false;
    let horseArrivesHere = false;
    let weaponLeavesHere = false;
    let weaponArrivesHere = false;
    let boatLeavesHere = false;
    let boatArrivesHere = false;

    // The 'terrMoveTo' destination territory object (Java: object = lh.getTerritory(n6))
    const destTerr = terrMoveTo >= 0 ? state.territories[terrMoveTo] : null;

    // Compute boolean flags only when the plan is valid (Java L2557 guard:
    // shipmentPlan != null && getShipment() != -1 && n6 > -1)
    if (shipWhat !== -1 && terrMoveTo > -1) {

      if (shipWhat === 6) {
        // shipHorse (Java L2563–L2581)
        // bl: horse leaves from terrMoveFrom's adjacency
        if (isTouchingOrSame(state, ti, terrMoveFrom)) {
          horseLeavesHere = true;
        }
        // bl2: horse arrives at terrMoveTo's adjacency (only if dest doesn't already have horse)
        if ((isTouchingOrSame(state, ti, terrMoveTo)) && !(destTerr?.hasHorse ?? false)) {
          horseArrivesHere = true;
        }
        // bl3: weapon leaves from pickUpWeaponFrom's adjacency
        if (pickUpWeaponFrom > -1 && isTouchingOrSame(state, ti, pickUpWeaponFrom)) {
          weaponLeavesHere = true;
        }
        // bl4: weapon arrives somewhere
        if (moveWeaponTo > -1) {
          const moveWeaponToTerr = state.territories[moveWeaponTo];
          if (!(moveWeaponToTerr?.hasWeapon ?? false) && isTouchingOrSame(state, ti, moveWeaponTo)) {
            weaponArrivesHere = true;
          }
        } else if (pickUpWeaponFrom > -1 && !(destTerr?.hasWeapon ?? false) && isTouchingOrSame(state, ti, terrMoveTo)) {
          weaponArrivesHere = true;
        }
      }

      if (shipWhat === 7) {
        // shipWeapon (Java L2582–L2589)
        // bl3: weapon leaves from terrMoveFrom
        if (isTouchingOrSame(state, ti, terrMoveFrom)) {
          weaponLeavesHere = true;
        }
        // bl4: weapon arrives at terrMoveTo (only if dest doesn't already have weapon)
        if (isTouchingOrSame(state, ti, terrMoveTo) && !(destTerr?.hasWeapon ?? false)) {
          weaponArrivesHere = true;
        }
      }

      if (shipWhat === 9) {
        // shipBoat (Java L2590–L2613)
        // bl5/bl6: boat moves from terrMoveFrom to terrMoveTo
        if (ti === terrMoveFrom) {
          boatLeavesHere = true;
        }
        if (ti === terrMoveTo) {
          boatArrivesHere = true;
        }
        // pickUpHorseFrom effect (n11 > -1)
        if (pickUpHorseFrom > -1) {
          // bl: horse leaves pickUpHorseFrom's adjacency
          if (isTouchingOrSame(state, ti, pickUpHorseFrom)) {
            horseLeavesHere = true;
          }
          // bl2: horse (on boat) arrives at terrMoveTo (if dest doesn't already have horse)
          if (isTouchingOrSame(state, ti, terrMoveTo) && !(destTerr?.hasHorse ?? false)) {
            horseArrivesHere = true;
          }
        }
        // pickUpWeaponFrom effect (n10 > -1)
        if (pickUpWeaponFrom > -1) {
          // bl3: weapon leaves pickUpWeaponFrom's adjacency
          if (isTouchingOrSame(state, ti, pickUpWeaponFrom)) {
            weaponLeavesHere = true;
          }
          // bl4: weapon (on boat) arrives at terrMoveTo (if dest doesn't already have weapon)
          if (isTouchingOrSame(state, ti, terrMoveTo) && !(destTerr?.hasWeapon ?? false)) {
            weaponArrivesHere = true;
          }
        }
      }

      if (shipWhat === 8) {
        // shipStockpile (Java L2614–L2616): track new stockpile location
        stockpileNewTerrId = terrMoveTo;
      }
    }

    // Compute myForce and enemyForce from ForceCount (Java L2618–L2629)
    const fc = getForceCount(state, ti);
    let myForce = 0;
    let enemyForce = 0;
    for (let p = 0; p < 7; p++) {
      const forceVal = fc.perPlayer[p] ?? 0;
      if (p === player) {
        if (forceVal > myForce) myForce = forceVal;
      } else {
        const projected = forceVal + (bfPossible[ti]?.[p] ?? 0);
        if (projected > enemyForce) enemyForce = projected;
      }
    }

    // Apply synthetic force adjustments from plan (Java L2630–L2647)
    // bl && !bl2: horse leaves but doesn't arrive → myForce -= 1
    if (horseLeavesHere && !horseArrivesHere) {
      myForce -= 1;
    }
    // !bl && bl2: horse arrives but doesn't leave → myForce += 1
    if (!horseLeavesHere && horseArrivesHere) {
      myForce += 1;
    }
    // bl5 && !bl6: boat leaves but doesn't arrive → myForce -= 2
    if (boatLeavesHere && !boatArrivesHere) {
      myForce -= 2;
    }
    // !bl5 && bl6: boat arrives but doesn't leave → myForce += 2
    if (!boatLeavesHere && boatArrivesHere) {
      myForce += 2;
    }
    // bl3 && !bl4: weapon leaves but doesn't arrive → myForce -= 3
    if (weaponLeavesHere && !weaponArrivesHere) {
      myForce -= 3;
    }
    // !bl3 && bl4: weapon arrives but doesn't leave → myForce += 3
    if (!weaponLeavesHere && weaponArrivesHere) {
      myForce += 3;
    }

    // --- Own territory scoring (Java L2648–L2670) ---
    if (terr.ownerId === player) {
      if (myForce > enemyForce) {
        // Force advantage: +ptFCAdvOwnTerr × min(diff, 20)
        score += ptFCAdvOwnTerr * Math.min(myForce - enemyForce, 20);
      } else if (myForce < enemyForce) {
        // Force disadvantage
        score += ptFCDisOwnTerr; // -5
        if (terr.hasHorse)  score += ptVulnerableHorse;  // -2
        if (terr.hasWeapon) score += ptVulnerableWeapon; // -6
        if (terr.hasCity)   score += ptVulnerableCity;   // -8
        // Boats on this territory (Java L2662–L2669: boat.getTerr() == n7)
        for (const boat of state.boats) {
          if (!boat) continue;
          if (boat.ownerId === player && boat.homeTerritoryId === ti) {
            score += ptVulnerableBoat; // -4
          }
        }
      }
    } else if (isAggressive) {
      // Opponent territory scoring for aggressive player (Java L2671–L2673)
      if (myForce > enemyForce) {
        score += ptFCAdvOppTerr * Math.min(myForce - enemyForce, 20); // +1 × clamped diff
      } else {
        score += ptFCDisOppTerr; // -3
      }
    }

    // --- Resource scoring (Java L2674–L2692) ---
    // Only for own territories or when aggressive (n2 == 3)
    if (terr.ownerId === player || isAggressive) {
      if (myForce > enemyForce) {
        // Winning: add resource point values for each resource present
        for (let r = 0; r < 5; r++) {
          if (hasResourceCode(terr.resource, r)) {
            score += ptResource[r] ?? 0;
          }
        }
      } else if (myForce < enemyForce) {
        // Losing: subtract resource point values
        for (let r = 0; r < 5; r++) {
          if (hasResourceCode(terr.resource, r)) {
            score -= ptResource[r] ?? 0;
          }
        }
      }
    }

    // --- Stockpile scoring (Java L2693–L2708) ---
    // Condition: own territory AND (stockpile is currently here and not being moved,
    //            OR stockpile is being moved TO here)
    // Java: territory.containsItem(8) && n4 == -1  → stockpile here and not being moved
    //       !territory.containsItem(8) && n4 == n7 → stockpile being moved to this territory
    if (terr.ownerId === player &&
        ((terr.hasStockpile && stockpileNewTerrId === -1) ||
         (!terr.hasStockpile && stockpileNewTerrId === ti))) {
      if (myForce > enemyForce) {
        // Winning at stockpile location
        score += ptFCAdvStockpile * Math.min(myForce - enemyForce, 20); // +1 × clamped diff
        // Any opponent can reach here: -3
        // Java L2697-L2698: if (n10 >= 0) n3 -= 3
        // n10 is enemyForce (≥ 0 always), so this always fires when myForce > enemyForce
        if (enemyForce >= 0) {
          score -= 3;
        }
      } else {
        // Losing at stockpile location: penalty proportional to stockpile sum
        let stockpileSum = 0;
        const stockpile = state.players[player]?.stockpile;
        if (stockpile) {
          for (let r = 0; r < 4; r++) {
            stockpileSum += stockpile[r as 0 | 1 | 2 | 3] ?? 0;
          }
        }
        score += ptFCDisStockpile * stockpileSum; // -5 × sum
      }
    }

    // --- Horse + Weapon group bonus (Java L2709–L2711) ---
    if (terr.ownerId === player && terr.hasHorse && terr.hasWeapon) {
      score += ptGroupHorseWeapon; // +1
    }

    // --- Boat + Horse/Weapon group bonus (Java L2712–L2722) ---
    if (terr.ownerId === player && (terr.hasHorse || terr.hasWeapon)) {
      for (const boat of state.boats) {
        if (!boat) continue;
        if (boat.ownerId === player && boat.homeTerritoryId === ti) {
          score += ptGroupBoatHW; // +1
          break; // Java breaks after first boat found
        }
      }
    }
  }

  return score;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Returns true if territory `ti` is touching or equal to `other`. */
function isTouchingOrSame(state: GameState, ti: number, other: number): boolean {
  return ti === other || (state.touching[ti]?.[other] ?? false);
}

/** Returns true if the territory's resource code equals `r` (0..4). */
function hasResourceCode(resource: number | null, r: number): boolean {
  return resource !== null && resource === r;
}

/** Gets the home territory ID of a boat (Java: boat.getTerr()). */
function getBoatHomeTerr(state: GameState, boatId: number): number {
  const boat = state.boats[boatId];
  return boat ? boat.homeTerritoryId : -1;
}

/**
 * For shipBoat: resolves the destination (toX, toY) to the adjacent land territory.
 * Java uses a territory ID for terrMoveTo; in TypeScript shipBoat uses toX/toY coordinates.
 * We find the territory whose squares are adjacent to (toX, toY).
 * Returns -1 if no adjacent territory found (open water).
 */
function getBoatDestTerr(state: GameState, toX: number, toY: number): number {
  // The destination is a water square; the "territory" side is an adjacent land territory.
  // In the Java, boat.getTerr() returned the territory adjacent to the boat's current lake
  // position, so "terrMoveTo" for shipBoat is the territory the boat will be adjacent to
  // after moving. We pick the first adjacent land territory.
  const OFFSETS = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
  ];
  for (const { dx, dy } of OFFSETS) {
    const nx = toX + dx;
    const ny = toY + dy;
    const sqIdx = ny * GRID_WIDTH + nx;
    const sq = state.squares[sqIdx];
    if (sq && sq.territoryId !== null) {
      return sq.territoryId;
    }
  }
  return -1;
}
