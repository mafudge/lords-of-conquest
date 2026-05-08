import type { GameState } from '../../game/types.js';
import { dispatch } from '../main.js';
import { type InteractionMode, markCandidates, clearCandidates } from './interactionMode.js';

export const locateStockpileMode: InteractionMode = {
  enter(state: GameState): void {
    const me = state.currentPlayer;
    const candidates = new Set<number>();
    state.territories.forEach((t, i) => {
      if (t.ownerId === me) candidates.add(i);
    });
    markCandidates(candidates, state);
  },
  handleClick(territoryId: number, state: GameState): void {
    const t = state.territories[territoryId];
    if (!t || t.ownerId !== state.currentPlayer) return;
    dispatch({ kind: 'locateStockpile', territoryId } as any);
  },
  exit(): void { clearCandidates(); },
};
