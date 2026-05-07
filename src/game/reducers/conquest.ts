import type { GameState, PlayerId, Territory } from '../types.js';
import { getCombatStrength, listAllyCandidates, isAutoPreventSuicide } from '../combat.js';
import { nextFloat } from '../rng.js';
import { probSuccess } from '../locProb.js';
import { recomputeResourceDoubles } from '../activation.js';

export type AttackInput = {
  player: PlayerId;
  fromTerritoryId: number;
  targetTerritoryId: number;
  boatId: number | null;
  horseFromTerritoryId: number | null;
  weaponFromTerritoryId: number | null;
};

function isOwnedChainOneHop(
  state: GameState, src: number, dst: number, ownerId: PlayerId,
): boolean {
  return src !== dst && (state.touching[src]?.[dst] === true) && state.territories[src]?.ownerId === ownerId;
}

function isOwnedChainTwoHops(
  state: GameState, src: number, dst: number, ownerId: PlayerId,
): boolean {
  if (state.territories[src]?.ownerId !== ownerId) return false;
  if (src === dst) return false;
  if (state.touching[src]?.[dst]) return true;
  for (let m = 0; m < state.territories.length; m++) {
    if (m === src || m === dst) continue;
    if (state.territories[m]?.ownerId !== ownerId) continue;
    if (state.touching[src]?.[m] && state.touching[m]?.[dst]) return true;
  }
  return false;
}

export function applyAttack(prev: GameState, input: AttackInput): GameState {
  if (prev.currentPhase !== 'conquest') {
    throw new Error(`attack illegal during ${prev.currentPhase} phase`);
  }
  if (input.player !== prev.currentPlayer) {
    throw new Error(`attack by player ${input.player} but current is ${prev.currentPlayer}`);
  }
  if (prev.players[input.player]!.status !== 'playing') {
    throw new Error(`attack by non-playing player`);
  }
  if (prev.pendingCombat !== null) {
    throw new Error(`combat already pending in flight`);
  }
  const fromT = prev.territories[input.fromTerritoryId];
  const targetT = prev.territories[input.targetTerritoryId];
  if (!fromT || !targetT) throw new Error(`Invalid territory id`);
  if (fromT.ownerId !== input.player) throw new Error(`from territory not owned by player`);
  if (input.fromTerritoryId === input.targetTerritoryId) {
    throw new Error(`Cannot attack own territory`);
  }
  if (!prev.touching[input.fromTerritoryId]?.[input.targetTerritoryId]) {
    throw new Error(`Target not adjacent to from`);
  }
  if (targetT.ownerId === input.player) {
    throw new Error(`Cannot attack own territory`);
  }

  if (input.horseFromTerritoryId !== null) {
    const hs = prev.territories[input.horseFromTerritoryId];
    if (!hs) throw new Error(`Invalid horseFromTerritoryId`);
    if (hs.ownerId !== input.player) throw new Error(`Horse source not owned`);
    if (!hs.hasHorse) throw new Error(`Horse source has no horse`);
    if (!isOwnedChainTwoHops(prev, input.horseFromTerritoryId, input.targetTerritoryId, input.player)) {
      throw new Error(`Horse source not within 2 hops via owned chain`);
    }
  }
  if (input.weaponFromTerritoryId !== null) {
    const ws = prev.territories[input.weaponFromTerritoryId];
    if (!ws) throw new Error(`Invalid weaponFromTerritoryId`);
    if (ws.ownerId !== input.player) throw new Error(`Weapon source not owned`);
    if (!ws.hasWeapon) throw new Error(`Weapon source has no weapon`);
    if (!isOwnedChainOneHop(prev, input.weaponFromTerritoryId, input.targetTerritoryId, input.player)) {
      throw new Error(`Weapon source not adjacent to target`);
    }
  }
  if (input.boatId !== null) {
    const b = prev.boats[input.boatId];
    if (!b) throw new Error(`Invalid boatId`);
    if (b.ownerId !== input.player) throw new Error(`Boat not owned by player`);
    const dock = prev.territories[b.homeTerritoryId];
    if (!dock) throw new Error(`Boat dock invalid`);
    if (!prev.touching[b.homeTerritoryId]?.[input.targetTerritoryId]) {
      throw new Error(`Boat dock not adjacent to target`);
    }
    let lakeMatch = false;
    for (const lk of dock.bordersLakes) {
      if (targetT.bordersLakes.has(lk)) { lakeMatch = true; break; }
    }
    if (!lakeMatch) throw new Error(`Boat lake does not border target`);
  }

  let territories: Territory[] = prev.territories;
  if (input.horseFromTerritoryId !== null) {
    territories = territories.map((t) =>
      t.id === input.horseFromTerritoryId ? { ...t, hasHorse: false } : t);
  }
  if (input.weaponFromTerritoryId !== null) {
    territories = territories.map((t) =>
      t.id === input.weaponFromTerritoryId ? { ...t, hasWeapon: false } : t);
  }

  const numPlayers = prev.players.length;
  const allies = listAllyCandidates(prev, input.player, targetT.ownerId, input.targetTerritoryId);

  const partial: GameState['pendingCombat'] = {
    attackerId: input.player,
    defenderId: targetT.ownerId,
    fromTerritoryId: input.fromTerritoryId,
    targetTerritoryId: input.targetTerritoryId,
    boatId: input.boatId,
    horseFromTerritoryId: input.horseFromTerritoryId,
    weaponFromTerritoryId: input.weaponFromTerritoryId,
    alliesDecisions: new Array<'attacker' | 'neutral' | 'defender'>(numPlayers).fill('neutral'),
    alliesPending: allies,
    attackerStrength: 0,
    defenderStrength: 0,
    resolved: false,
    attackerWon: false,
  };
  const midState: GameState = { ...prev, territories, pendingCombat: partial };
  const { attackerStrength, defenderStrength } = getCombatStrength(midState, partial);
  let attBonus = 0;
  if (input.boatId !== null) attBonus += 2;
  if (input.horseFromTerritoryId !== null) {
    const adjAlready = prev.touching[input.horseFromTerritoryId]?.[input.targetTerritoryId];
    if (!adjAlready) attBonus += 1;
  }
  if (input.weaponFromTerritoryId !== null) {
    const adjAlready = prev.touching[input.weaponFromTerritoryId]?.[input.targetTerritoryId];
    if (!adjAlready) attBonus += 3;
  }
  const finalAttackerStrength = attackerStrength + attBonus;
  if (isAutoPreventSuicide(prev.setup.elementOfChance, finalAttackerStrength, defenderStrength)) {
    throw new Error(`Attack auto-prevented (suicide check at ${prev.setup.elementOfChance} chance)`);
  }
  return {
    ...midState,
    pendingCombat: { ...partial, attackerStrength: finalAttackerStrength, defenderStrength },
    log: [
      ...prev.log,
      { year: prev.year, phase: 'conquest', player: input.player,
        message: `Attack on territory ${input.targetTerritoryId} (att=${finalAttackerStrength}, def=${defenderStrength})` },
    ],
  };
}

function bringForcesBonus(prev: GameState, c: GameState['pendingCombat']): number {
  if (c === null) return 0;
  let b = 0;
  if (c.boatId !== null) b += 2;
  if (c.horseFromTerritoryId !== null
      && !prev.touching[c.horseFromTerritoryId]?.[c.targetTerritoryId]) b += 1;
  if (c.weaponFromTerritoryId !== null
      && !prev.touching[c.weaponFromTerritoryId]?.[c.targetTerritoryId]) b += 3;
  return b;
}

export function applyAlliesDecision(
  prev: GameState,
  player: PlayerId,
  choice: 'attacker' | 'neutral' | 'defender',
): GameState {
  if (prev.currentPhase !== 'conquest') {
    throw new Error(`alliesDecision illegal during ${prev.currentPhase} phase`);
  }
  const c = prev.pendingCombat;
  if (!c || c.resolved) {
    throw new Error(`No active combat for alliesDecision`);
  }
  if (!c.alliesPending.has(player)) {
    throw new Error(`Player ${player} is not a pending ally`);
  }
  const newDecisions = [...c.alliesDecisions];
  newDecisions[player] = choice;
  const newPending = new Set(c.alliesPending);
  newPending.delete(player);
  const updated: typeof c = { ...c, alliesDecisions: newDecisions, alliesPending: newPending };
  const { attackerStrength, defenderStrength } = getCombatStrength(prev, updated);
  const total = attackerStrength + bringForcesBonus(prev, updated);
  return {
    ...prev,
    pendingCombat: { ...updated, attackerStrength: total, defenderStrength },
    log: [
      ...prev.log,
      { year: prev.year, phase: 'conquest', player,
        message: `Allies decision: ${choice}` },
    ],
  };
}

export function applyResolveCombat(prev: GameState): GameState {
  if (prev.currentPhase !== 'conquest') {
    throw new Error(`resolveCombat illegal during ${prev.currentPhase} phase`);
  }
  const c = prev.pendingCombat;
  if (!c || c.resolved) throw new Error(`No active combat to resolve`);
  if (c.alliesPending.size > 0) {
    throw new Error(`Cannot resolve: ${c.alliesPending.size} allies still pending`);
  }
  const chance = prev.setup.elementOfChance;
  let attackerWon: boolean;
  let nextRngCursor = prev.rngCursor;
  if (chance === 'low') {
    attackerWon = c.attackerStrength >= c.defenderStrength;
  } else if (chance === 'medium') {
    if (c.attackerStrength > c.defenderStrength) attackerWon = true;
    else if (c.attackerStrength < c.defenderStrength) attackerWon = false;
    else {
      const rng = { seed: prev.seed, cursor: prev.rngCursor };
      attackerWon = nextFloat(rng) < 0.5;
      nextRngCursor = rng.cursor;
    }
  } else {
    const rng = { seed: prev.seed, cursor: prev.rngCursor };
    let att = c.attackerStrength;
    let def = c.defenderStrength;
    while (att > 0 && def > 0) {
      if (nextFloat(rng) < 0.5) att--;
      else def--;
    }
    attackerWon = def === 0;
    nextRngCursor = rng.cursor;
  }
  const probability = chance === 'high'
    ? probSuccess(c.attackerStrength, c.defenderStrength)
    : null;
  const probMsg = probability !== null
    ? ` (P(att-win)=${probability.toFixed(3)})`
    : '';

  if (attackerWon) {
    const intermediate: GameState = {
      ...prev, rngCursor: nextRngCursor,
      pendingCombat: { ...c, resolved: true, attackerWon },
    };
    return applyPostAttackWin(intermediate, c);
  }
  return {
    ...prev,
    rngCursor: nextRngCursor,
    pendingCombat: { ...c, resolved: true, attackerWon },
    log: [
      ...prev.log,
      { year: prev.year, phase: 'conquest', player: c.attackerId,
        message: `Combat resolved: attacker lost${probMsg}` },
    ],
  };
}

function applyPostAttackWin(state: GameState, c: NonNullable<GameState['pendingCombat']>): GameState {
  const attackerId = c.attackerId;
  const defenderId = c.defenderId;
  const targetT = state.territories[c.targetTerritoryId]!;
  const hadHorse = targetT.hasHorse;
  const hadWeapon = targetT.hasWeapon;
  const hadStockpile = targetT.hasStockpile;

  let territories = state.territories.map((t) => {
    if (t.id !== c.targetTerritoryId) return t;
    let next = { ...t, ownerId: attackerId };
    if (c.horseFromTerritoryId !== null && !hadHorse) next = { ...next, hasHorse: true };
    if (c.weaponFromTerritoryId !== null && !hadWeapon) next = { ...next, hasWeapon: true };
    if (hadStockpile) next = { ...next, hasStockpile: false };
    return next;
  });
  const boats = state.boats.map((b) =>
    b && b.homeTerritoryId === c.targetTerritoryId ? { ...b, ownerId: attackerId } : b);

  // Compute defender's captured stockpile (slots 0-3) before mutations
  const captured: [number, number, number, number] | null =
    (hadStockpile && defenderId !== null)
      ? [
          state.players[defenderId]!.stockpile[0],
          state.players[defenderId]!.stockpile[1],
          state.players[defenderId]!.stockpile[2],
          state.players[defenderId]!.stockpile[3],
        ]
      : null;

  let players = state.players.map((p) => {
    let stock: typeof p.stockpile | null = null;
    let stockpileLocation = p.stockpileLocation;
    if (hadHorse) {
      if (defenderId !== null && p.id === defenderId) {
        stock = stock ?? [...p.stockpile] as typeof p.stockpile;
        stock[4] = Math.max(0, stock[4] - 1);
      }
      if (p.id === attackerId && c.horseFromTerritoryId === null) {
        stock = stock ?? [...p.stockpile] as typeof p.stockpile;
        stock[4] = stock[4] + 1;
      }
    }
    if (captured !== null) {
      if (defenderId !== null && p.id === defenderId) {
        stock = stock ?? [...p.stockpile] as typeof p.stockpile;
        stock[0] = 0; stock[1] = 0; stock[2] = 0; stock[3] = 0;
        stockpileLocation = null;
      }
      if (p.id === attackerId) {
        stock = stock ?? [...p.stockpile] as typeof p.stockpile;
        for (let i = 0; i < 4; i++) stock[i] = stock[i]! + captured[i]!;
      }
    }
    return stock !== null
      ? { ...p, stockpile: stock, stockpileLocation }
      : p;
  });

  const swept = recomputeResourceDoubles({
    ...state, territories, boats, players,
  });
  return {
    ...swept,
    log: [
      ...state.log,
      { year: state.year, phase: 'conquest', player: attackerId,
        message: `Territory ${c.targetTerritoryId} captured` },
    ],
  };
}
