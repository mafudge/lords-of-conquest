import type { GameState, Territory } from '../types.js';
import { decodeMap } from '../mapTextCodec.js';
import { assessLakes } from '../mapgen/lakes.js';
import { buildTouching, buildDistance } from '../mapgen/adjacency.js';
import { computeBordersLakes } from '../mapgen/coast.js';

export function applyLoadmap(prev: GameState, mapText: string): GameState {
  const decoded = decodeMap(mapText, { numPlayers: prev.players.length || undefined });
  if (decoded.kind !== 'ok') {
    throw new Error(`Failed to decode map: ${decoded.code} ${decoded.message}`);
  }
  // Run the spec's mandated post-processing
  const squares = [...decoded.squares];
  assessLakes(squares, 1); // annex no water for loaded maps
  const numTerritories = decoded.numTerritories;
  const territories: Territory[] = Array.from({ length: numTerritories }, (_, id) => ({
    id, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
  }));
  for (let i = 0; i < squares.length; i++) {
    const tid = squares[i]!.territoryId;
    if (tid !== null) territories[tid]!.squares.push(i);
  }
  const touching = buildTouching(squares, numTerritories);
  const distance = buildDistance(touching);
  const lakes = computeBordersLakes(squares, numTerritories);
  for (let i = 0; i < numTerritories; i++) {
    territories[i]!.bordersLakes = lakes[i]!;
  }
  // Reset players' ownership-derived state
  const players = prev.players.map((p) => ({
    ...p,
    stockpile: [0, 0, 0, 0, 0] as typeof p.stockpile,
    stockpileLocation: null,
  }));
  return {
    ...prev,
    squares,
    territories,
    touching,
    distance,
    boats: new Array(prev.boats.length).fill(null),
    players,
    currentPhase: 'selection',
    currentPlayer: prev.turnOrder[0] ?? 0,
    year: 1,
    attackNumber: 1,
    shipmentUsed: false,
    pendingTrade: null,
    pendingCombat: null,
    rejectedTrades: [],
    log: [
      ...prev.log,
      { year: 1, phase: 'selection', player: prev.currentPlayer, message: 'Map loaded' },
    ],
  };
}
