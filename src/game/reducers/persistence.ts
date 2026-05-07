import type { GameState } from '../types.js';
import type { SaveSlot } from '../../platform/storage.js';

export function applySavegame(prev: GameState, slot: SaveSlot): GameState {
  return {
    ...prev,
    log: [
      ...prev.log,
      { year: prev.year, phase: prev.currentPhase, player: prev.currentPlayer,
        message: `Game saved to slot ${slot}` },
    ],
  };
}

export function applyLoadgame(_prev: GameState, loaded: GameState): GameState {
  if (loaded.schemaVersion !== 1) {
    throw new Error(`Cannot load: schema version ${loaded.schemaVersion} ≠ 1`);
  }
  return {
    ...loaded,
    log: [
      ...loaded.log,
      { year: loaded.year, phase: loaded.currentPhase, player: loaded.currentPlayer,
        message: 'Game loaded' },
    ],
  };
}
