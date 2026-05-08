import type { GameState } from '../../game/types.js';
import { dispatch } from '../main.js';
import { type InteractionMode, markCandidates, clearCandidates } from './interactionMode.js';

export const selectionMode: InteractionMode = {
  enter(state: GameState): void {
    const candidates = new Set<number>();
    state.territories.forEach((t, idx) => {
      if (t.ownerId === null) candidates.add(idx);
    });
    markCandidates(candidates, state);
  },

  handleClick(territoryId: number, state: GameState): void {
    const t = state.territories[territoryId];
    if (!t || t.ownerId !== null) return;
    dispatch({ kind: 'selection', player: state.currentPlayer, territoryId });
  },

  exit(): void { clearCandidates(); },
};
