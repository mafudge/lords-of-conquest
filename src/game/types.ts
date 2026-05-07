import type { ResourceCode } from './codes.js';

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
