import { describe, it, expect } from 'vitest';
import { asciiBoard } from '../../src/cli/asciiPrint.js';
import { generateMap } from '../../src/game/mapgen/index.js';

describe('asciiBoard', () => {
  it('prints 20 lines of 40 chars each', () => {
    const board = generateMap(7, {
      waterBoundary: true, waterArea: 'small', numTerritories: 24,
      islands: 'some', shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    }, 4);
    const text = asciiBoard(board.squares);
    const lines = text.split('\n');
    expect(lines).toHaveLength(20);
    for (const line of lines) expect(line).toHaveLength(40);
  });

  it('uses ~ for water and the territory alphabet for land', () => {
    const board = generateMap(7, {
      waterBoundary: true, waterArea: 'small', numTerritories: 24,
      islands: 'some', shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    }, 4);
    const text = asciiBoard(board.squares);
    expect(text).toMatch(/~/);
    expect(text).toMatch(/[1-9]/);
  });
});
