#!/usr/bin/env node
import { generateMap } from '../game/mapgen/index.js';
import { encodeMap } from '../game/mapTextCodec.js';
import { asciiBoard } from './asciiPrint.js';
import { Code } from '../game/codes.js';
import type { MapParams } from '../game/types.js';

function parseArgs(argv: string[]): {
  seed: number;
  numPlayers: number;
  params: MapParams;
  format: 'ascii' | 'text';
} {
  let seed = Date.now() & 0xffffffff;
  let numPlayers = 4;
  let format: 'ascii' | 'text' = 'ascii';
  const params: MapParams = {
    waterBoundary: true,
    waterArea: 'small',
    numTerritories: 24,
    islands: 'some',
    shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' },
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = argv[i + 1];
    if (a === '--seed' && next) { seed = Number(next); i++; }
    else if (a === '--players' && next) { numPlayers = Number(next); i++; }
    else if (a === '--territories' && next) { params.numTerritories = Number(next); i++; }
    else if (a === '--islands' && next) { params.islands = next as MapParams['islands']; i++; }
    else if (a === '--shapes' && next) { params.shapes = next as MapParams['shapes']; i++; }
    else if (a === '--water' && next) { params.waterArea = next as MapParams['waterArea']; i++; }
    else if (a === '--no-boundary') { params.waterBoundary = false; }
    else if (a === '--format' && next) { format = next as 'ascii' | 'text'; i++; }
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return { seed, numPlayers, params, format };
}

function printHelp(): void {
  console.log(`Usage: npm run gen-map -- [options]
Options:
  --seed N             RNG seed (default: random)
  --players N          number of players (default 4)
  --territories N      number of territories (default 24)
  --islands MODE       none | some | lots (default some)
  --shapes MODE        regular | irregular (default regular)
  --water SIZE         small | medium | large (default small)
  --no-boundary        disable water boundary ring
  --format MODE        ascii (default) | text (Gettman map alphabet)`);
}

const { seed, numPlayers, params, format } = parseArgs(process.argv.slice(2));
const board = generateMap(seed, params, numPlayers);

console.log(`Seed: ${seed}`);
console.log(`Players: ${numPlayers} | Territories: ${params.numTerritories} | Islands: ${params.islands} | Shapes: ${params.shapes} | Water: ${params.waterArea}${params.waterBoundary ? '' : ' (no boundary)'}`);
console.log('');
if (format === 'text') console.log(encodeMap(board.squares));
else console.log(asciiBoard(board.squares));
console.log('');
console.log('Territory summary:');
const resName: Record<number, string> = {
  [Code.IRON]: 'Iron', [Code.COAL]: 'Coal', [Code.TREE]: 'Tree',
  [Code.GOLD]: 'Gold', [Code.STABLE]: 'Stable',
};
for (const t of board.territories) {
  const res = t.resource !== null ? resName[t.resource] ?? '?' : '-';
  const lakes = t.bordersLakes.size > 0 ? `lakes={${[...t.bordersLakes].join(',')}}` : '';
  console.log(`  T${t.id.toString().padStart(2, ' ')} squares=${t.squares.length.toString().padStart(2, ' ')} resource=${res.padEnd(7)} ${lakes}`);
}
