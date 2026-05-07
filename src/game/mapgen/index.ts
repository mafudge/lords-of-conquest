import type { Board, MapParams, Territory } from '../types.js';
import { createRng } from '../rng.js';
import {
  initBoard, computeLandBudget, perTerritoryBudget, minTerritorySize,
} from './board.js';
import { pickSeedSquare, enforceContinentConstraint } from './continent.js';
import { growToBudget, rollbackTerritory } from './grow.js';
import { assessLakes } from './lakes.js';
import { buildTouching, buildDistance } from './adjacency.js';
import { computeBordersLakes } from './coast.js';
import { placeResources } from './resources.js';
import { LAKE_ANNEX_THRESHOLD } from '../constants.js';

const MAX_TERRITORY_RETRIES = 50;

export function generateMap(seed: number, params: MapParams, numPlayers: number): Board {
  const r = createRng(seed);
  const squares = initBoard(params.waterBoundary);
  const landBudget = computeLandBudget(params.waterBoundary, params.waterArea);
  const perTerr = perTerritoryBudget(landBudget, params.numTerritories, params.shapes);
  const minSize = minTerritorySize(params.shapes);

  let n = 0;
  let retries = 0;
  while (n < params.numTerritories) {
    const proposed = pickSeedSquare(squares, r, params.waterBoundary);
    const seedIdx = enforceContinentConstraint(
      squares, r, proposed, params.islands, params.waterBoundary, n,
    );
    squares[seedIdx]!.territoryId = n;
    const placed = growToBudget(squares, r, n, params.shapes, perTerr);
    if (placed < minSize) {
      rollbackTerritory(squares, n);
      retries++;
      if (retries > MAX_TERRITORY_RETRIES) {
        throw new Error(`Too many retries placing territory ${n} (min ${minSize})`);
      }
      continue;
    }
    n++;
    retries = 0;
  }

  assessLakes(squares, LAKE_ANNEX_THRESHOLD);

  // Build territory objects from the final square assignments.
  const territories: Territory[] = Array.from({ length: params.numTerritories }, (_, id) => ({
    id,
    ownerId: null,
    resource: null,
    hasCity: false,
    hasWeapon: false,
    hasHorse: false,
    hasStockpile: false,
    hasResourceDouble: false,
    squares: [],
    bordersLakes: new Set<number>(),
    citiesAdjacent: 0,
  }));
  for (let i = 0; i < squares.length; i++) {
    const tid = squares[i]!.territoryId;
    if (tid !== null) territories[tid]!.squares.push(i);
  }

  const touching = buildTouching(squares, params.numTerritories);
  const distance = buildDistance(touching);
  const lakes = computeBordersLakes(squares, params.numTerritories);
  for (let i = 0; i < params.numTerritories; i++) {
    territories[i]!.bordersLakes = lakes[i]!;
  }

  placeResources(territories, params.resourceDensity, numPlayers, r);

  return { squares, territories, touching, distance };
}
