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

const KEY_AUTOSAVE = 'loc:save:autosave';
const SCHEMA = 1;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function autosave(state: GameState): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const payload = {
      schemaVersion: SCHEMA,
      savedAt: new Date().toISOString(),
      state: JSON.parse(serializeState(state)),
    };
    try { localStorage.setItem(KEY_AUTOSAVE, JSON.stringify(payload)); } catch { /* quota */ }
  }, 500);
}

export function loadAutosave(): GameState | null {
  const raw = localStorage.getItem(KEY_AUTOSAVE);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw);
    if (payload.schemaVersion !== SCHEMA) return null;
    return deserializeState(JSON.stringify(payload.state));
  } catch { return null; }
}

export function clearAutosave(): void {
  localStorage.removeItem(KEY_AUTOSAVE);
}
