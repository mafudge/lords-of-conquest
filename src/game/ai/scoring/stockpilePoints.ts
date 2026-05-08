import type { GameState, PlayerId, Stockpile } from '../../types.js';
import { ptCanBuildCity, ptCanBuildWeapon, ptCanBuildBoat } from '../../aiConstants.js';
import { getTerrNoHorseToPlace, getTerrNoHorseToRemove } from './horseMoveUtility.js';

/**
 * Score a (possibly hypothetical) stockpile for a player.
 * Mirrors LocAI.getStockpilePoints L1274-L1308.
 *
 * Parameters map from Java:
 *   int n          → player   (used for getStockpileAmt(n, 4) = current stables in state)
 *   Stockpile      → stockpile (the candidate stockpile being evaluated)
 *   int[][] nArray → bfPossible (passed through; not actually read by this function)
 *   this.pl        → player   (same value; used for getItemVacancyCount)
 *
 * Horse term (LocAI L1297-L1306) — computed via getTerrNoHorseToPlace /
 * getTerrNoHorseToRemove (Task 20).
 */
export function getStockpilePoints(
  state: GameState,
  player: PlayerId,
  stockpile: Stockpile,
  bfPossible: number[][],
): number {
  let n2 = 0;

  // Unpack resources: 0=iron, 1=coal, 2=tree, 3=gold, 4=stable
  const n3 = stockpile[0]; // iron
  const n4 = stockpile[1]; // coal
  const n5 = stockpile[2]; // tree
  const n6 = stockpile[3]; // gold
  const n7 = stockpile[4]; // stable

  // Minimum iron/coal pair → weapon-iron constraint
  const n8 = n3 < n4 ? n3 : n4;           // min(iron, coal)
  // Minimum tree/gold pair → city constraint
  const n9 = n5 < n6 ? n5 : n6;           // min(tree, gold)
  // Overall minimum across all four non-horse resources
  const n10 = n8 < n9 ? n8 : n9;          // min(iron, coal, tree, gold)

  // Extra gold (beyond the set of all-four) can still build cities via 4-gold rule
  const n11 = Math.trunc((n6 - n10) / 4); // floor((gold - n10) / 4)
  // Total city-buildable sets
  const n12 = n10 + n11;
  // Vacancies: territories owned by player that don't have a city (item code 5)
  const n13 = getItemVacancyCount(state, player, 'city');
  const n14 = n12 < n13 ? n12 : n13;
  n2 += n14 * ptCanBuildCity;

  // Weapon points: extra iron/coal pairs beyond city-building usage
  const n15 = n8 - n10;                              // iron/coal surplus over city sets
  const n16 = Math.trunc((n6 - 4 * n11 - n10) / 2); // remaining gold / 2 as weapon sets
  const n17 = n15 + n16;
  // Vacancies: territories without a weapon (item code 7)
  const n18 = getItemVacancyCount(state, player, 'weapon');
  const n19 = n17 < n18 ? n17 : n18;
  n2 += n19 * ptCanBuildWeapon;

  // Boat points: surplus trees beyond city-building usage
  const n20 = Math.trunc((n5 - n10) / 3); // floor((tree - n10) / 3)
  n2 += n20 * ptCanBuildBoat;

  // Horse term — LocAI L1297-L1306.
  // n21 = current stables in player's actual stockpile (resource index 4).
  // n22 = proposed stables - current stables (positive = gaining horses, negative = giving away).
  // n23 = divisor 10.
  const n21 = state.players[player]?.stockpile[4] ?? 0;
  const n22 = n7 - n21;
  const n23 = 10;
  if (n22 > 0) {
    // horsePlaceTerrNo: return territory id (isAddingFromStockpile=false → Java n2==0 → terrId).
    const horsePlaceTerrNo = getTerrNoHorseToPlace(state, player, bfPossible, false);
    if (horsePlaceTerrNo > -1) {
      // horsePlaceUtility: return score (isAddingFromStockpile=true → Java n2!=0 → score).
      const horsePlaceUtility = getTerrNoHorseToPlace(state, player, bfPossible, true);
      n2 += Math.trunc(horsePlaceUtility / n23);
    }
  } else if (n22 < 0) {
    // horseRemoveTerrNo: return territory id (considerNothing=false → Java n2==0 → terrId).
    const horseRemoveTerrNo = getTerrNoHorseToRemove(state, player, -1, bfPossible, false);
    if (horseRemoveTerrNo > -1) {
      // horseRemoveUtility: return score (considerNothing=true → Java n2!=0 → score).
      const horseRemoveUtility = getTerrNoHorseToRemove(state, player, -1, bfPossible, true);
      n2 += Math.trunc(horseRemoveUtility / n23);
    }
  }

  return n2;
}

/**
 * Count of territories owned by `player` that do NOT contain the given item.
 * Mirrors LocApplet.getItemVacancyCount L3198-L3208, where item code 5 = city,
 * 7 = weapon, 6 = horse.
 */
function getItemVacancyCount(
  state: GameState,
  player: PlayerId,
  item: 'city' | 'weapon' | 'horse',
): number {
  let count = 0;
  for (const terr of state.territories) {
    if (terr.ownerId !== player) continue;
    const hasItem =
      item === 'city'   ? terr.hasCity :
      item === 'weapon' ? terr.hasWeapon :
                          terr.hasHorse;
    if (!hasItem) count++;
  }
  return count;
}
