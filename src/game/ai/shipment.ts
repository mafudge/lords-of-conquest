// Mirrors LocAI L2386–L2533. Enumerates all valid shipment plans and picks
// the max-utility one. Covers stockpile relocation, horse 1-hop, horse 2-hop
// with rest-stop, weapon 1-hop, and boat moves on the same lake (Task 15).
import type { GameState, PlayerId } from '../types.js';
import type { Plan } from '../plans.js';
import { isPassive } from './personas.js';
import { getBFPossible } from './bfPossible.js';
import { getShipmentUtility } from './scoring/shipmentUtility.js';
import { GRID_WIDTH } from '../constants.js';

export function decideShipmentAction(state: GameState, player: PlayerId): Plan {
  if (isPassive(state, player)) return { kind: 'endPhase', player };
  if (state.shipmentUsed) return { kind: 'endPhase', player };

  const bfPossible = getBFPossible(state, player);
  let bestPlan: Plan | null = null;
  let bestUtility = 0;

  // ── Stockpile relocation ──────────────────────────────────────────────────
  const stockpileLoc = state.players[player]?.stockpileLocation ?? null;
  if (stockpileLoc !== null) {
    for (const t of state.territories) {
      if (t.ownerId !== player || t.id === stockpileLoc) continue;
      const candidate: Plan = { kind: 'shipStockpile', player, from: stockpileLoc, to: t.id };
      const u = getShipmentUtility(state, player, candidate, bfPossible);
      if (u > bestUtility) { bestUtility = u; bestPlan = candidate; }
    }
  }

  // ── Horse 1-hop ───────────────────────────────────────────────────────────
  for (const from of state.territories) {
    if (from.ownerId !== player || !from.hasHorse) continue;
    for (const to of state.territories) {
      if (to.ownerId !== player || to.id === from.id) continue;
      if (!state.touching[from.id]?.[to.id]) continue;
      const candidate: Plan = { kind: 'shipHorse', player, from: from.id, to: to.id };
      const u = getShipmentUtility(state, player, candidate, bfPossible);
      if (u > bestUtility) { bestUtility = u; bestPlan = candidate; }
    }
  }

  // ── Horse 2-hop with rest-stop ────────────────────────────────────────────
  for (const from of state.territories) {
    if (from.ownerId !== player || !from.hasHorse) continue;
    for (const restStop of state.territories) {
      if (restStop.ownerId !== player || restStop.id === from.id) continue;
      if (!state.touching[from.id]?.[restStop.id]) continue;
      for (const to of state.territories) {
        if (to.ownerId !== player) continue;
        if (to.id === from.id || to.id === restStop.id) continue;
        if (!state.touching[restStop.id]?.[to.id]) continue;
        const candidate: Plan = {
          kind: 'shipHorse', player, from: from.id, to: to.id, restStop: restStop.id,
        };
        const u = getShipmentUtility(state, player, candidate, bfPossible);
        if (u > bestUtility) { bestUtility = u; bestPlan = candidate; }
      }
    }
  }

  // ── Weapon 1-hop ──────────────────────────────────────────────────────────
  for (const from of state.territories) {
    if (from.ownerId !== player || !from.hasWeapon) continue;
    for (const to of state.territories) {
      if (to.ownerId !== player || to.id === from.id) continue;
      if (!state.touching[from.id]?.[to.id]) continue;
      const candidate: Plan = { kind: 'shipWeapon', player, from: from.id, to: to.id };
      const u = getShipmentUtility(state, player, candidate, bfPossible);
      if (u > bestUtility) { bestUtility = u; bestPlan = candidate; }
    }
  }

  // ── Boat moves on same lake (Task 15) ─────────────────────────────────────
  for (let bi = 0; bi < state.boats.length; bi++) {
    const boat = state.boats[bi];
    if (!boat || boat.ownerId !== player) continue;
    const srcSq = state.squares[boat.y * GRID_WIDTH + boat.x];
    if (!srcSq || srcSq.lakeId === null) continue;
    const lakeId = srcSq.lakeId;

    for (let si = 0; si < state.squares.length; si++) {
      const dst = state.squares[si]!;
      if (dst.territoryId !== null) continue;          // must be open water
      if (dst.lakeId !== lakeId) continue;             // same lake
      if (dst.x === boat.x && dst.y === boat.y) continue; // not current position

      const baseCandidate: Plan = {
        kind: 'shipBoat', player, boatId: bi, toX: dst.x, toY: dst.y,
      };

      // Plain boat move
      const u = getShipmentUtility(state, player, baseCandidate, bfPossible);
      if (u > bestUtility) { bestUtility = u; bestPlan = baseCandidate; }

      // With horse pickup from adjacent owned territory
      for (const t of state.territories) {
        if (t.ownerId !== player || !t.hasHorse) continue;
        if (!t.bordersLakes.has(lakeId)) continue;
        const withHorse: Plan = { ...baseCandidate, pickUpHorseFrom: t.id };
        const u2 = getShipmentUtility(state, player, withHorse, bfPossible);
        if (u2 > bestUtility) { bestUtility = u2; bestPlan = withHorse; }
      }

      // With weapon pickup from adjacent owned territory
      for (const t of state.territories) {
        if (t.ownerId !== player || !t.hasWeapon) continue;
        if (!t.bordersLakes.has(lakeId)) continue;
        const withWeapon: Plan = { ...baseCandidate, pickUpWeaponFrom: t.id };
        const u3 = getShipmentUtility(state, player, withWeapon, bfPossible);
        if (u3 > bestUtility) { bestUtility = u3; bestPlan = withWeapon; }
      }
    }
  }

  return bestPlan ?? { kind: 'endPhase', player };
}
