import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
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

function conquestPhaseAdjacentEnemies(): { state: GameState; from: number; target: number } {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 47 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'conquest', currentPlayer: 0,
    attackNumber: 1, pendingCombat: null };
  let from = -1, target = -1;
  for (let a = 0; a < s.territories.length; a++) {
    if (s.territories[a]!.ownerId !== 0) continue;
    for (let b = 0; b < s.territories.length; b++) {
      if (a === b) continue;
      if (s.territories[b]!.ownerId === 0) continue;
      if (s.touching[a]?.[b]) { from = a; target = b; break; }
    }
    if (from >= 0) break;
  }
  if (from < 0) throw new Error('No adjacent enemy pair');
  return { state: s, from, target };
}

describe('applyAttack', () => {
  it('populates pendingCombat with strengths and ally candidates', () => {
    const { state: s, from, target } = conquestPhaseAdjacentEnemies();
    const out = reduce(s, {
      kind: 'attack', player: 0, fromTerritoryId: from,
      targetTerritoryId: target,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    });
    expect(out.pendingCombat).not.toBeNull();
    expect(out.pendingCombat!.attackerId).toBe(0);
    expect(out.pendingCombat!.targetTerritoryId).toBe(target);
    expect(out.pendingCombat!.attackerStrength).toBeGreaterThan(0);
    expect(out.pendingCombat!.defenderStrength).toBeGreaterThan(0);
  });

  it('rejects when phase is not conquest', () => {
    const { state: s, from, target } = conquestPhaseAdjacentEnemies();
    const wrong = { ...s, currentPhase: 'production' as const };
    expect(() => reduce(wrong, {
      kind: 'attack', player: 0, fromTerritoryId: from, targetTerritoryId: target,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    })).toThrow(/phase/i);
  });

  it('rejects when from is not owned by player', () => {
    const { state: s, target } = conquestPhaseAdjacentEnemies();
    const enemyOwned = s.territories.find((t) => t.ownerId === 1)!;
    expect(() => reduce(s, {
      kind: 'attack', player: 0, fromTerritoryId: enemyOwned.id, targetTerritoryId: target,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    })).toThrow(/not owned/i);
  });

  it('rejects when target not adjacent to from', () => {
    const { state: s, from } = conquestPhaseAdjacentEnemies();
    const far = s.territories.find((t, i) =>
      i !== from && !s.touching[from]?.[i] && t.ownerId !== 0);
    if (!far) return;
    expect(() => reduce(s, {
      kind: 'attack', player: 0, fromTerritoryId: from, targetTerritoryId: far.id,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    })).toThrow(/adjacent/i);
  });

  it('rejects when pendingCombat is non-null', () => {
    const { state: s, from, target } = conquestPhaseAdjacentEnemies();
    const out = reduce(s, {
      kind: 'attack', player: 0, fromTerritoryId: from, targetTerritoryId: target,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    });
    expect(() => reduce(out, {
      kind: 'attack', player: 0, fromTerritoryId: from, targetTerritoryId: target,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    })).toThrow(/already pending|in.flight/i);
  });

  it('removes brought horse from source territory', () => {
    const { state: s, from, target } = conquestPhaseAdjacentEnemies();
    let horseSource = -1;
    for (let i = 0; i < s.territories.length; i++) {
      if (i === from || i === target) continue;
      if (s.territories[i]!.ownerId !== 0) continue;
      if (s.touching[i]?.[target]) continue;
      for (let m = 0; m < s.territories.length; m++) {
        if (m === i || m === target) continue;
        if (s.territories[m]!.ownerId !== 0) continue;
        if (s.touching[i]?.[m] && s.touching[m]?.[target]) {
          horseSource = i; break;
        }
      }
      if (horseSource >= 0) break;
    }
    if (horseSource < 0) return;
    s.territories[horseSource]!.hasHorse = true;
    const out = reduce(s, {
      kind: 'attack', player: 0, fromTerritoryId: from, targetTerritoryId: target,
      boatId: null, horseFromTerritoryId: horseSource, weaponFromTerritoryId: null,
    });
    expect(out.territories[horseSource]!.hasHorse).toBe(false);
    expect(out.pendingCombat!.horseFromTerritoryId).toBe(horseSource);
  });
});
