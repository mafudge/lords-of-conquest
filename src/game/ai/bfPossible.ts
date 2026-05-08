import type { GameState, PlayerId } from '../types.js';
import { GRID_WIDTH } from '../constants.js';

// Returns matrix [numTerritories][7] of maximum enemy battle-force projections.
// result[t][p] = the maximum enemy battle force player p could project onto
// territory t. Mirrors LocAI.getBFPossible L109–L170.
export function getBFPossible(state: GameState, self: PlayerId): number[][] {
  const n = state.territories.length;
  const result: number[][] = Array.from({ length: n }, () => new Array<number>(7).fill(0));

  for (let t = 0; t < n; t++) {
    const territory = state.territories[t]!;

    // Distance-2 horse/weapon threat (only for self-owned territories)
    if (territory.ownerId === self) {
      for (let t2 = 0; t2 < n; t2++) {
        const territory2 = state.territories[t2]!;
        const p = territory2.ownerId;
        if (p === null || p === self) continue;
        if ((state.distance[t]?.[t2] ?? Infinity) !== 2) continue;
        let score = 0;
        if (territory2.hasHorse) score = 1;
        if (territory2.hasHorse && territory2.hasWeapon) score = 4;
        if (score > (result[t]![p] ?? 0)) {
          result[t]![p] = score;
        }
      }
    }

    // Lake-bordering enemy boats (runs for all territories, not just self-owned)
    for (let bi = 0; bi < state.boats.length; bi++) {
      const boat = state.boats[bi];
      if (!boat) continue;
      const boatOwner = boat.ownerId;
      if (boatOwner === self) continue;
      const lakeId = state.squares[boat.y * GRID_WIDTH + boat.x]?.lakeId;
      let score = 0;
      if (lakeId !== null && lakeId !== undefined && territory.bordersLakes.has(lakeId)) {
        const home = state.territories[boat.homeTerritoryId];
        if (home) {
          score = 2;
          if (home.hasHorse) score += 1;
          if (home.hasWeapon) score += 3;
        }
      }
      if (score > (result[t]![boatOwner] ?? 0)) {
        result[t]![boatOwner] = score;
      }
    }
  }

  return result;
}
