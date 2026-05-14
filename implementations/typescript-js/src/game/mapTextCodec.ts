import type { Square } from './types.js';
import { GRID_WIDTH, GRID_HEIGHT, MAP_ENCODE_ALPHABET } from './constants.js';

export function encodeMap(squares: Square[]): string {
  const rows: string[] = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    let row = '';
    for (let x = 0; x < GRID_WIDTH; x++) {
      const t = squares[y * GRID_WIDTH + x]!.territoryId;
      row += t === null ? '.' : MAP_ENCODE_ALPHABET[t]!;
    }
    rows.push(row);
  }
  rows.push('#');
  rows.push('#########################################');
  rows.push('Created by LOC Map Generator');
  return rows.join('\n');
}

export type DecodeResult =
  | { kind: 'ok'; squares: Square[]; numTerritories: number }
  | { kind: 'error'; code: -1 | -2 | -3; message: string };

const ALPHABET_INDEX: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < MAP_ENCODE_ALPHABET.length; i++) m[MAP_ENCODE_ALPHABET[i]!] = i;
  return m;
})();

export type DecodeOptions = {
  numPlayers?: number;
};

export function decodeMap(text: string, opts: DecodeOptions = {}): DecodeResult {
  const lines = text.split(/\r?\n/);
  if (lines.length < GRID_HEIGHT) {
    return { kind: 'error', code: -1, message: 'Fewer than 20 grid rows' };
  }
  const grid = lines.slice(0, GRID_HEIGHT);
  for (const row of grid) {
    if (row.length < GRID_WIDTH) {
      return { kind: 'error', code: -1, message: `Row too short (need ${GRID_WIDTH})` };
    }
  }
  const squares: Square[] = new Array(GRID_WIDTH * GRID_HEIGHT);
  const territoryCounts = new Map<number, number>();
  let maxTerr = -1;
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const ch = grid[y]![x]!;
      let tid: number | null = null;
      if (ch !== '.') {
        const idx = ALPHABET_INDEX[ch];
        if (idx === undefined) {
          return { kind: 'error', code: -1, message: `Unknown character '${ch}' at (${x},${y})` };
        }
        tid = idx;
        if (idx > maxTerr) maxTerr = idx;
        territoryCounts.set(idx, (territoryCounts.get(idx) ?? 0) + 1);
      }
      squares[y * GRID_WIDTH + x] = {
        x, y, territoryId: tid, lakeId: null, isBoundaryWater: false,
      };
    }
  }
  const numTerritories = maxTerr + 1;
  // -2: any territory below 7 squares, OR exceeding 99
  for (const [tid, count] of territoryCounts) {
    if (count < 7 || count > 99) {
      return { kind: 'error', code: -2, message: `Territory ${tid} has ${count} squares (need 7..99)` };
    }
  }
  // -3: numTerritories not in [20, 64], or fewer than 7 × numPlayers
  if (opts.numPlayers !== undefined && numTerritories > 0 && (numTerritories < 20 || numTerritories > 64)) {
    return { kind: 'error', code: -3, message: `Territory count ${numTerritories} not in [20, 64]` };
  }
  if (opts.numPlayers !== undefined && numTerritories < 7 * opts.numPlayers) {
    return { kind: 'error', code: -3, message: `Need at least ${7 * opts.numPlayers} territories for ${opts.numPlayers} players` };
  }
  return { kind: 'ok', squares, numTerritories };
}
