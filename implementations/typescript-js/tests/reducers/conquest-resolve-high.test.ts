import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import { probSuccess } from '../../src/game/locProb.js';
import type { GameState, GameSetup, CombatState, PlayerId } from '../../src/game/types.js';

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

function withCombat(att: number, def: number, seed: number): GameState | null {
  let s = reduce(initial(), { kind: 'newGame', setup, seed });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'conquest', currentPlayer: 0, attackNumber: 1 };
  const targetT = s.territories.find((t) => t.ownerId === 1);
  if (!targetT) return null;
  const target = targetT.id;
  const fromT = s.territories.find((t) => t.ownerId === 0 && s.touching[t.id]?.[target]);
  if (!fromT) return null;
  const from = fromT.id;
  const c: CombatState = {
    attackerId: 0, defenderId: 1,
    fromTerritoryId: from, targetTerritoryId: target,
    boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    alliesDecisions: ['neutral', 'neutral'],
    alliesPending: new Set<PlayerId>(),
    attackerStrength: att, defenderStrength: def,
    resolved: false, attackerWon: false,
  };
  return { ...s, pendingCombat: c };
}

describe('applyResolveCombat (High)', () => {
  it('always wins when defender starts at 0', () => {
    const s = withCombat(5, 0, 42)!;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(true);
  });

  it('never wins when attacker starts at 0', () => {
    const s = withCombat(0, 5, 42)!;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(false);
  });

  it('Monte-Carlo win-rate over many seeds approximates probSuccess', () => {
    const att = 5, def = 5;
    const trialsTarget = 400;
    let wins = 0;
    let completed = 0;
    for (let seed = 0; completed < trialsTarget; seed++) {
      const s = withCombat(att, def, seed * 31 + 1);
      if (s === null) continue; // skip seeds without adjacent pair
      const out = reduce(s, { kind: 'resolveCombat' });
      if (out.pendingCombat!.attackerWon) wins++;
      completed++;
    }
    const empirical = wins / trialsTarget;
    const expected = probSuccess(att, def);
    expect(Math.abs(empirical - expected)).toBeLessThan(0.08);
  });

  it('rngCursor advances by exactly the number of coin flips taken', () => {
    const s = withCombat(3, 3, 99)!;
    const out = reduce(s, { kind: 'resolveCombat' });
    const flipsTaken = out.rngCursor - s.rngCursor;
    expect(flipsTaken).toBeGreaterThanOrEqual(3);
    expect(flipsTaken).toBeLessThanOrEqual(5);
  });
});
