// LocApplet L2890
export const PHASE_SKIP_PROBABILITY = 1 / 6;

// LocApplet L3650-3680
export const LAND_BUDGET_WITH_BOUNDARY = { small: 547, medium: 410, large: 274 } as const;
export const LAND_BUDGET_WITHOUT_BOUNDARY = { small: 640, medium: 480, large: 320 } as const;

// LocApplet L3843
export const LAKE_ANNEX_THRESHOLD = 9;

// LocApplet L3699
export const ISLANDS_SOME_PROBABILITY = 0.25;

// LocApplet L3935 — 64 chars, drives MAX_TERRITORIES
export const MAP_ENCODE_ALPHABET =
  '123456789ABCDEFGHIJKLMNPQRSTUWXYZabcdefghijklmnpqrstvwxyz@$%&*()';

// Pool sizes
export const MAX_PLAYERS = 7;
export const MAX_TERRITORIES = 64;
export const MAX_BOATS = 256;
export const MAX_LAKES = 256;
export const SQUARES_PER_TERRITORY_CAP = 99;
export const NATIVES_PLAYER_ID = 7;

// Grid
export const GRID_WIDTH = 40;
export const GRID_HEIGHT = 20;

// UI / pacing (used in Plan 4 — declared here for forward reference)
export const COMBAT_FLICKER_MS_PER_DIE = 50;
export const AI_THINK_PAUSE_MS = 1000;
