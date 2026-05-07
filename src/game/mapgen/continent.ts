import type { Square, MapParams } from '../types.js';
import { type RngState, nextInt, nextFloat } from '../rng.js';
import { GRID_WIDTH, GRID_HEIGHT, ISLANDS_SOME_PROBABILITY } from '../constants.js';

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

export function isAdjacentToLand(squares: Square[], x: number, y: number): boolean {
  // 4-neighbor check
  if (x > 0 && squares[y * GRID_WIDTH + (x - 1)]!.territoryId !== null) return true;
  if (x < GRID_WIDTH - 1 && squares[y * GRID_WIDTH + (x + 1)]!.territoryId !== null) return true;
  if (y > 0 && squares[(y - 1) * GRID_WIDTH + x]!.territoryId !== null) return true;
  if (y < GRID_HEIGHT - 1 && squares[(y + 1) * GRID_WIDTH + x]!.territoryId !== null) return true;
  return false;
}

// LocApplet L3699-3719: continent vs island constraint, only enforced for n > 0.
export function enforceContinentConstraint(
  squares: Square[],
  r: RngState,
  proposedIdx: number,
  islands: MapParams['islands'],
  waterBoundary: boolean,
  territoryIndex: number,
): number {
  if (territoryIndex === 0 || islands === 'lots') return proposedIdx;

  const mustBeAdjacent = islands === 'none' || (islands === 'some' && nextFloat(r) < ISLANDS_SOME_PROBABILITY);
  if (!mustBeAdjacent) return proposedIdx;

  // Reroll up to a generous bound until the seed is adjacent to some existing land.
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const idx = pickSeedSquare(squares, r, waterBoundary);
    const s = squares[idx]!;
    if (isAdjacentToLand(squares, s.x, s.y)) return idx;
  }
  throw new Error('enforceContinentConstraint: no adjacent open-water square found');
}
