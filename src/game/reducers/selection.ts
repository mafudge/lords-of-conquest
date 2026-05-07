import type { GameState, PlayerId } from '../types.js';

export function applySelection(
  prev: GameState,
  player: PlayerId,
  territoryId: number,
): GameState {
  if (prev.currentPhase !== 'selection') {
    throw new Error(`Selection plan illegal during ${prev.currentPhase} phase`);
  }
  if (player !== prev.currentPlayer) {
    throw new Error(`Selection by player ${player} but current player is ${prev.currentPlayer}`);
  }
  const t = prev.territories[territoryId];
  if (!t) throw new Error(`No territory ${territoryId}`);
  if (t.ownerId !== null) throw new Error(`Territory ${territoryId} is not unowned`);

  const territories = prev.territories.map((tt) =>
    tt.id === territoryId ? { ...tt, ownerId: player } : tt
  );

  // Advance current player within turnOrder
  const idx = prev.turnOrder.indexOf(player);
  const nextPlayer = prev.turnOrder[(idx + 1) % prev.turnOrder.length]!;

  return {
    ...prev,
    territories,
    currentPlayer: nextPlayer,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'selection', player, message: `Selected territory ${territoryId}` },
    ],
  };
}
