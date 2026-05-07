// Mirrors LocAI.getConquestUtility L1992–L2384.
import type { GameState, PlayerId, CombatState } from '../../types.js';
import {
  ptResource,
  ptOppWinCity,
  ptFCAdvOwnTerr,
  ptFCAdvOppTerr,
  ptFCDisOwnTerr,
  ptFCDisOppTerr,
  ptVulnerableHorse,
  ptVulnerableWeapon,
  ptVulnerableCity,
  ptVulnerableBoat,
  ptFCAdvStockpile,
  ptFCDisStockpile,
  ptTerrWRes,
} from '../../aiConstants.js';
import { probSuccess } from '../../locProb.js';
import { getForceCount } from '../../force.js';

/**
 * Scores a hypothetical attack plan by computing per-territory force balance
 * and combining win-side (f2) and loss-side (f) scores via elementOfChance.
 *
 * Mirrors LocAI.getConquestUtility L1992–L2384.
 *
 * Java parameter mapping:
 *   attackPlan → combat (CombatState)
 *   nArray     → bfPossible  (enemy battle-force projection [terrId][playerId])
 *   nArray2    → alliesMatrix (ally decisions [terrId][playerId]: 0=att, 1=neutral, 2=def)
 *
 * @param state         - current game state
 * @param player        - the AI player being evaluated
 * @param combat        - the planned attack
 * @param bfPossible    - enemy battle-force projection matrix [terrId][playerId]
 * @param alliesMatrix  - ally decisions per territory/player. May be empty when
 *                        ally scoring (Task 22) has not yet been computed.
 */
export function getConquestUtility(
  state: GameState,
  player: PlayerId,
  combat: CombatState,
  bfPossible: number[][],
  alliesMatrix: number[][],
): number {
  const numTerritories = state.territories.length;

  // f  = loss-side score  (Java: f)
  // f2 = win-side score   (Java: f2)
  let lossScore = 0;
  let winScore = 0;

  // Decode attack plan fields (Java: n4, n5, n6, n7)
  const targetTerrId      = combat.targetTerritoryId;     // n4
  const boatId            = combat.boatId;                // n5
  const horseFromTerrId   = combat.horseFromTerritoryId;  // n6
  const weaponFromTerrId  = combat.weaponFromTerritoryId; // n7

  const targetTerr = targetTerrId > -1 ? (state.territories[targetTerrId] ?? null) : null;

  const citiesToWin = state.setup.citiesToWin; // Java: n8

  // ── Phase 1: Count cities per player (Java L2007–L2030) ──────────────────────
  // Find the sole leader by city count.  n9 = leaderPlayerId, n11 = leaderCityCount.
  const cityCountPerPlayer = new Array<number>(7).fill(0); // Java: nArray3
  for (let ti = 0; ti < numTerritories; ti++) {
    const terr = state.territories[ti];
    if (!terr) continue;
    if (terr.hasCity && terr.ownerId !== null) {
      cityCountPerPlayer[terr.ownerId]! += 1;
    }
  }

  let leaderPlayerId = -1;    // Java: n9
  let leaderCityCount = 0;    // Java: n11
  for (let p = 0; p < 7; p++) {
    const cnt = cityCountPerPlayer[p]!;
    if (cnt > leaderCityCount) {
      leaderPlayerId = p;
      leaderCityCount = cnt;
    } else if (cnt === leaderCityCount && leaderCityCount > 0) {
      leaderPlayerId = -1; // tied — no sole leader
    }
  }

  // Java L2031-L2034: no attack planned, dominant opponent already winning
  if (
    targetTerrId === -1 &&
    leaderPlayerId > -1 &&
    leaderPlayerId !== player &&
    leaderCityCount >= citiesToWin &&
    (cityCountPerPlayer[player] ?? 0) < leaderCityCount
  ) {
    lossScore += ptOppWinCity;
    winScore += ptOppWinCity;
  }

  // ── Phase 2: Main territory loop (Java L2035–L2325) ─────────────────────────
  for (let ti = 0; ti < numTerritories; ti++) {
    const terr = state.territories[ti];
    if (!terr) continue;

    const terrOwner  = terr.ownerId;           // Java: n2 = territory3.player
    const resourceCode = terr.resource;        // Java: n  = territory3.containsResource()

    // ── 2a. Target-territory win bonuses (Java L2043–L2096) ──────────────────
    if (ti === targetTerrId) {
      winScore += 2; // capturing any territory

      // Resource on target (Java L2045-L2047)
      if (resourceCode !== null) {
        winScore += ptResource[resourceCode as number] ?? 0;
      }

      // Horse on target (item 6) — +1 base, +1 extra if no inbound horse (Java L2048-L2053)
      if (terr.hasHorse) {
        winScore += 1;
        if (horseFromTerrId === null) winScore += 1;
      }

      // Weapon on target (item 7) — +3 base, +3 extra if no inbound weapon (Java L2054-L2059)
      if (terr.hasWeapon) {
        winScore += 3;
        if (weaponFromTerrId === null) winScore += 3;
      }

      // Boats docked at target (Java L2060-L2067: boat.getTerr() == n15)
      for (const boat of state.boats) {
        if (boat && boat.homeTerritoryId === ti) {
          winScore += 4;
        }
      }

      // City on target (item 5) and related leader-threat modifiers (Java L2068-L2085)
      if (terr.hasCity) {
        winScore += 12;

        if (
          leaderPlayerId > -1 &&
          leaderPlayerId !== player &&
          leaderCityCount >= citiesToWin &&
          (cityCountPerPlayer[player] ?? 0) < leaderCityCount
        ) {
          // Java L2070-L2075: dangerous leader exists — capturing any city helps
          lossScore += ptOppWinCity;
          if (terrOwner !== leaderPlayerId) {
            winScore += ptOppWinCity;
          }
        }

        // Java L2076-L2078: no unique leader but we're behind on cities
        if (
          leaderPlayerId === -1 &&
          leaderCityCount >= citiesToWin &&
          (cityCountPerPlayer[player] ?? 0) < leaderCityCount
        ) {
          winScore += ptOppWinCity;
        }

        // Java L2079-L2081: no unique leader but we're about to tie for the win
        if (
          leaderPlayerId === -1 &&
          leaderCityCount >= citiesToWin - 1 &&
          (cityCountPerPlayer[player] ?? 0) === leaderCityCount
        ) {
          winScore -= ptOppWinCity;
        }

      } else if (
        leaderPlayerId > -1 &&
        leaderPlayerId !== player &&
        leaderCityCount >= citiesToWin &&
        (cityCountPerPlayer[player] ?? 0) < leaderCityCount
      ) {
        // Java L2082-L2085: no city on target but opponent still threatens to win
        lossScore += ptOppWinCity;
        winScore += ptOppWinCity;
      }

      // Stockpile on target (item 8): capturing it costs the defender (Java L2086-L2096)
      if (terr.hasStockpile) {
        let defenderStockpileTotal = 0;
        if (terrOwner !== null) {
          const defStockpile = state.players[terrOwner]?.stockpile;
          if (defStockpile) {
            for (let r = 0; r < 4; r++) {
              defenderStockpileTotal += defStockpile[r as 0 | 1 | 2 | 3] ?? 0;
            }
          }
        }
        // Java: f2 -= ptFCDisStockpile * n20
        // ptFCDisStockpile is -5, so subtracting a negative gives a positive win bonus
        winScore -= ptFCDisStockpile * defenderStockpileTotal;
      }

    } else if (
      targetTerrId > -1 &&
      (state.touching[targetTerrId]?.[ti] ?? false) &&
      resourceCode !== null
    ) {
      // Java L2097-L2099: resource in adjacent territory adds small win bonus
      winScore += ptTerrWRes;
    }

    // ── 2b. Per-territory force flags (Java L2100–L2133) ──────────────────────
    // Compute boolean adjustment flags that mirror changes in force posture from
    // making the attack move.
    //
    // Java variables:
    //   bl   = horse leaves from its current territory (horseFromTerrId) adjacency
    //   n18  = horse arrives near target (0 or 1)
    //   bl2  = weapon leaves from its current territory (weaponFromTerrId) adjacency
    //   bl3  = weapon arrives near target
    //   bl4  = attacking boat is currently at this territory
    //   bl5  = attacking boat is currently at target territory

    let horseLeaves           = false;  // bl
    let horseArrivesFlag      = 0;      // n18
    let weaponLeaves          = false;  // bl2
    let weaponArrivesAtTarget = false;  // bl3
    let boatAtThisTerr        = false;  // bl4
    let boatAtTarget          = false;  // bl5

    // bl (Java L2107-L2109)
    if (
      horseFromTerrId !== null &&
      (horseFromTerrId === ti || (state.touching[horseFromTerrId]?.[ti] ?? false))
    ) {
      horseLeaves = true;
    }

    // n18 via horseFromTerrId (Java L2110-L2112)
    if (
      horseFromTerrId !== null &&
      (targetTerrId === ti || (state.touching[targetTerrId]?.[ti] ?? false))
    ) {
      horseArrivesFlag = 1;
    }

    // n18 via target territory's own horse (Java L2113-L2115)
    if (
      targetTerrId > -1 &&
      targetTerr?.hasHorse &&
      (targetTerrId === ti || (state.touching[targetTerrId]?.[ti] ?? false))
    ) {
      horseArrivesFlag = 1;
    }

    // bl2 (Java L2116-L2118)
    if (
      weaponFromTerrId !== null &&
      (weaponFromTerrId === ti || (state.touching[weaponFromTerrId]?.[ti] ?? false))
    ) {
      weaponLeaves = true;
    }

    // bl3 via weaponFromTerrId (Java L2119-L2121)
    if (
      weaponFromTerrId !== null &&
      (targetTerrId === ti || (state.touching[targetTerrId]?.[ti] ?? false))
    ) {
      weaponArrivesAtTarget = true;
    }

    // bl3 via target territory's own horse (Java L2122-L2124 — same condition as n18 check above)
    if (
      targetTerrId > -1 &&
      targetTerr?.hasHorse &&
      (targetTerrId === ti || (state.touching[targetTerrId]?.[ti] ?? false))
    ) {
      weaponArrivesAtTarget = true;
    }

    // bl4 and bl5 (Java L2125-L2133)
    if (boatId !== null) {
      const boat = state.boats[boatId];
      if (boat) {
        if (boat.homeTerritoryId === ti) boatAtThisTerr = true;
        if (boat.homeTerritoryId === targetTerrId) boatAtTarget = true;
      }
    }

    // ── 2c. Force balance computation (Java L2134–L2213) ──────────────────────
    // lossMyForce / lossEnemyForce = force posture if attack FAILS (n21, n22)
    // winMyForce  / winEnemyForce  = force posture if attack SUCCEEDS (n23, n24)
    const fc = getForceCount(state, ti);

    let lossMyForce    = 0; // n21
    let lossEnemyForce = 0; // n22
    let winMyForce     = 0; // n23
    let winEnemyForce  = 0; // n24

    for (let p = 0; p < 7; p++) {
      const rawForce = fc.perPlayer[p] ?? 0; // n17

      if (p === player) {
        // Java L2141-L2170: own player force adjustments
        winMyForce  = rawForce; // n23 = n17
        lossMyForce = rawForce; // n21 = n17

        // Loss-side: subtract items that are being moved away from their coverage area
        if (horseLeaves)      lossMyForce -= 1; // bl → n21--
        if (weaponLeaves)     lossMyForce -= 3; // bl2 → n21 -= 3
        if (boatAtThisTerr)   lossMyForce -= 2; // bl4 → n21 -= 2

        // Win-side: items that leave coverage without arriving at target
        if (horseLeaves  && horseArrivesFlag === 0)    winMyForce -= 1; // bl && n18==0 → n23--
        if (weaponLeaves && !weaponArrivesAtTarget)    winMyForce -= 3; // bl2 && !bl3 → n23-=3
        if (boatAtThisTerr && !boatAtTarget)           winMyForce -= 2; // bl4 && !bl5 → n23-=2

        // Win-side: items that arrive at target without already being there
        if (!horseLeaves  && horseArrivesFlag !== 0)   winMyForce += 1; // !bl && n18!=0 → n23++
        if (!weaponLeaves && weaponArrivesAtTarget)    winMyForce += 3; // !bl2 && bl3 → n23+=3
        if (!boatAtThisTerr && boatAtTarget)           winMyForce += 2; // !bl4 && bl5 → n23+=2

      } else {
        // Java L2171-L2211: enemy player p's forces
        let adjustedEnemyForce = rawForce; // n26 = n17

        // If this territory is owned by player p and the attack covers it (dist ≤ 1),
        // simulate what happens to their force after we capture the target.
        if (
          terrOwner === p &&
          targetTerrId > -1 &&
          (state.distance[targetTerrId]?.[ti] ?? Infinity) <= 1
        ) {
          // Capturing target gives attacker +1 from territory ownership change
          winMyForce += 1; // ++n23
          // Defender loses items on the captured target (they affect their adjacency force)
          if (targetTerr?.hasHorse)  adjustedEnemyForce -= 1; // horse
          if (targetTerr?.hasWeapon) adjustedEnemyForce -= 3; // weapon
          if (targetTerr?.hasCity)   adjustedEnemyForce -= 2; // city

          // Win-side attacker also gains items brought to target
          if (!horseLeaves  && horseArrivesFlag !== 0) winMyForce += 1; // !bl && n18!=0
          if (!weaponLeaves && weaponArrivesAtTarget)  winMyForce += 3; // !bl2 && bl3
          if (targetTerr?.hasCity)                     winMyForce += 2; // city bonus

          // Boats at the exact target territory also change hands
          if (ti === targetTerrId) {
            for (const boat of state.boats) {
              if (boat && boat.homeTerritoryId === ti) {
                adjustedEnemyForce -= 2; // n26 -= 2
                winMyForce         += 2; // n23 += 2
              }
            }
          }
        }

        // Accumulate maximum enemy force (Java L2206-L2210)
        const bfBonus = bfPossible[ti]?.[p] ?? 0;
        const rawTotal = rawForce + bfBonus;
        const adjTotal = adjustedEnemyForce + bfBonus;

        if (rawTotal > lossEnemyForce) lossEnemyForce = rawTotal; // n22 = max(n17 + nArray[n15][n25])
        if (adjTotal > winEnemyForce)  winEnemyForce  = adjTotal; // n24 = max(n26 + nArray[n15][n25])
      }
    }

    // ── 2d. Score f (loss-side) for this territory (Java L2215–L2269) ──────────
    if (terrOwner === player) {
      if (lossMyForce > lossEnemyForce) {
        const diff = Math.min(lossMyForce - lossEnemyForce, 20);
        lossScore += ptFCAdvOwnTerr * diff;
        if (terr.hasStockpile) lossScore += ptFCAdvStockpile * diff;
      } else {
        lossScore += ptFCDisOwnTerr;
        if (terr.hasHorse)    lossScore += ptVulnerableHorse;
        if (terr.hasWeapon)   lossScore += ptVulnerableWeapon;
        if (terr.hasCity)     lossScore += ptVulnerableCity;
        for (const boat of state.boats) {
          if (boat && boat.ownerId === player && boat.homeTerritoryId === ti) {
            lossScore += ptVulnerableBoat;
          }
        }
        if (terr.hasStockpile) {
          let playerStockpileTotal = 0;
          const sp = state.players[player]?.stockpile;
          if (sp) {
            for (let r = 0; r < 4; r++) playerStockpileTotal += sp[r as 0 | 1 | 2 | 3] ?? 0;
          }
          lossScore += ptFCDisStockpile * playerStockpileTotal;
        }
      }
    } else {
      // Java L2251: opponent territory
      if (lossMyForce > lossEnemyForce) {
        lossScore += ptFCAdvOppTerr * Math.min(lossMyForce - lossEnemyForce, 20);
      } else {
        lossScore += ptFCDisOppTerr;
      }
    }

    // Resource scoring for loss-side (Java L2253-L2269)
    if (lossMyForce > lossEnemyForce) {
      for (let r = 0; r < 5; r++) {
        if (terr.resource === r) lossScore += ptResource[r] ?? 0;
      }
    } else if (lossMyForce < lossEnemyForce) {
      for (let r = 0; r < 5; r++) {
        if (terr.resource === r) lossScore -= ptResource[r] ?? 0;
      }
    }

    // ── 2e. Score f2 (win-side) for this territory (Java L2270–L2324) ──────────
    if (terrOwner === player) {
      if (winMyForce > winEnemyForce) {
        const diff = Math.min(winMyForce - winEnemyForce, 20);
        winScore += ptFCAdvOwnTerr * diff;
        if (terr.hasStockpile) winScore += ptFCAdvStockpile * diff;
      } else {
        winScore += ptFCDisOwnTerr;
        if (terr.hasHorse)    winScore += ptVulnerableHorse;
        if (terr.hasWeapon)   winScore += ptVulnerableWeapon;
        if (terr.hasCity)     winScore += ptVulnerableCity;
        for (const boat of state.boats) {
          if (boat && boat.ownerId === player && boat.homeTerritoryId === ti) {
            winScore += ptVulnerableBoat;
          }
        }
        if (terr.hasStockpile) {
          let playerStockpileTotal = 0;
          const sp = state.players[player]?.stockpile;
          if (sp) {
            for (let r = 0; r < 4; r++) playerStockpileTotal += sp[r as 0 | 1 | 2 | 3] ?? 0;
          }
          winScore += ptFCDisStockpile * playerStockpileTotal;
        }
      }
    } else {
      // Java L2306: opponent territory
      if (winMyForce > winEnemyForce) {
        winScore += ptFCAdvOppTerr * Math.min(winMyForce - winEnemyForce, 20);
      } else {
        winScore += ptFCDisOppTerr;
      }
    }

    // Resource scoring for win-side (Java L2308-L2324)
    if (winMyForce > winEnemyForce) {
      for (let r = 0; r < 5; r++) {
        if (terr.resource === r) winScore += ptResource[r] ?? 0;
      }
    } else if (winMyForce < winEnemyForce) {
      for (let r = 0; r < 5; r++) {
        if (terr.resource === r) winScore -= ptResource[r] ?? 0;
      }
    }
  }

  // ── Phase 3: Compute attacker/defender strength for elementOfChance
  //             (Java L2327–L2354) ────────────────────────────────────────────
  let attackerForce = 0; // Java: n2
  let defenderForce = 0; // Java: n (later n29)

  if (targetTerrId > -1 && targetTerr) {
    const targetFc = getForceCount(state, targetTerrId);

    attackerForce = targetFc.perPlayer[player] ?? 0;
    defenderForce = targetTerr.ownerId !== null
      ? (targetFc.perPlayer[targetTerr.ownerId] ?? 0)
      : 1;

    // Java L2330-L2344: apply ally decisions from alliesMatrix
    // nArray2[n4][n30]: case 0 = attacker-ally, case 2 = defender-ally
    const allyRow = alliesMatrix[targetTerrId];
    if (allyRow) {
      for (let p = 0; p < 7; p++) {
        const decision = allyRow[p] ?? 1; // 1 = neutral
        if (decision === 0) {
          attackerForce += targetFc.perPlayer[p] ?? 0;
        } else if (decision === 2) {
          defenderForce += targetFc.perPlayer[p] ?? 0;
        }
      }
    }

    // Bonus force from items brought along (Java L2346-L2354)
    if (boatId !== null) attackerForce += 2; // n5 > -1 → n2 += 2

    if (
      horseFromTerrId !== null &&
      !(state.touching[targetTerrId]?.[horseFromTerrId] ?? false)
    ) {
      attackerForce += 1; // n6 > -1 && !touching(n4, n6) → n2++
    }

    if (
      weaponFromTerrId !== null &&
      !(state.touching[targetTerrId]?.[weaponFromTerrId] ?? false)
    ) {
      attackerForce += 3; // n7 > -1 && !touching(n4, n7) → n2 += 3
    }
  } else {
    // Java L2328-L2329: no target → attacker=0, defender=1 (guaranteed loss)
    attackerForce = 0;
    defenderForce = 1;
  }

  // ── Phase 4: Combine via elementOfChance (Java L2356–L2382) ─────────────────
  const successProb = probSuccess(attackerForce, defenderForce); // Java: d

  const elementOfChance = state.setup.elementOfChance;
  let combinedScore = 0; // Java: f3

  if (elementOfChance === 'low') {
    // case 0: att >= def → win score, else loss score
    combinedScore = attackerForce >= defenderForce ? winScore : lossScore;
  } else if (elementOfChance === 'medium') {
    // case 1: att > def → win; att == def → average; att < def → loss
    if (attackerForce > defenderForce) {
      combinedScore = winScore;
    } else if (attackerForce === defenderForce) {
      combinedScore = (winScore + lossScore) / 2;
    } else {
      combinedScore = lossScore;
    }
  } else {
    // case 2 (high): probability-weighted expected value
    combinedScore = successProb * winScore + (1 - successProb) * lossScore;
  }

  return combinedScore;
}
