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
  // Adjacency caches — always populated by generateMap (and any future loader
  // that produces a Board). Required so consumers don't need to null-check.
  touching: boolean[][];       // [terrA][terrB] (symmetric)
  distance: number[][];        // BFS hops between territories
};

// --- engine types ---

export type PlayerColor = 'red' | 'blue' | 'cyan' | 'purple' | 'orange' | 'green' | 'yellow';
export type Persona = 'human' | 'passive' | 'defensive' | 'aggressive';
export type ElementOfChance = 'low' | 'medium' | 'high';

export type Phase =
  | 'setup'
  | 'selection'
  | 'production'
  | 'trade'
  | 'shipment'
  | 'conquest'
  | 'development'
  | 'gameOver';

// 5-tuple keyed by ResourceCode 0..4 = [iron, coal, tree, gold, stable]
export type Stockpile = [number, number, number, number, number];

export type Player = {
  id: PlayerId;
  name: string;
  color: PlayerColor;
  persona: Persona;
  status: 'playing' | 'eliminated' | 'notPlaying';
  stockpile: Stockpile;
  stockpileLocation: number | null;
};

export type Boat = {
  id: number;
  x: number; y: number;
  homeTerritoryId: number;
  ownerId: PlayerId;
  carryHorse: boolean;
  carryWeapon: boolean;
};

export type GameSetup = {
  players: Array<{ color: PlayerColor; name: string; persona: Persona }>;
  citiesToWin: 3 | 4 | 5 | 6 | 7 | 8;
  elementOfChance: ElementOfChance;
  randomizePlayerOrder: boolean;
  map: MapParams;
};

export type TradeOffer = {
  proposerId: PlayerId;
  tradeeId: PlayerId;
  give: Stockpile;
  receive: Stockpile;
  status: 'proposed' | 'accepted' | 'rejected';
  horseFromTerritoryId?: number;
  horseToTerritoryId?: number;
};

export type CombatState = {
  attackerId: PlayerId;
  defenderId: PlayerId | null;
  fromTerritoryId: number;
  targetTerritoryId: number;
  boatId: number | null;
  horseFromTerritoryId: number | null;
  weaponFromTerritoryId: number | null;
  alliesDecisions: Array<'attacker' | 'neutral' | 'defender'>;
  alliesPending: Set<PlayerId>;
  attackerStrength: number;
  defenderStrength: number;
  resolved: boolean;
  attackerWon: boolean;
};

export type LogEntry = {
  year: number;
  phase: Phase;
  player: PlayerId;
  message: string;
};

export type RejectedTrade = {
  trader: PlayerId;
  tradee: PlayerId;
  tradeKey: string;       // canonical hash of give+receive
  count: number;
};

export type GameState = {
  schemaVersion: 1;
  seed: number;
  rngCursor: number;
  setup: GameSetup;
  squares: Square[];
  territories: Territory[];
  touching: boolean[][];               // [terrA][terrB] (symmetric)
  distance: number[][];                // BFS hops between territories
  boats: Array<Boat | null>;          // 256-slot pool; null = invalid slot
  players: Player[];                   // length 2..7
  turnOrder: PlayerId[];               // current rotation
  currentPhase: Phase;
  currentPlayer: PlayerId;
  year: number;
  attackNumber: 1 | 2;
  shipmentUsed: boolean;
  shipmentForfeitsSecondAttack: boolean[];  // indexed by PlayerId
  pendingTrade: TradeOffer | null;
  pendingCombat: CombatState | null;
  rejectedTrades: RejectedTrade[];
  autoReject: boolean[][];             // [tradee][trader] = true means tradee auto-rejects
  log: LogEntry[];                     // ring buffer
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
