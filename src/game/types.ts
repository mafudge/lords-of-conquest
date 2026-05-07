import type { ResourceCode } from './codes.js';
import { GRID_WIDTH } from './constants.js';

export type Square = {
  x: number;          // 0..GRID_WIDTH-1
  y: number;          // 0..GRID_HEIGHT-1
  territoryId: number | null;   // null = open water (or boundary water)
  lakeId: number | null;        // null on land or annexed water; otherwise lake index
  isBoundaryWater: boolean;
};

export type PlayerId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Territory = {
  id: number;
  ownerId: PlayerId | null;
  resource: ResourceCode | null;
  hasCity: boolean;
  hasWeapon: boolean;
  hasHorse: boolean;
  hasStockpile: boolean;
  hasResourceDouble: boolean;
  squares: number[];           // Square ids that make up this territory
  bordersLakes: Set<number>;
  citiesAdjacent: number;
};

export type ResourceDensity =
  | { kind: 'fixed'; level: 'veryLow' | 'low' | 'medium' | 'high' }
  | { kind: 'random'; level: 'veryLow' | 'low' | 'medium' | 'high' };

export type MapParams = {
  waterBoundary: boolean;
  waterArea: 'small' | 'medium' | 'large';
  numTerritories: number;
  islands: 'none' | 'some' | 'lots';
  shapes: 'regular' | 'irregular';
  resourceDensity: ResourceDensity;
};

export type Board = {
  squares: Square[];           // length GRID_WIDTH * GRID_HEIGHT
  territories: Territory[];    // length numTerritories
  // Adjacency caches (built after generation)
  touching?: boolean[][];      // [terrA][terrB] (square symmetric)
  distance?: number[][];       // BFS hops between territories
};

export function sqIndex(x: number, y: number): number {
  return y * GRID_WIDTH + x;
}

export function sqXY(i: number): { x: number; y: number } {
  return { x: i % GRID_WIDTH, y: Math.floor(i / GRID_WIDTH) };
}

// 4-neighbor offsets in clockwise order starting from East (matches LocApplet
// L3737-L3825 growth direction increments by 2: 0=E, 2=N, 4=W, 6=S — but we
// translate to 4 cardinal entries here for clarity).
export const NEIGHBOR_OFFSETS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 1, dy: 0 },   // E
  { dx: 0, dy: 1 },   // S
  { dx: -1, dy: 0 },  // W
  { dx: 0, dy: -1 },  // N
] as const;
