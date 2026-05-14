import type { GameState, PlayerId } from '../types.js';

export function isPassive(state: GameState, player: PlayerId): boolean {
  return state.players[player]?.persona === 'passive';
}

export function isDefensive(state: GameState, player: PlayerId): boolean {
  return state.players[player]?.persona === 'defensive';
}

export function isAggressive(state: GameState, player: PlayerId): boolean {
  return state.players[player]?.persona === 'aggressive';
}
