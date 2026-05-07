import { describe, it, expect } from 'vitest';
import { getCombatStrength } from '../src/game/combat.js';
import type { GameState, CombatState, Territory } from '../src/game/types.js';

function stateWithForce(perPlayerForces: Record<number, number>): GameState {
  const territories: Territory[] = [
    { id: 0, ownerId: null, resource: null, hasCity: false, hasWeapon: false,
      hasHorse: false, hasStockpile: false, hasResourceDouble: false,
      squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0 },
  ];
  let nextId = 1;
  const touching: boolean[][] = [[false]];
  for (const [pStr, force] of Object.entries(perPlayerForces)) {
    const p = Number(pStr);
    // Encode force as territory attributes so getForceCount decodes back to force:
    // base=1, +1=horse, +2=city, +3=weapon  (max 7)
    const hasHorse  = force === 2 || force === 5 || force === 7;
    const hasCity   = force === 3 || force === 6 || force === 7;
    const hasWeapon = force === 4 || force === 5 || force === 6 || force === 7;
    const t: Territory = {
      id: nextId, ownerId: p as 0 | 1 | 2 | 3 | 4 | 5 | 6, resource: null,
      hasCity, hasWeapon, hasHorse,
      hasStockpile: false, hasResourceDouble: false,
      squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
    };
    territories.push(t);
    for (const row of touching) row.push(false);
    touching.push(new Array<boolean>(touching[0]!.length).fill(false));
    touching[0]![nextId] = true;
    touching[nextId]![0] = true;
    nextId++;
  }
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: [
        { color: 'red', name: 'r', persona: 'human' },
        { color: 'blue', name: 'b', persona: 'human' },
        { color: 'cyan', name: 'c', persona: 'human' },
      ],
      citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories, touching, distance: [],
    boats: [], players: [
      { id: 0, name: 'r', color: 'red', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
      { id: 1, name: 'b', color: 'blue', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
      { id: 2, name: 'c', color: 'cyan', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
    ],
    turnOrder: [0, 1, 2], currentPhase: 'conquest', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  };
}

const baseCombat = (overrides: Partial<CombatState>): CombatState => ({
  attackerId: 0, defenderId: 1,
  fromTerritoryId: 0, targetTerritoryId: 0,
  boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
  alliesDecisions: [], alliesPending: new Set<number>(),
  attackerStrength: 0, defenderStrength: 0, resolved: false, attackerWon: false,
  ...overrides,
});

describe('getCombatStrength', () => {
  it('attacker and defender base from getForceCount', () => {
    const s = stateWithForce({ 0: 1, 1: 1 });
    const c = baseCombat({ attackerId: 0, defenderId: 1, targetTerritoryId: 0 });
    const r = getCombatStrength(s, c);
    expect(r.attackerStrength).toBe(1);
    expect(r.defenderStrength).toBe(1);
  });

  it('third-party ally-with-attacker adds to attacker', () => {
    const s = stateWithForce({ 0: 1, 1: 1, 2: 4 });
    const c = baseCombat({
      attackerId: 0, defenderId: 1, targetTerritoryId: 0,
      alliesDecisions: ['neutral', 'neutral', 'attacker'],
    });
    const r = getCombatStrength(s, c);
    expect(r.attackerStrength).toBe(5);
    expect(r.defenderStrength).toBe(1);
  });

  it('third-party ally-with-defender adds to defender', () => {
    const s = stateWithForce({ 0: 1, 1: 1, 2: 3 });
    const c = baseCombat({
      attackerId: 0, defenderId: 1, targetTerritoryId: 0,
      alliesDecisions: ['neutral', 'neutral', 'defender'],
    });
    const r = getCombatStrength(s, c);
    expect(r.attackerStrength).toBe(1);
    expect(r.defenderStrength).toBe(4);
  });

  it('third-party neutral contributes to neither', () => {
    const s = stateWithForce({ 0: 1, 1: 1, 2: 3 });
    const c = baseCombat({
      attackerId: 0, defenderId: 1, targetTerritoryId: 0,
      alliesDecisions: ['neutral', 'neutral', 'neutral'],
    });
    const r = getCombatStrength(s, c);
    expect(r.attackerStrength).toBe(1);
    expect(r.defenderStrength).toBe(1);
  });

  it('attacker/defender entries in alliesDecisions are ignored', () => {
    const s = stateWithForce({ 0: 1, 1: 1 });
    const c = baseCombat({
      attackerId: 0, defenderId: 1, targetTerritoryId: 0,
      alliesDecisions: ['defender', 'attacker'],
    });
    const r = getCombatStrength(s, c);
    expect(r.attackerStrength).toBe(1);
    expect(r.defenderStrength).toBe(1);
  });
});
