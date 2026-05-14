// Faithful port of LocAI.decideSelectionAction scoring logic (L2800–L2925).
// Only the per-territory scoring is extracted here; Task 9 wires it into the
// public decideSelectionAction that iterates all unowned territories.

import type { GameState, PlayerId } from '../types.js';
import type { Plan } from '../plans.js';
import { getForceCount } from '../force.js';
import {
  PERSONA_PASSIVE,
  PERSONA_DEFENSIVE,
  PERSONA_AGGRESSIVE,
  ptResource,
  ptFirstOfType,
  ptIronAndCoal,
  ptOneOfEach,
  ptTouchTerr,
  ptTouchTerrWResource,
  ptTouchOwnTerr,
  ptTouchOwnTerrWResource,
  ptTerrVulnerable,
} from '../aiConstants.js';

/**
 * Compute the selection score for a single candidate territory.
 *
 * Faithfully mirrors the per-iteration scoring block inside
 * LocAI.decideSelectionAction (L2811–L2914). The caller is expected to filter
 * to unowned territories before calling (territory.ownerId === null).
 *
 * @param state   - current game state
 * @param player  - the AI player scoring candidates
 * @param territoryId - the territory being evaluated
 * @returns integer score (higher = more desirable)
 */
export function scoreSelectionCandidate(
  state: GameState,
  player: PlayerId,
  territoryId: number,
): number {
  const territory = state.territories[territoryId];
  if (!territory) return 0;

  // Map TS persona string → Java integer status (LocAI L9-12)
  const personaStr = state.players[player]?.persona ?? 'passive';
  const persona =
    personaStr === 'passive'    ? PERSONA_PASSIVE    :
    personaStr === 'defensive'  ? PERSONA_DEFENSIVE  :
    personaStr === 'aggressive' ? PERSONA_AGGRESSIVE :
    PERSONA_PASSIVE; // human/unknown defaults to passive scoring

  // Pre-count the player's already-owned resource territories (LocAI L2815–L2833).
  // Only used when persona is defensive or aggressive (n2 == 2 || n2 == 3).
  let ironCount  = 0; // n5 — iron   (resource 0)
  let coalCount  = 0; // n6 — coal   (resource 1)
  let treeCount  = 0; // n7 — tree   (resource 2)
  let goldCount  = 0; // n8 — gold   (resource 3)
  let stableCount = 0; // n9 — stable (resource 4)

  if (persona === PERSONA_DEFENSIVE || persona === PERSONA_AGGRESSIVE) {
    for (const t of state.territories) {
      if (t.ownerId !== player) continue;
      switch (t.resource) {
        case 0: ironCount++;   break; // IRON
        case 1: coalCount++;   break; // COAL
        case 2: treeCount++;   break; // TREE
        case 3: goldCount++;   break; // GOLD
        case 4: stableCount++; break; // STABLE
      }
    }
  }

  // --- Score the candidate territory (n12 in Java) ---
  let score = 0; // n12

  // Resource value + strategic bonus (LocAI L2834–L2873)
  // Only for defensive / aggressive personas (n2 == 2 || n2 == 3)
  if (persona === PERSONA_DEFENSIVE || persona === PERSONA_AGGRESSIVE) {
    const resource = territory.resource; // null → no resource (-1 in Java)

    if (resource !== null) {
      // Base resource value: ptResource[type]
      score += ptResource[resource] ?? 0;

      // Bonus for first-of-type and combo scoring
      if (resource === 0) {
        // IRON (n11 == 0)
        if (ironCount === 0)                                       score += ptFirstOfType;
        if (ironCount < coalCount)                                 score += ptIronAndCoal;
        if (ironCount < coalCount && ironCount < treeCount && ironCount < goldCount) score += ptOneOfEach;
      } else if (resource === 1) {
        // COAL (n11 == 1)
        if (coalCount === 0)                                       score += ptFirstOfType;
        if (coalCount < ironCount)                                 score += ptIronAndCoal;
        if (coalCount < ironCount && coalCount < treeCount && coalCount < goldCount) score += ptOneOfEach;
      } else if (resource === 2) {
        // TREE (n11 == 2)
        if (treeCount === 0)                                       score += ptFirstOfType;
        if (treeCount < ironCount && treeCount < coalCount && treeCount < goldCount) score += ptOneOfEach;
      } else if (resource === 3) {
        // GOLD (n11 == 3)
        if (goldCount === 0)                                       score += ptFirstOfType;
        if (goldCount < ironCount && goldCount < coalCount && goldCount < treeCount) score += ptOneOfEach;
      } else if (resource === 4) {
        // STABLE (n11 == 4)
        if (stableCount === 0)                                     score += ptFirstOfType;
      }
    }
  }

  // Adjacent unowned-territory bonus (LocAI L2875–L2887). Persona gate: n2 != 1
  // means non-passive only (defensive or aggressive). Adds ptTouchTerr per
  // adjacent unowned territory; +ptTouchTerrWResource if that neighbor has a
  // resource. Note: this loop scores the candidate based on its UNOWNED
  // neighbors regardless of whether the candidate itself has a resource.
  if (persona === PERSONA_DEFENSIVE || persona === PERSONA_AGGRESSIVE) {
    const n = state.territories.length;
    for (let i = 0; i < n; i++) {
      const neighbor = state.territories[i];
      if (!neighbor) continue;
      if (state.touching[territoryId]?.[i] && neighbor.ownerId === null) {
        score += ptTouchTerr;
        if (neighbor.resource !== null) {
          score += ptTouchTerrWResource;
        }
      }
    }
  }

  // Vulnerability check (LocAI L2888–L2899)
  // Territory is "vulnerable" if any enemy player has forceCount >= player's forceCount + 2
  {
    const forceCount = getForceCount(state, territoryId);
    const playerForce = forceCount.perPlayer[player] ?? 0;
    let isVulnerable = false;
    for (let pid = 0; pid < 7; pid++) {
      if (pid !== player) {
        const enemyForce = forceCount.perPlayer[pid] ?? 0;
        if (enemyForce >= playerForce + 2) {
          isVulnerable = true;
          break;
        }
      }
    }
    if (isVulnerable) {
      score += ptTerrVulnerable;
    }
  }

  // Adjacent player-owned territory bonus (LocAI L2900–L2910)
  {
    const n = state.territories.length;
    for (let i = 0; i < n; i++) {
      const neighbor = state.territories[i];
      if (!neighbor) continue;
      if (state.touching[territoryId]?.[i] && neighbor.ownerId === player) {
        score += ptTouchOwnTerr;
        if (neighbor.resource !== null &&
            (persona === PERSONA_DEFENSIVE || persona === PERSONA_AGGRESSIVE)) {
          score += ptTouchOwnTerrWResource;
        }
      }
    }
  }

  return score;
}

/**
 * Decide which unowned territory to select in the selection phase.
 *
 * Iterates through all unowned territories, scores each via scoreSelectionCandidate,
 * and returns a Plan for the highest-scoring one.
 *
 * @param state   - current game state (expected in 'selection' phase)
 * @param player  - the AI player making the selection
 * @returns Plan with kind: 'selection', player, and territoryId
 * @throws if no unowned territory remains
 */
export function decideSelectionAction(state: GameState, player: PlayerId): Plan {
  let bestId = -1;
  let bestScore = -Infinity;
  for (const t of state.territories) {
    if (t.ownerId !== null) continue;
    const score = scoreSelectionCandidate(state, player, t.id);
    if (score > bestScore) {
      bestScore = score;
      bestId = t.id;
    }
  }
  if (bestId < 0) {
    throw new Error('decideSelectionAction: no unowned territory remains');
  }
  return { kind: 'selection', player, territoryId: bestId };
}
