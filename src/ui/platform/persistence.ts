import type { GameState } from '../../game/types.js';

export function serializeState(s: GameState): string {
  // Replace Set instances with arrays before stringifying.
  const replacer = (_k: string, v: unknown): unknown =>
    v instanceof Set ? { __set: [...v] } : v;
  return JSON.stringify(s, replacer);
}

export function deserializeState(json: string): GameState {
  const reviver = (_k: string, v: unknown): unknown => {
    if (v && typeof v === 'object' && '__set' in v && Array.isArray((v as any).__set)) {
      return new Set((v as any).__set as number[]);
    }
    return v;
  };
  return JSON.parse(json, reviver) as GameState;
}
