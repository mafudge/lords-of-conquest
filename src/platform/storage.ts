import type { GameState } from '../game/types.js';

export type StorageLike = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  key(i: number): string | null;
  readonly length: number;
};

export type SaveSlot = 'autosave' | 'slot1' | 'slot2' | 'slot3';
const ALL_SLOTS: ReadonlyArray<SaveSlot> = ['autosave', 'slot1', 'slot2', 'slot3'];
const PREFIX = 'loc:save:';

type Envelope = { schemaVersion: 1; savedAt: string; state: GameState };

export type LoadResult =
  | { kind: 'ok'; state: GameState; savedAt: string }
  | { kind: 'missing' }
  | { kind: 'schema-mismatch'; got: number }
  | { kind: 'parse-error'; message: string };

export function saveGameToStorage(s: StorageLike, slot: SaveSlot, state: GameState): void {
  const env: Envelope = {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    state,
  };
  s.setItem(PREFIX + slot, JSON.stringify(env));
}

export function loadGameFromStorage(s: StorageLike, slot: SaveSlot): LoadResult {
  const raw = s.getItem(PREFIX + slot);
  if (raw === null) return { kind: 'missing' };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch (e) { return { kind: 'parse-error', message: String((e as Error).message ?? e) }; }
  const env = parsed as Partial<Envelope>;
  if (env.schemaVersion !== 1) return { kind: 'schema-mismatch', got: Number(env.schemaVersion ?? -1) };
  if (!env.state) return { kind: 'parse-error', message: 'envelope missing state' };
  return { kind: 'ok', state: env.state as GameState, savedAt: String(env.savedAt) };
}

export function listSaveSlots(s: StorageLike): SaveSlot[] {
  return ALL_SLOTS.filter((slot) => s.getItem(PREFIX + slot) !== null);
}

export function deleteSaveSlot(s: StorageLike, slot: SaveSlot): void {
  s.removeItem(PREFIX + slot);
}
