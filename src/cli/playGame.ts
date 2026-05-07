#!/usr/bin/env node
import { reduce } from '../game/reducer.js';
import type { GameState, GameSetup } from '../game/types.js';
import { Code } from '../game/codes.js';

function parseArgs(argv: string[]): { seed: number } {
  let seed = Date.now() & 0xffffffff;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--seed' && argv[i + 1]) { seed = Number(argv[++i]); }
    else if (a === '--help' || a === '-h') {
      console.log('Usage: npm run play-game -- --seed N');
      process.exit(0);
    }
  }
  return { seed };
}

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'Red', persona: 'human' },
    { color: 'blue', name: 'Blue', persona: 'aggressive' },
    { color: 'cyan', name: 'Cyan', persona: 'defensive' },
    { color: 'purple', name: 'Purple', persona: 'passive' },
  ],
  citiesToWin: 5,
  elementOfChance: 'high',
  randomizePlayerOrder: false,
  map: {
    waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' },
  },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

const { seed } = parseArgs(process.argv.slice(2));
let s = reduce(initial(), { kind: 'newGame', setup, seed });
console.log(`Seed: ${seed}`);
console.log(`Players: ${s.players.length}`);
console.log(`Initial turn order: ${s.turnOrder.join(', ')}`);
console.log('');

// Drain selection
console.log('--- Selection phase ---');
let selectionMoves = 0;
while (s.territories.some((t) => t.ownerId === null)) {
  const free = s.territories.find((t) => t.ownerId === null)!;
  s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  selectionMoves++;
}
console.log(`Drafted ${selectionMoves} territories.`);
const counts = new Array<number>(s.players.length).fill(0);
for (const t of s.territories) if (t.ownerId !== null) counts[t.ownerId]!++;
console.log(`Distribution: ${s.players.map((p, i) => `${p.name}=${counts[i]}`).join(', ')}`);

// End selection
s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
console.log(`\nReversed turn order: ${s.turnOrder.join(', ')}`);

// First production
console.log('\n--- Production phase ---');
s = reduce(s, { kind: 'production' });
const lastLog = s.log[s.log.length - 1]!;
console.log(lastLog.message);
const resName: Record<number, string> = {
  [Code.IRON]: 'Iron', [Code.COAL]: 'Coal', [Code.TREE]: 'Tree',
  [Code.GOLD]: 'Gold', [Code.STABLE]: 'Stable',
};
console.log('\nStockpiles:');
for (const p of s.players) {
  const parts = p.stockpile
    .map((v, i) => `${resName[i]}=${v}`)
    .filter((part) => !part.endsWith('=0'));
  console.log(`  ${p.name.padEnd(8)} ${parts.length > 0 ? parts.join(' ') : '(empty)'}`);
}
console.log('\nHorses on the map:');
for (const t of s.territories) {
  if (t.hasHorse) {
    const owner = t.ownerId !== null ? s.players[t.ownerId]!.name : '(none)';
    console.log(`  T${t.id} (${owner})`);
  }
}
console.log(`\nFinal phase: ${s.currentPhase}`);
