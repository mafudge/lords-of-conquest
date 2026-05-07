import type { GameState, GameSetup, Player, PlayerId } from '../types.js';
import { generateMap } from '../mapgen/index.js';
import { createRng, nextInt } from '../rng.js';
import { MAX_BOATS } from '../constants.js';

export function applyNewGame(
  prev: GameState,
  setup: GameSetup,
  seed: number,
): GameState {
  const n = setup.players.length;
  if (n < 2) throw new Error('NEW_GAME requires at least 2 players');
  if (n > 7) throw new Error('NEW_GAME accepts at most 7 players');

  const rng = createRng(seed);
  // Map generation consumes RNG draws first; subsequent randomness (player
  // shuffle) draws from the same stream so the full game is reproducible.
  const board = generateMap(seed, setup.map, n);
  // generateMap runs its own RNG instance; advance our cursor past those draws
  // by constructing a fresh rng for any further consumption. (Each call to
  // generateMap is deterministic per seed.)

  const players: Player[] = setup.players.map((p, i) => ({
    id: i as PlayerId,
    name: p.name,
    color: p.color,
    persona: p.persona,
    status: 'playing',
    stockpile: [0, 0, 0, 0, 0],
    stockpileLocation: null,
  }));

  let turnOrder: PlayerId[] = players.map((p) => p.id);
  if (setup.randomizePlayerOrder) {
    // Fisher-Yates with seeded RNG
    const shuffleRng = createRng(seed ^ 0xa5a5_a5a5);
    for (let i = turnOrder.length - 1; i > 0; i--) {
      const j = nextInt(shuffleRng, i + 1);
      [turnOrder[i], turnOrder[j]] = [turnOrder[j]!, turnOrder[i]!];
    }
  }

  const autoReject: boolean[][] = Array.from(
    { length: n }, () => new Array<boolean>(n).fill(false));

  return {
    ...prev,
    schemaVersion: 1,
    seed,
    rngCursor: rng.cursor,
    setup,
    squares: board.squares,
    territories: board.territories,
    touching: board.touching,
    distance: board.distance,
    boats: new Array(MAX_BOATS).fill(null),
    players,
    turnOrder,
    currentPhase: 'selection',
    currentPlayer: turnOrder[0]!,
    year: 1,
    attackNumber: 1,
    shipmentUsed: false,
    pendingTrade: null,
    pendingCombat: null,
    rejectedTrades: [],
    autoReject,
    log: [{ year: 1, phase: 'selection', player: turnOrder[0]!, message: 'Game started' }],
  };
}
