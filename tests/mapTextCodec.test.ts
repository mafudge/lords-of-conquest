import { describe, it, expect } from 'vitest';
import { encodeMap } from '../src/game/mapTextCodec.js';
import { initBoard } from '../src/game/mapgen/board.js';

describe('encodeMap', () => {
  it('all-water board encodes as 20 lines of 40 dots followed by footer', () => {
    const sq = initBoard(false);
    const text = encodeMap(sq);
    const lines = text.split('\n');
    expect(lines.slice(0, 20)).toEqual(Array(20).fill('.'.repeat(40)));
    expect(lines[20]).toBe('#');
    expect(lines[21]).toBe('#########################################');
    expect(lines[22]).toBe('Created by LOC Map Generator');
  });

  it('encodes territory ids using the 64-char alphabet', () => {
    const sq = initBoard(false);
    sq[0]!.territoryId = 0;     // '1'
    sq[1]!.territoryId = 1;     // '2'
    sq[39]!.territoryId = 9;    // 'A'
    const text = encodeMap(sq);
    const firstRow = text.split('\n')[0]!;
    expect(firstRow[0]).toBe('1');
    expect(firstRow[1]).toBe('2');
    expect(firstRow[39]).toBe('A');
  });
});
