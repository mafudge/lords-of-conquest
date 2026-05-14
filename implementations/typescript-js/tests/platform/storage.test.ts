import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveGameToStorage, loadGameFromStorage, listSaveSlots, deleteSaveSlot,
  type StorageLike,
} from '../../src/platform/storage.js';
import type { GameState } from '../../src/game/types.js';

class MemStorage implements StorageLike {
  private data = new Map<string, string>();
  getItem(k: string): string | null { return this.data.get(k) ?? null; }
  setItem(k: string, v: string): void { this.data.set(k, v); }
  removeItem(k: string): void { this.data.delete(k); }
  key(i: number): string | null {
    const arr = Array.from(this.data.keys()); return arr[i] ?? null;
  }
  get length(): number { return this.data.size; }
}

const sampleState = (year: number): GameState => ({
  schemaVersion: 1, seed: 1, rngCursor: 0,
  setup: {
    players: [
      { color: 'red', name: 'r', persona: 'human' },
      { color: 'blue', name: 'b', persona: 'human' },
    ],
    citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
    map: {
      waterBoundary: true, waterArea: 'small', numTerritories: 24,
      islands: 'some', shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    },
  },
  squares: [], territories: [], touching: [], distance: [], boats: [], players: [],
  turnOrder: [0, 1], currentPhase: 'selection', currentPlayer: 0,
  year, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [[false, false], [false, false]],
  log: [],
});

describe('storage', () => {
  let s: MemStorage;
  beforeEach(() => { s = new MemStorage(); });

  it('saves and loads a slot', () => {
    saveGameToStorage(s, 'autosave', sampleState(3));
    const loaded = loadGameFromStorage(s, 'autosave');
    expect(loaded.kind).toBe('ok');
    if (loaded.kind === 'ok') expect(loaded.state.year).toBe(3);
  });

  it('returns "missing" if slot absent', () => {
    const loaded = loadGameFromStorage(s, 'slot1');
    expect(loaded.kind).toBe('missing');
  });

  it('returns "schema-mismatch" on bad schemaVersion', () => {
    s.setItem('loc:save:slot1', JSON.stringify({
      schemaVersion: 999, savedAt: '2026-05-07T00:00:00Z', state: sampleState(1),
    }));
    const loaded = loadGameFromStorage(s, 'slot1');
    expect(loaded.kind).toBe('schema-mismatch');
  });

  it('returns "parse-error" on malformed JSON', () => {
    s.setItem('loc:save:slot1', '{not-json');
    const loaded = loadGameFromStorage(s, 'slot1');
    expect(loaded.kind).toBe('parse-error');
  });

  it('listSaveSlots returns occupied slot names', () => {
    saveGameToStorage(s, 'slot1', sampleState(1));
    saveGameToStorage(s, 'slot3', sampleState(2));
    expect(listSaveSlots(s).sort()).toEqual(['slot1', 'slot3']);
  });

  it('deleteSaveSlot removes a slot', () => {
    saveGameToStorage(s, 'slot1', sampleState(1));
    deleteSaveSlot(s, 'slot1');
    expect(loadGameFromStorage(s, 'slot1').kind).toBe('missing');
  });
});
