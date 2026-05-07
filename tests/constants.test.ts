import { describe, it, expect } from 'vitest';
import * as C from '../src/game/constants.js';

describe('game constants', () => {
  it('matches Gettman pool sizes and grid dimensions', () => {
    expect(C.GRID_WIDTH).toBe(40);
    expect(C.GRID_HEIGHT).toBe(20);
    expect(C.MAX_PLAYERS).toBe(7);
    expect(C.MAX_TERRITORIES).toBe(64);
    expect(C.MAX_BOATS).toBe(256);
    expect(C.MAX_LAKES).toBe(256);
    expect(C.SQUARES_PER_TERRITORY_CAP).toBe(99);
    expect(C.NATIVES_PLAYER_ID).toBe(7);
  });

  it('uses 1/6 phase skip probability (LocApplet L2890)', () => {
    expect(C.PHASE_SKIP_PROBABILITY).toBeCloseTo(1 / 6, 6);
  });

  it('matches land budgets from LocApplet L3650-3680', () => {
    expect(C.LAND_BUDGET_WITH_BOUNDARY).toEqual({ small: 547, medium: 410, large: 274 });
    expect(C.LAND_BUDGET_WITHOUT_BOUNDARY).toEqual({ small: 640, medium: 480, large: 320 });
  });

  it('uses Gettman lake annex threshold and islands probability', () => {
    expect(C.LAKE_ANNEX_THRESHOLD).toBe(9);
    expect(C.ISLANDS_SOME_PROBABILITY).toBeCloseTo(0.25, 6);
  });

  it('exposes the 64-char map alphabet', () => {
    expect(C.MAP_ENCODE_ALPHABET).toBe(
      '123456789ABCDEFGHIJKLMNPQRSTUWXYZabcdefghijklmnpqrstvwxyz@$%&*()'
    );
    expect(C.MAP_ENCODE_ALPHABET).toHaveLength(64);
  });
});
