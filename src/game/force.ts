import type { GameState } from './types.js';
import { NATIVES_PLAYER_ID } from './constants.js';

export type ForceCount = { perPlayer: number[] }; // length 8 (indices 0..6 + 7=natives)

// Mirrors LocApplet.getForceCount L2242-L2316. Uses the touching matrix
// stored on GameState (populated by mapgen).
export function getForceCount(state: GameState, terrId: number): ForceCount {
  const perPlayer = new Array<number>(8).fill(0);
  const touching = state.touching;

  const visit = (tid: number, isCenter: boolean) => {
    const t = state.territories[tid];
    if (!t) return;
    if (t.ownerId === null) {
      perPlayer[NATIVES_PLAYER_ID]! += 1;
      return;
    }
    let contribution = 1; // base
    if (t.hasHorse) contribution += 1;
    if (t.hasCity) contribution += 2;
    if (t.hasWeapon) contribution += 3;
    perPlayer[t.ownerId] += contribution;
    if (isCenter) {
      // Boats on the central tile only
      const boats = state.boats.filter((b) => b !== null && b.homeTerritoryId === tid && b.ownerId === t.ownerId);
      perPlayer[t.ownerId] += 2 * boats.length;
    }
  };

  visit(terrId, true);
  for (let i = 0; i < state.territories.length; i++) {
    if (i !== terrId && touching[terrId]?.[i]) visit(i, false);
  }
  return { perPlayer };
}
