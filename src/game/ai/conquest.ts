import type { GameState, PlayerId, CombatState } from '../types.js';
import type { Plan } from '../plans.js';
import { ptRatingsBoundary } from '../aiConstants.js';
import { isPassive, isDefensive } from './personas.js';
import { getPowerRatingForPl } from './powerRating.js';
import { getBFPossible } from './bfPossible.js';
import { getConquestUtility } from './scoring/conquestUtility.js';
import { getCombatStrength, isAutoPreventSuicide } from '../combat.js';

export function decideConquestAction(state: GameState, player: PlayerId): Plan {
  if (isPassive(state, player)) return { kind: 'endPhase', player };
  const isDef = isDefensive(state, player);

  const candidates = enumerateAttackPlans(state, player);
  if (candidates.length === 0) return { kind: 'endPhase', player };

  const bfPossible = getBFPossible(state, player);
  const alliesMatrix = buildAlliesMatrix(state, player);

  let bestPlan: Plan | null = null;
  let bestUtility = 0;

  for (const candidate of candidates) {
    if (candidate.kind !== 'attack') continue;

    const target = state.territories[candidate.targetTerritoryId]!;

    // Convert alliesMatrix row from number (0/1/2) to string decisions
    const matrixRow = alliesMatrix[candidate.targetTerritoryId] ?? [];
    const alliesDecisions: Array<'attacker' | 'neutral' | 'defender'> =
      state.players.map((_, p) => {
        const v = matrixRow[p] ?? 1;
        return v === 0 ? 'attacker' : v === 2 ? 'defender' : 'neutral';
      });

    const synthCombat: CombatState = {
      attackerId: player,
      defenderId: target.ownerId,
      fromTerritoryId: candidate.fromTerritoryId,
      targetTerritoryId: candidate.targetTerritoryId,
      boatId: candidate.boatId,
      horseFromTerritoryId: candidate.horseFromTerritoryId,
      weaponFromTerritoryId: candidate.weaponFromTerritoryId,
      alliesDecisions,
      alliesPending: new Set<PlayerId>(),
      attackerStrength: 0,
      defenderStrength: 0,
      resolved: false,
      attackerWon: false,
    };

    const { attackerStrength, defenderStrength } = getCombatStrength(state, synthCombat);
    synthCombat.attackerStrength = attackerStrength;
    synthCombat.defenderStrength = defenderStrength;

    if (isAutoPreventSuicide(
      state.setup.elementOfChance,
      attackerStrength,
      defenderStrength,
    )) continue;

    if (isDef) {
      const cityBlock = checkCityBlockScenario(state, candidate);
      if (attackerStrength <= defenderStrength && !cityBlock) continue;
    }

    const u = getConquestUtility(state, player, synthCombat, bfPossible, alliesMatrix);
    if (u > bestUtility) {
      bestUtility = u;
      bestPlan = candidate;
    }
  }

  return bestPlan ?? { kind: 'endPhase', player };
}

function enumerateAttackPlans(state: GameState, player: PlayerId): Plan[] {
  const plans: Plan[] = [];

  for (const from of state.territories) {
    if (from.ownerId !== player) continue;

    for (const target of state.territories) {
      if (target.id === from.id) continue;
      if (target.ownerId === player) continue;
      if (!(state.touching[from.id]?.[target.id] ?? false)) continue;

      // Plain attack
      plans.push({
        kind: 'attack', player,
        fromTerritoryId: from.id,
        targetTerritoryId: target.id,
        boatId: null,
        horseFromTerritoryId: null,
        weaponFromTerritoryId: null,
      });

      // With horse from owned territory within 2 hops via owned chain
      for (const horseSrc of state.territories) {
        if (horseSrc.ownerId !== player || !horseSrc.hasHorse) continue;
        if (horseSrc.id === from.id) continue;
        if (!isOwnedChainTwoHops(state, horseSrc.id, target.id, player)) continue;

        plans.push({
          kind: 'attack', player,
          fromTerritoryId: from.id,
          targetTerritoryId: target.id,
          boatId: null,
          horseFromTerritoryId: horseSrc.id,
          weaponFromTerritoryId: null,
        });

        // Combination: horse + weapon
        for (const weaponSrc of state.territories) {
          if (weaponSrc.ownerId !== player || !weaponSrc.hasWeapon) continue;
          if (!(state.touching[weaponSrc.id]?.[target.id] ?? false)) continue;
          plans.push({
            kind: 'attack', player,
            fromTerritoryId: from.id,
            targetTerritoryId: target.id,
            boatId: null,
            horseFromTerritoryId: horseSrc.id,
            weaponFromTerritoryId: weaponSrc.id,
          });
        }
      }

      // Weapon only
      for (const weaponSrc of state.territories) {
        if (weaponSrc.ownerId !== player || !weaponSrc.hasWeapon) continue;
        if (!(state.touching[weaponSrc.id]?.[target.id] ?? false)) continue;
        plans.push({
          kind: 'attack', player,
          fromTerritoryId: from.id,
          targetTerritoryId: target.id,
          boatId: null,
          horseFromTerritoryId: null,
          weaponFromTerritoryId: weaponSrc.id,
        });
      }
    }
  }

  // Boat-launched attacks
  for (let bi = 0; bi < state.boats.length; bi++) {
    const boat = state.boats[bi];
    if (!boat || boat.ownerId !== player) continue;
    const dock = state.territories[boat.homeTerritoryId];
    if (!dock) continue;

    for (const target of state.territories) {
      if (target.ownerId === player) continue;
      if (!(state.touching[dock.id]?.[target.id] ?? false)) continue;

      let lakeMatch = false;
      for (const lk of dock.bordersLakes) {
        if (target.bordersLakes.has(lk)) { lakeMatch = true; break; }
      }
      if (!lakeMatch) continue;

      plans.push({
        kind: 'attack', player,
        fromTerritoryId: dock.id,
        targetTerritoryId: target.id,
        boatId: bi,
        horseFromTerritoryId: null,
        weaponFromTerritoryId: null,
      });
    }
  }

  return plans;
}

function isOwnedChainTwoHops(
  state: GameState,
  src: number,
  dst: number,
  owner: PlayerId,
): boolean {
  if (state.territories[src]?.ownerId !== owner) return false;
  if (src === dst) return false;
  if (state.touching[src]?.[dst] ?? false) return true;
  for (let m = 0; m < state.territories.length; m++) {
    if (m === src || m === dst) continue;
    if (state.territories[m]?.ownerId !== owner) continue;
    if ((state.touching[src]?.[m] ?? false) && (state.touching[m]?.[dst] ?? false)) return true;
  }
  return false;
}

function buildAlliesMatrix(state: GameState, attackerId: PlayerId): number[][] {
  const n = state.territories.length;
  // matrix[t][p]: 0=siding with attacker, 1=neutral, 2=siding with defender
  const matrix: number[][] = Array.from({ length: n }, () =>
    new Array<number>(7).fill(1),
  );

  for (let t = 0; t < n; t++) {
    const target = state.territories[t]!;
    if (target.ownerId === attackerId) continue;

    const synthCombat: CombatState = {
      attackerId,
      defenderId: target.ownerId,
      fromTerritoryId: -1,
      targetTerritoryId: t,
      boatId: null,
      horseFromTerritoryId: null,
      weaponFromTerritoryId: null,
      alliesDecisions: [],
      alliesPending: new Set(),
      attackerStrength: 0,
      defenderStrength: 0,
      resolved: false,
      attackerWon: false,
    };

    for (let p = 0; p < state.players.length; p++) {
      if (p === attackerId) {
        matrix[t]![p] = 0; // attacker always sides with themselves
        continue;
      }
      if (target.ownerId !== null && p === target.ownerId) {
        matrix[t]![p] = 2; // defender always sides with themselves
        continue;
      }
      const choice = decideAlliesAction(state, p as PlayerId, synthCombat);
      matrix[t]![p] = choice === 'attacker' ? 0 : choice === 'defender' ? 2 : 1;
    }
  }

  return matrix;
}

function checkCityBlockScenario(
  state: GameState,
  plan: Extract<Plan, { kind: 'attack' }>,
): boolean {
  const target = state.territories[plan.targetTerritoryId]!;
  if (target.ownerId === null) return false;
  const defenderCities = state.territories.filter(
    (t) => t.ownerId === target.ownerId && t.hasCity,
  ).length;
  return defenderCities >= state.setup.citiesToWin - 1 && target.hasCity;
}

export function decideAlliesAction(
  state: GameState,
  player: PlayerId,
  combat: CombatState,
): 'attacker' | 'neutral' | 'defender' {
  if (isPassive(state, player)) return 'neutral';
  if (combat.defenderId === null) return 'neutral';

  const attackerCities = state.territories.filter(
    (t) => t.ownerId === combat.attackerId && t.hasCity).length;
  const targetT = state.territories[combat.targetTerritoryId]!;
  const cityCountIfWin = attackerCities + (targetT.hasCity ? 1 : 0);
  if (cityCountIfWin >= state.setup.citiesToWin) {
    return 'defender';
  }

  const attackerRating = getPowerRatingForPl(state, combat.attackerId, undefined);
  const defenderRating = getPowerRatingForPl(state, combat.defenderId, undefined);
  if (attackerRating > defenderRating + ptRatingsBoundary) return 'defender';
  if (defenderRating > attackerRating + ptRatingsBoundary) return 'attacker';
  return 'neutral';
}
