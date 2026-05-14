import type { Square } from '../types.js';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants.js';

export function computeBordersLakes(squares: Square[], numTerritories: number): Set<number>[] {
  const result: Set<number>[] = Array.from({ length: numTerritories }, () => new Set<number>());
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const s = squares[y * GRID_WIDTH + x]!;
      if (s.territoryId === null) continue;
      const checks = [
        x > 0 ? squares[y * GRID_WIDTH + (x - 1)] : null,
        x < GRID_WIDTH - 1 ? squares[y * GRID_WIDTH + (x + 1)] : null,
        y > 0 ? squares[(y - 1) * GRID_WIDTH + x] : null,
        y < GRID_HEIGHT - 1 ? squares[(y + 1) * GRID_WIDTH + x] : null,
      ];
      for (const n of checks) {
        if (n && n.lakeId !== null) result[s.territoryId]!.add(n.lakeId);
      }
    }
  }
  return result;
}
