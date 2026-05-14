import type { Square, MapParams } from '../types.js';
import { type RngState, nextInt } from '../rng.js';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants.js';

// 4-neighbor offsets in clockwise order from East — matches LocApplet's
// `(int)(rnd*4)*2` choice that picks 0/2/4/6 = E/N/W/S then increments by 2.
const DIRS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 1, dy: 0 },   // E
  { dx: 0, dy: -1 },  // N
  { dx: -1, dy: 0 },  // W
  { dx: 0, dy: 1 },   // S
];

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
}

function isPlaceable(squares: Square[], x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const s = squares[y * GRID_WIDTH + x]!;
  return s.territoryId === null && !s.isBoundaryWater;
}

// Find squares that belong to `terrId` and have at least one placeable neighbor.
function findGrowableParts(squares: Square[], terrId: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < squares.length; i++) {
    const s = squares[i]!;
    if (s.territoryId !== terrId) continue;
    for (const d of DIRS) {
      if (isPlaceable(squares, s.x + d.dx, s.y + d.dy)) {
        result.push(i);
        break;
      }
    }
  }
  return result;
}

// Try one growth step. Returns true if a square was placed, false if the
// territory is fully boxed in.
export function growOnce(
  squares: Square[],
  r: RngState,
  terrId: number,
  shapes: MapParams['shapes'],
): boolean {
  const growable = findGrowableParts(squares, terrId);
  if (growable.length === 0) return false;

  const part = squares[growable[nextInt(r, growable.length)]!]!;
  // Random starting direction (0..3), then walk clockwise — matches Gettman.
  const startDir = nextInt(r, 4);
  for (let k = 0; k < 4; k++) {
    const d = DIRS[(startDir + k) % 4]!;
    const nx = part.x + d.dx;
    const ny = part.y + d.dy;
    if (isPlaceable(squares, nx, ny)) {
      squares[ny * GRID_WIDTH + nx]!.territoryId = terrId;
      // Irregular: also try to jump 2 squares in the same direction
      if (shapes === 'irregular') {
        const fx = nx + d.dx;
        const fy = ny + d.dy;
        if (isPlaceable(squares, fx, fy)) {
          squares[fy * GRID_WIDTH + fx]!.territoryId = terrId;
        }
      }
      return true;
    }
  }
  return false;
}

// Grow `terrId` until it has `budget` squares OR no further growth is possible.
// Returns the actual number of squares now claimed by the territory.
export function growToBudget(
  squares: Square[],
  r: RngState,
  terrId: number,
  shapes: MapParams['shapes'],
  budget: number,
): number {
  let count = squares.reduce((n, s) => n + (s.territoryId === terrId ? 1 : 0), 0);
  while (count < budget) {
    if (!growOnce(squares, r, terrId, shapes)) break;
    count = squares.reduce((n, s) => n + (s.territoryId === terrId ? 1 : 0), 0);
  }
  return count;
}

export function rollbackTerritory(squares: Square[], terrId: number): void {
  for (const s of squares) {
    if (s.territoryId === terrId) s.territoryId = null;
  }
}
