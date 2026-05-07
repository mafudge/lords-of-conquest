import { describe, it, expect } from 'vitest';
import { Code } from '../src/game/codes.js';

describe('Code', () => {
  it('matches Square.java numeric values exactly', () => {
    expect(Code.NOTHING).toBe(-1);
    expect(Code.IRON).toBe(0);
    expect(Code.COAL).toBe(1);
    expect(Code.TREE).toBe(2);
    expect(Code.GOLD).toBe(3);
    expect(Code.STABLE).toBe(4);
    expect(Code.CITY).toBe(5);
    expect(Code.HORSE).toBe(6);
    expect(Code.WEAPON).toBe(7);
    expect(Code.STOCKPILE).toBe(8);
    expect(Code.BOAT).toBe(9);
  });
});
