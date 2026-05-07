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

export function decodeMap(text: string): DecodeResult {
  const lines = text.split(/\r?\n/);
  // Need at least 20 grid rows.
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
      }
      squares[y * GRID_WIDTH + x] = {
        x, y, territoryId: tid, lakeId: null, isBoundaryWater: false,
      };
    }
  }
  const numTerritories = maxTerr + 1;
  return { kind: 'ok', squares, numTerritories };
}
