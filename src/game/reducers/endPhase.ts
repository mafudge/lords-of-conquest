import type { GameState, PlayerId } from '../types.js';

export function applyEndPhase(prev: GameState, _player: PlayerId): GameState {
  switch (prev.currentPhase) {
    case 'selection': {
      const unowned = prev.territories.filter((t) => t.ownerId === null);
      if (unowned.length > 0) {
        throw new Error(`Cannot end selection — ${unowned.length} unowned territories remain`);
      }
      const reversed: PlayerId[] = [...prev.turnOrder].reverse();
      return {
        ...prev,
        turnOrder: reversed,
        currentPhase: 'production',
        currentPlayer: reversed[0]!,
        log: [
          ...prev.log,
          { year: prev.year, phase: 'production', player: reversed[0]!,
            message: 'Selection complete — turn order reversed' },
        ],
      };
    }
    default:
      throw new Error(`endPhase from ${prev.currentPhase} is not implemented in plan 2 (Plan 3 territory)`);
  }
}
