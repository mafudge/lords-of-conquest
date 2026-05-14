import type { GameState, CombatState, PlayerId, ElementOfChance } from './types.js';
import { getForceCount } from './force.js';

export type CombatStrength = { attackerStrength: number; defenderStrength: number };

export function getCombatStrength(state: GameState, c: CombatState): CombatStrength {
  const fc = getForceCount(state, c.targetTerritoryId);
  let attackerStrength = fc.perPlayer[c.attackerId] ?? 0;
  let defenderStrength = c.defenderId !== null ? (fc.perPlayer[c.defenderId] ?? 0) : 0;
  for (let p = 0; p < state.players.length; p++) {
    if (p === c.attackerId) continue;
    if (c.defenderId !== null && p === c.defenderId) continue;
    const decision = c.alliesDecisions[p];
    const force = fc.perPlayer[p] ?? 0;
    if (decision === 'attacker') attackerStrength += force;
    else if (decision === 'defender') defenderStrength += force;
  }
  return { attackerStrength, defenderStrength };
}

export function listAllyCandidates(
  state: GameState,
  attackerId: PlayerId,
  defenderId: PlayerId | null,
  targetTerritoryId: number,
): Set<PlayerId> {
  const fc = getForceCount(state, targetTerritoryId);
  const out = new Set<PlayerId>();
  for (let p = 0; p < state.players.length; p++) {
    if (p === attackerId) continue;
    if (defenderId !== null && p === defenderId) continue;
    if (state.players[p]!.status !== 'playing') continue;
    if ((fc.perPlayer[p] ?? 0) > 0) out.add(p as PlayerId);
  }
  return out;
}

export function isAutoPreventSuicide(
  chance: ElementOfChance,
  attackerStrength: number,
  defenderStrength: number,
): boolean {
  if (chance === 'high') return false;
  return attackerStrength + 6 < defenderStrength;
}
