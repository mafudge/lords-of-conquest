import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, Persona, Stockpile } from '../../src/game/types.js';

export type FixtureOptions = {
  seed?: number;
  playerCount?: number;
  personas?: Persona[];      // defaults to all 'aggressive'
  citiesToWin?: 3 | 4 | 5 | 6 | 7 | 8;
  elementOfChance?: 'low' | 'medium' | 'high';
  numTerritories?: number;
};

export function seededState(opts: FixtureOptions = {}): GameState {
  const seed = opts.seed ?? 42;
  const playerCount = opts.playerCount ?? 3;
  const personas: Persona[] = opts.personas
    ?? new Array(playerCount).fill('aggressive');
  const colors = ['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const;

  const setup: GameSetup = {
    players: personas.slice(0, playerCount).map((p, i) => ({
      color: colors[i]!, name: `p${i}`, persona: p,
    })),
    citiesToWin: opts.citiesToWin ?? 5,
    elementOfChance: opts.elementOfChance ?? 'high',
    randomizePlayerOrder: false,
    map: {
      waterBoundary: true, waterArea: 'small',
      numTerritories: opts.numTerritories ?? 24,
      islands: 'some', shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    },
  };

  const initial: GameState = {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup, squares: [], territories: [], boats: [], players: [],
    touching: [], distance: [],
    turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
    year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  };

  let s = reduce(initial, { kind: 'newGame', setup, seed });
  // Drain selection by giving each player territories in turn (no AI yet).
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  return s;
}

export function setStockpile(s: GameState, player: number, stockpile: Stockpile): GameState {
  return {
    ...s,
    players: s.players.map((p) => p.id === player ? { ...p, stockpile } : p),
  };
}
