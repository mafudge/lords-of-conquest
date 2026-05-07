import type { Square } from '../game/types.js';
import { GRID_WIDTH, GRID_HEIGHT, MAP_ENCODE_ALPHABET } from '../game/constants.js';

export function asciiBoard(squares: Square[]): string {
  const rows: string[] = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    let row = '';
    for (let x = 0; x < GRID_WIDTH; x++) {
      const s = squares[y * GRID_WIDTH + x]!;
      if (s.territoryId === null) row += '~';
      else row += MAP_ENCODE_ALPHABET[s.territoryId]!;
    }
    rows.push(row);
  }
  return rows.join('\n');
}
