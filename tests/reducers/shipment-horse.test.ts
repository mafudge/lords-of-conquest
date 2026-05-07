import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, Stockpile } from '../../src/game/types.js';

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
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function shipmentPhaseWithAdjacentOwned(): { state: GameState; from: number; to: number } {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 29 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'shipment', currentPlayer: 0, shipmentUsed: false, shipmentForfeitsSecondAttack: [] };
  let from = -1, to = -1;
  for (let a = 0; a < s.territories.length; a++) {
    for (let b = 0; b < s.territories.length; b++) {
      if (a === b) continue;
      if (s.territories[a]!.ownerId !== 0 || s.territories[b]!.ownerId !== 0) continue;
      if (s.touching[a]?.[b]) { from = a; to = b; break; }
    }
    if (from >= 0) break;
  }
  if (from < 0) throw new Error('No adjacent owned pair found');
  s.territories[from]!.hasHorse = true;
  s.territories[to]!.hasHorse = false;
  return { state: s, from, to };
}

describe('shipHorse 1 hop', () => {
  it('moves horse from source to adjacent destination', () => {
    const { state: s, from, to } = shipmentPhaseWithAdjacentOwned();
    const out = reduce(s, { kind: 'shipHorse', player: 0, from, to });
    expect(out.territories[from]!.hasHorse).toBe(false);
    expect(out.territories[to]!.hasHorse).toBe(true);
    expect(out.shipmentUsed).toBe(true);
  });

  it('rejects when source has no horse', () => {
    const { state: s, from, to } = shipmentPhaseWithAdjacentOwned();
    s.territories[from]!.hasHorse = false;
    expect(() => reduce(s, { kind: 'shipHorse', player: 0, from, to }))
      .toThrow(/no horse/i);
  });

  it('rejects when destination is not adjacent and not 2-hop with intermediate', () => {
    const { state: s, from } = shipmentPhaseWithAdjacentOwned();
    const far = s.territories.find((t, i) =>
      t.ownerId === 0 && i !== from && !s.touching[from]?.[i]
        && !s.territories.some((m, mi) => m.ownerId === 0 && s.touching[from]?.[mi] && s.touching[mi]?.[i]),
    );
    if (!far) return;
    expect(() => reduce(s, { kind: 'shipHorse', player: 0, from, to: far.id }))
      .toThrow(/distance|adjacent/i);
  });

  it('decrements stockpile slot 4 if destination already has a horse', () => {
    const { state: s, from, to } = shipmentPhaseWithAdjacentOwned();
    s.territories[to]!.hasHorse = true;
    s.players[0]!.stockpile = [0, 0, 0, 0, 1] as Stockpile;
    const out = reduce(s, { kind: 'shipHorse', player: 0, from, to });
    expect(out.territories[from]!.hasHorse).toBe(false);
    expect(out.territories[to]!.hasHorse).toBe(true);
    expect(out.players[0]!.stockpile[4]).toBe(0);
  });
});

describe('shipHorse 2 hop', () => {
  it('moves horse 2 hops via an owned intermediate', () => {
    const { state: s, from } = shipmentPhaseWithAdjacentOwned();
    let restStop = -1, to = -1;
    for (let i = 0; i < s.territories.length; i++) {
      if (s.territories[i]!.ownerId !== 0 || i === from) continue;
      if (!s.touching[from]?.[i]) continue;
      for (let j = 0; j < s.territories.length; j++) {
        if (j === from || j === i) continue;
        if (s.territories[j]!.ownerId !== 0) continue;
        if (!s.touching[i]?.[j]) continue;
        if (s.touching[from]?.[j]) continue;
        restStop = i; to = j; break;
      }
      if (restStop >= 0) break;
    }
    if (restStop < 0) return;
    s.territories[from]!.hasHorse = true;
    s.territories[to]!.hasHorse = false;
    const out = reduce(s, { kind: 'shipHorse', player: 0, from, to, restStop });
    expect(out.territories[from]!.hasHorse).toBe(false);
    expect(out.territories[to]!.hasHorse).toBe(true);
    expect(out.territories[restStop]!.hasHorse).toBe(false);
  });

  it('rejects when rest-stop is not owned', () => {
    const { state: s, from } = shipmentPhaseWithAdjacentOwned();
    let restStop = -1, to = -1;
    for (let i = 0; i < s.territories.length; i++) {
      if (i === from) continue;
      if (!s.touching[from]?.[i]) continue;
      if (s.territories[i]!.ownerId === 0) continue;
      for (let j = 0; j < s.territories.length; j++) {
        if (j === from || j === i) continue;
        if (s.territories[j]!.ownerId !== 0) continue;
        if (!s.touching[i]?.[j]) continue;
        if (s.touching[from]?.[j]) continue;
        restStop = i; to = j; break;
      }
      if (restStop >= 0) break;
    }
    if (restStop < 0) return;
    s.territories[from]!.hasHorse = true;
    expect(() => reduce(s, { kind: 'shipHorse', player: 0, from, to, restStop }))
      .toThrow(/rest.?stop|owned/i);
  });
});

describe('shipHorse: deferred features', () => {
  it('throws when pickUpWeaponFrom is provided', () => {
    const { state: s, from, to } = shipmentPhaseWithAdjacentOwned();
    expect(() => reduce(s, { kind: 'shipHorse', player: 0, from, to, pickUpWeaponFrom: 5 }))
      .toThrow(/not implemented/i);
  });
});
