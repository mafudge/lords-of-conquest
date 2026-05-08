import type { GameState } from '../../game/types.js';
import { dispatch } from '../main.js';
import { type InteractionMode, markCandidates, clearCandidates } from './interactionMode.js';

type Sub = 'none' | 'city' | 'weapon' | 'boat';
let sub: Sub = 'none';
let useGold = false;

export const developmentMode = {
  getSub(): string { return sub; },
  setSub(next: Sub, opts?: { useGold?: boolean }): void {
    sub = next; useGold = !!opts?.useGold;
  },

  enter(state: GameState): void { highlight(state); },

  handleClick(territoryId: number, state: GameState): void {
    if (sub === 'none') return;
    const t = state.territories[territoryId];
    if (!t || t.ownerId !== state.currentPlayer) return;
    if (sub === 'city' && t.hasCity) return;
    if (sub === 'weapon' && t.hasWeapon) return;
    if (sub === 'boat' && t.bordersLakes.size === 0) return;

    if (sub === 'city') {
      dispatch({ kind: 'buildCity', player: state.currentPlayer,
        territoryId, payInGold: useGold } as any);
    } else if (sub === 'weapon') {
      dispatch({ kind: 'buildWeapon', player: state.currentPlayer,
        territoryId, payInGold: useGold } as any);
    } else if (sub === 'boat') {
      const lakeId = [...t.bordersLakes][0]!;
      dispatch({ kind: 'buildBoat', player: state.currentPlayer,
        territoryId, lakeId, payInGold: useGold } as any);
    }
    sub = 'none'; useGold = false;
    clearCandidates();
  },

  exit(): void { sub = 'none'; useGold = false; clearCandidates(); },
} as InteractionMode & { getSub: () => string; setSub: (n: Sub, opts?: { useGold?: boolean }) => void };

function highlight(state: GameState): void {
  clearCandidates();
  const me = state.currentPlayer;
  const candidates = new Set<number>();
  state.territories.forEach((t, i) => {
    if (t.ownerId !== me) return;
    if (sub === 'city' && !t.hasCity) candidates.add(i);
    else if (sub === 'weapon' && !t.hasWeapon) candidates.add(i);
    else if (sub === 'boat' && t.bordersLakes.size > 0) candidates.add(i);
  });
  markCandidates(candidates, state);
}
