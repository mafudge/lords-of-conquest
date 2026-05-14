import type { GameState, PlayerId } from './types.js';

// Mirrors LocApplet.checkEndOfGame L3033-L3074. Returns winner's PlayerId, or null.
export function checkEndOfGame(state: GameState): PlayerId | null {
  const cities: number[] = new Array<number>(state.players.length).fill(0);
  for (const t of state.territories) {
    if (t.ownerId !== null && t.hasCity) cities[t.ownerId] = (cities[t.ownerId] ?? 0) + 1;
  }
  let winner: PlayerId | null = null;
  let maxCount = state.setup.citiesToWin - 1;
  for (let p = 0; p < cities.length; p++) {
    const c = cities[p]!;
    if (c > maxCount) { winner = p as PlayerId; maxCount = c; }
    else if (c === maxCount) { winner = null; }
  }
  if (winner !== null) return winner;
  // Fallback: all territories owned by same player
  const firstOwner = state.territories[0]?.ownerId;
  if (firstOwner === null || firstOwner === undefined) return null;
  for (const t of state.territories) {
    if (t.ownerId !== firstOwner) return null;
  }
  return firstOwner;
}
