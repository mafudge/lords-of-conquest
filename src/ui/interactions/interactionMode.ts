import type { GameState } from '../../game/types.js';

export interface InteractionMode {
  enter(state: GameState): void;
  handleClick(territoryId: number, state: GameState): void;
  exit(): void;
}

let active: InteractionMode | null = null;

export function setMode(mode: InteractionMode | null): void {
  active?.exit();
  active = mode;
}

export function getMode(): InteractionMode | null { return active; }

export function clearCandidates(): void {
  document.querySelectorAll<SVGElement>('.board-svg .sq.candidate')
    .forEach((el) => el.classList.remove('candidate'));
}

export function markCandidates(territoryIds: Set<number>, state: GameState): void {
  clearCandidates();
  for (const tid of territoryIds) {
    const t = state.territories[tid];
    if (!t) continue;
    for (const sqIdx of t.squares) {
      const sq = state.squares[sqIdx];
      if (!sq) continue;
      const el = document.querySelector<SVGElement>(
        `.board-svg .sq[data-x="${sq.x}"][data-y="${sq.y}"]`,
      );
      el?.classList.add('candidate');
    }
  }
}
