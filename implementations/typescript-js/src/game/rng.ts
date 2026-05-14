// Seedable PRNG. Single instance per game; cursor advances on every draw so
// (seed, cursor) → state is fully reproducible.
export type RngState = {
  seed: number;
  cursor: number;
};

export function createRng(seed: number): RngState {
  return { seed, cursor: 0 };
}

// Mulberry32: 32-bit state, fast, good distribution for game-scale needs.
function mulberry32(state: number): number {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextFloat(r: RngState): number {
  // Mix seed + cursor so independent (seed, cursor) pairs give independent draws
  const v = mulberry32((r.seed ^ Math.imul(r.cursor + 1, 0x85ebca6b)) >>> 0);
  r.cursor++;
  return v;
}

export function nextInt(r: RngState, exclusiveMax: number): number {
  if (exclusiveMax <= 0) return 0;
  return Math.floor(nextFloat(r) * exclusiveMax);
}

export function nextBool(r: RngState, probabilityTrue = 0.5): boolean {
  return nextFloat(r) < probabilityTrue;
}
