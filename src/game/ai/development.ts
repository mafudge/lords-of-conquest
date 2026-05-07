import type { GameState, PlayerId } from '../types.js';
import type { Plan } from '../plans.js';
import { isPassive } from './personas.js';
import { getBFPossible } from './bfPossible.js';
import { getDevelopmentUtility, type DevelopmentBundle } from './scoring/developmentUtility.js';

export function decideDevelopmentAction(state: GameState, player: PlayerId): Plan {
  if (isPassive(state, player)) {
    return { kind: 'endPhase', player };
  }
  const bfPossible = getBFPossible(state, player);

  let bestPlan: Plan | null = null;
  let bestUtility = 0; // strictly positive utility required (per LocAI)

  for (const t of state.territories) {
    if (t.ownerId !== player) continue;
    for (const candidate of enumerateBuilds(state, player, t.id)) {
      const u = getDevelopmentUtility(state, player, candidate.bundle, bfPossible);
      if (u > bestUtility) {
        bestUtility = u;
        bestPlan = candidate.plan;
      }
    }
  }

  if (bestPlan === null) {
    return { kind: 'endPhase', player };
  }
  return bestPlan;
}

type Candidate = { bundle: DevelopmentBundle; plan: Plan };

function enumerateBuilds(state: GameState, player: PlayerId, territoryId: number): Candidate[] {
  const t = state.territories[territoryId]!;
  const stock = state.players[player]!.stockpile;
  const out: Candidate[] = [];

  // City: 1 each iron/coal/tree/gold OR 4 gold; max 1 per territory
  if (!t.hasCity) {
    if (stock[0] >= 1 && stock[1] >= 1 && stock[2] >= 1 && stock[3] >= 1) {
      out.push({
        bundle: { territoryId, builds: [{ kind: 'city', payInGold: false }] },
        plan: { kind: 'buildCity', player, territoryId, payInGold: false },
      });
    }
    if (stock[3] >= 4) {
      out.push({
        bundle: { territoryId, builds: [{ kind: 'city', payInGold: true }] },
        plan: { kind: 'buildCity', player, territoryId, payInGold: true },
      });
    }
  }

  // Weapon: 1 iron + 1 coal OR 2 gold; max 1 per territory
  if (!t.hasWeapon) {
    if (stock[0] >= 1 && stock[1] >= 1) {
      out.push({
        bundle: { territoryId, builds: [{ kind: 'weapon', payInGold: false }] },
        plan: { kind: 'buildWeapon', player, territoryId, payInGold: false },
      });
    }
    if (stock[3] >= 2) {
      out.push({
        bundle: { territoryId, builds: [{ kind: 'weapon', payInGold: true }] },
        plan: { kind: 'buildWeapon', player, territoryId, payInGold: true },
      });
    }
  }

  // Boat: 3 trees OR 3 gold; coastal only; one bundle per lake
  if (t.bordersLakes.size > 0) {
    for (const lakeId of t.bordersLakes) {
      if (stock[2] >= 3) {
        out.push({
          bundle: { territoryId, builds: [{ kind: 'boat', lakeId, payInGold: false }] },
          plan: { kind: 'buildBoat', player, territoryId, lakeId, payInGold: false },
        });
      }
      if (stock[3] >= 3) {
        out.push({
          bundle: { territoryId, builds: [{ kind: 'boat', lakeId, payInGold: true }] },
          plan: { kind: 'buildBoat', player, territoryId, lakeId, payInGold: true },
        });
      }
    }
  }

  return out;
}
