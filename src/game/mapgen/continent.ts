import type { Square } from '../types.js';
import { type RngState, nextInt } from '../rng.js';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants.js';

// Returns a random Square index that is open-water (territoryId == null) and
// not boundary-water (when waterBoundary is on). Mirrors LocApplet L3693-3698.
export function pickSeedSquare(squares: Square[], r: RngState, waterBoundary: boolean): number {
  // Bounded retry — if the board is mostly full this could loop, but generateMap
  // ensures we always have plenty of open water when seeding territories.
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const x = waterBoundary ? 1 + nextInt(r, GRID_WIDTH - 2) : nextInt(r, GRID_WIDTH);
    const y = waterBoundary ? 1 + nextInt(r, GRID_HEIGHT - 2) : nextInt(r, GRID_HEIGHT);
    const idx = y * GRID_WIDTH + x;
    const s = squares[idx]!;
    if (s.territoryId === null && !s.isBoundaryWater) return idx;
  }
  throw new Error('pickSeedSquare: no open-water square found');
}
