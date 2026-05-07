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
