import type { Square } from '../types.js';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants.js';

// Returns t[a][b] = true iff territories a and b are different and have at least
// one pair of adjacent squares (4-neighbor).
export function buildTouching(squares: Square[], numTerritories: number): boolean[][] {
  const t: boolean[][] = Array.from({ length: numTerritories }, () =>
    new Array<boolean>(numTerritories).fill(false));
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const s = squares[y * GRID_WIDTH + x]!;
      if (s.territoryId === null) continue;
      const me = s.territoryId;
      const checkPairs = [
        x < GRID_WIDTH - 1 ? squares[y * GRID_WIDTH + (x + 1)]!.territoryId : null,
        y < GRID_HEIGHT - 1 ? squares[(y + 1) * GRID_WIDTH + x]!.territoryId : null,
      ];
      for (const other of checkPairs) {
        if (other !== null && other !== me) {
          t[me]![other] = true;
          t[other]![me] = true;
        }
      }
    }
  }
  return t;
}
