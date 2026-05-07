import type { GameState, Territory } from './types.js';
import { Code } from './codes.js';

// Mirrors LocApplet L2019-L2055. Stable (code 4) is excluded; codes 0-3 (Iron, Coal,
// Tree, Gold) all qualify for doubling.
export function recomputeResourceDoubles(state: GameState): GameState {
  const newTerritories: Territory[] = state.territories.map((t) => ({ ...t }));
  for (const t of newTerritories) {
    t.hasResourceDouble = computeDouble(state, newTerritories, t);
  }
  return { ...state, territories: newTerritories };
}

function computeDouble(state: GameState, terrs: Territory[], t: Territory): boolean {
  if (t.resource === null) return false;
  if (t.resource === Code.STABLE) return false;
  if (t.ownerId === null) return false;
  // Same-tile city
  if (t.hasCity) return true;
  // Adjacent friendly city
  for (let i = 0; i < terrs.length; i++) {
    if (i === t.id) continue;
    if (!state.touching[t.id]?.[i]) continue;
    const other = terrs[i]!;
    if (other.ownerId === t.ownerId && other.hasCity) return true;
  }
  return false;
}
