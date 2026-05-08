import type { GameState } from '../../game/types.js';
import { dispatch } from '../main.js';
import { type InteractionMode, markCandidates, clearCandidates } from './interactionMode.js';
import { openCombatPreview } from '../overlays/combatPreview.js';

type Sub = 'target' | 'preview';
let sub: Sub = 'target';
let pendingTarget: number | null = null;

export const conquestMode = {
  getSub(): string { return sub; },

  enter(state: GameState): void {
    sub = 'target';
    pendingTarget = null;
    highlightTargets(state);
  },

  handleClick(territoryId: number, state: GameState): void {
    if (sub !== 'target') return;
    const t = state.territories[territoryId];
    if (!t) return;
    if (t.ownerId === state.currentPlayer) return;
    const fromIdx = state.territories.findIndex((own, i) =>
      own.ownerId === state.currentPlayer && state.touching[i]?.[territoryId]);
    if (fromIdx < 0) return;
    pendingTarget = territoryId;
    sub = 'preview';
    openCombatPreview({
      attackerId: state.currentPlayer, defenderId: t.ownerId,
      fromTerritoryId: fromIdx, targetTerritoryId: territoryId,
      onAttack: () => {
        dispatch({ kind: 'attack', player: state.currentPlayer,
          fromTerritoryId: fromIdx, targetTerritoryId: territoryId,
          boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
        } as any);
        sub = 'target'; pendingTarget = null;
        highlightTargets(state);
      },
      onCancel: () => { sub = 'target'; pendingTarget = null; highlightTargets(state); },
    });
  },

  exit(): void { sub = 'target'; pendingTarget = null; clearCandidates(); },
} as InteractionMode & { getSub: () => string };

function highlightTargets(state: GameState): void {
  clearCandidates();
  const me = state.currentPlayer;
  const candidates = new Set<number>();
  state.territories.forEach((t, i) => {
    if (t.ownerId === me) return;
    for (let s = 0; s < state.territories.length; s++) {
      if (state.territories[s]?.ownerId === me && state.touching[s]?.[i]) {
        candidates.add(i); break;
      }
    }
  });
  markCandidates(candidates, state);
}
