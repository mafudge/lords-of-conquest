// Faithful port of LocAI.getPowerRatingForPl (L1617–L1699).
// Returns an integer "power rating" for a player, used for trade fairness
// and ally decisions.
//
// NOTE: The original Java uses `this.pl` for boats and stockpile regardless of
// the `n` (player) parameter. In this stateless TS port there is no `this.pl`
// concept; we use `player` for all scoring, which is correct for the primary
// use-case (AI rating itself or another player).
//
// The attackPlan adjustment (LocAI L1625–L1678) is stubbed: Task 22
// (decideAlliesAction) wires it up.

import type { GameState, PlayerId, CombatState } from '../types.js';
import { ptResource } from '../aiConstants.js';

export function getPowerRatingForPl(
  state: GameState,
  player: PlayerId,
  attackPlan: CombatState | undefined,
): number {
  if (attackPlan !== undefined) {
    throw new Error(
      `getPowerRatingForPl attackPlan adjustment not yet implemented (Task 22)`,
    );
  }

  let rating = 0;

  // nArray tracks total resource-tile counts per resource type (0..4).
  // numResources() in Java counts each resource square, so a doubled resource
  // territory contributes 2. In our model, hasResourceDouble represents that.
  const nArray = [0, 0, 0, 0, 0];

  for (const t of state.territories) {
    if (t.ownerId !== player) continue;

    // +1 for owning the territory (LocAI L1644: ++n8)
    rating += 1;

    // Resource scoring: ptResource[type] * numResources (1 or 2)
    if (t.resource !== null) {
      const resType = t.resource as number;
      const numRes = t.hasResourceDouble ? 2 : 1;
      rating += (ptResource[resType] ?? 0) * numRes;
      nArray[resType] = (nArray[resType] ?? 0) + numRes;
    }

    // Horse = item 6 → +1 (LocAI L1651-L1653)
    if (t.hasHorse) rating += 1;
    // City = item 5 → +2 (LocAI L1654-L1656)
    if (t.hasCity) rating += 2;
    // Weapon = item 7 → +3 (LocAI L1657-L1659)
    if (t.hasWeapon) rating += 3;

    // Boats docked at this territory owned by the player → +2 each
    // (LocAI L1660-L1667; original uses this.pl for boat owner check)
    for (const boat of state.boats) {
      if (boat && boat.ownerId === player && boat.homeTerritoryId === t.id) {
        rating += 2;
      }
    }
  }

  // Resource-type set bonus (LocAI L1671-L1676)
  // n13 = min(iron_units, coal_units)
  const n13 = Math.min(nArray[0]!, nArray[1]!);
  // n4 = min(tree_units, gold_units)
  const n4 = Math.min(nArray[2]!, nArray[3]!);
  // n3 = complete sets of all four
  const n3 = Math.min(n13, n4);
  rating += n3 * 6;
  rating += (n13 - n3) * 3;
  rating += nArray[3]! - n3;

  // Stockpile scoring (LocAI L1679-L1698)
  // Original reads this.lh.getStockpileAmt(this.pl, ...) — we use player.
  const stock = state.players[player]?.stockpile ?? [0, 0, 0, 0, 0];
  const s0 = stock[0] ?? 0;
  const s1 = stock[1] ?? 0;
  const s2 = stock[2] ?? 0;
  const s3 = stock[3] ?? 0;

  const n15 = Math.min(s0, s1);   // min(iron, coal)
  const n16 = Math.min(s2, s3);   // min(tree, gold)
  const n17 = Math.min(n15, n16); // complete sets
  const n18 = n15 > n17 ? n15 - n17 : 0;
  let n19 = Math.floor((s3 - n17) / 2);
  if (n19 < 0) n19 = 0;
  let n2 = Math.floor((s2 - n17) / 3);
  if (n2 < 0) n2 = 0;

  rating += 8 * n17;
  rating += 3 * (n18 + n19);
  rating += 2 * n2;

  return rating;
}
