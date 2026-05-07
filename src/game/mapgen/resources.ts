import type { Territory, ResourceDensity } from '../types.js';
import { Code, type ResourceCode, RESOURCE_CODES } from '../codes.js';
import { type RngState, nextInt } from '../rng.js';

const FIXED_LEVEL_OFFSET: Record<ResourceDensity['level'], number> = {
  veryLow: -2,
  low: -1,
  medium: 0,
  high: 1,
};

export function placeResourcesFixed(
  terrs: Territory[],
  level: ResourceDensity['level'],
  numPlayers: number,
  r: RngState,
): void {
  const baseCount = numPlayers + FIXED_LEVEL_OFFSET[level];
  if (baseCount < 1) throw new Error(`fixed-mode count would be < 1 for ${level} at ${numPlayers}P`);
  // Medium gets 1 extra Stable (LocApplet L3386: `n4==2 ? 1 : 0`).
  const stableBonus = level === 'medium' ? 1 : 0;
  const total = baseCount * 5 + stableBonus;
  if (total > terrs.length) {
    throw new Error(
      `not enough territories: need ${total} but have ${terrs.length}`,
    );
  }
  const free: Territory[] = terrs.filter((t) => t.resource === null);
  // Shuffle free in place via Fisher-Yates with our RNG
  for (let i = free.length - 1; i > 0; i--) {
    const j = nextInt(r, i + 1);
    [free[i], free[j]] = [free[j]!, free[i]!];
  }
  let cursor = 0;
  for (const code of RESOURCE_CODES) {
    const target = baseCount + (code === Code.STABLE ? stableBonus : 0);
    for (let k = 0; k < target; k++) {
      free[cursor++]!.resource = code;
    }
  }
}
