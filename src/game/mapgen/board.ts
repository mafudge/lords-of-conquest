import {
  GRID_WIDTH, GRID_HEIGHT,
  LAND_BUDGET_WITH_BOUNDARY, LAND_BUDGET_WITHOUT_BOUNDARY,
} from '../constants.js';
import type { Square, MapParams } from '../types.js';

export function initBoard(waterBoundary: boolean): Square[] {
  const squares: Square[] = new Array(GRID_WIDTH * GRID_HEIGHT);
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const onEdge = x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1;
      squares[y * GRID_WIDTH + x] = {
        x, y,
        territoryId: null,
        lakeId: null,
        isBoundaryWater: waterBoundary && onEdge,
      };
    }
  }
  return squares;
}

export function computeLandBudget(
  waterBoundary: boolean,
  waterArea: MapParams['waterArea'],
): number {
  return waterBoundary
    ? LAND_BUDGET_WITH_BOUNDARY[waterArea]
    : LAND_BUDGET_WITHOUT_BOUNDARY[waterArea];
}

export function perTerritoryBudget(
  landBudget: number,
  numTerritories: number,
  shapes: MapParams['shapes'],
): number {
  let perTerr = Math.floor(landBudget / numTerritories);
  if (shapes === 'irregular') perTerr -= 2;
  return perTerr;
}

export function minTerritorySize(shapes: MapParams['shapes']): number {
  return shapes === 'irregular' ? 7 : 9;
}
