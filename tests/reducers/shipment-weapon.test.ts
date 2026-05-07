import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function adjPair(): { state: GameState; from: number; to: number } {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 31 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'shipment', currentPlayer: 0, shipmentUsed: false, shipmentForfeitsSecondAttack: false };
  let from = -1, to = -1;
  for (let a = 0; a < s.territories.length; a++) {
    for (let b = 0; b < s.territories.length; b++) {
      if (a === b) continue;
      if (s.territories[a]!.ownerId === 0 && s.territories[b]!.ownerId === 0 && s.touching[a]?.[b]) {
        from = a; to = b; break;
      }
    }
    if (from >= 0) break;
  }
  if (from < 0) throw new Error('No adjacent owned pair');
  s.territories[from]!.hasWeapon = true;
  return { state: s, from, to };
}

describe('shipWeapon', () => {
  it('moves weapon from source to adjacent destination', () => {
    const { state: s, from, to } = adjPair();
    const out = reduce(s, { kind: 'shipWeapon', player: 0, from, to });
    expect(out.territories[from]!.hasWeapon).toBe(false);
    expect(out.territories[to]!.hasWeapon).toBe(true);
    expect(out.shipmentUsed).toBe(true);
  });

  it('rejects when destination is not adjacent (no 2-hop allowed)', () => {
    const { state: s, from } = adjPair();
    const farTerr = s.territories.find((t, i) =>
      t.ownerId === 0 && i !== from && !s.touching[from]?.[i],
    );
    if (!farTerr) return;
    expect(() => reduce(s, { kind: 'shipWeapon', player: 0, from, to: farTerr.id }))
      .toThrow(/adjacent/i);
  });

  it('source loses weapon when destination already has one (no stacking)', () => {
    const { state: s, from, to } = adjPair();
    s.territories[to]!.hasWeapon = true;
    const out = reduce(s, { kind: 'shipWeapon', player: 0, from, to });
    expect(out.territories[from]!.hasWeapon).toBe(false);
    expect(out.territories[to]!.hasWeapon).toBe(true);
  });
});
