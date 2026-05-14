import type { GameState, Territory } from '../types.js';
import { PHASE_SKIP_PROBABILITY } from '../constants.js';
import { type RngState, nextFloat, nextInt } from '../rng.js';
import { pickReason } from '../reasons.js';

function addHorseAt(
  territories: Territory[],
  touching: boolean[][],
  startTerrId: number,
  ownerId: number,
  rng: RngState,
  visited: Set<number> = new Set(),
): boolean {
  if (visited.has(startTerrId)) return false;
  visited.add(startTerrId);
  const t = territories[startTerrId];
  if (!t) return false;
  if (t.ownerId !== ownerId) return false;
  if (!t.hasHorse) {
    territories[startTerrId] = { ...t, hasHorse: true };
    return true;
  }
  // Pick a random friendly neighbor that has no horse and recurse.
  const candidates: number[] = [];
  for (let i = 0; i < territories.length; i++) {
    if (i === startTerrId) continue;
    if (!touching[startTerrId]?.[i]) continue;
    if (territories[i]!.ownerId !== ownerId) continue;
    if (visited.has(i)) continue;
    candidates.push(i);
  }
  // Random shuffle
  for (let k = candidates.length - 1; k > 0; k--) {
    const j = nextInt(rng, k + 1);
    [candidates[k], candidates[j]] = [candidates[j]!, candidates[k]!];
  }
  for (const c of candidates) {
    if (addHorseAt(territories, touching, c, ownerId, rng, visited)) return true;
  }
  return false;
}

export function applyProduction(prev: GameState): GameState {
  if (prev.currentPhase !== 'production') {
    throw new Error(`Production plan illegal during ${prev.currentPhase} phase`);
  }
  // Build an RNG positioned at the persistent state cursor
  const rng = { seed: prev.seed, cursor: prev.rngCursor };
  const skipRoll = nextFloat(rng);
  if (skipRoll < PHASE_SKIP_PROBABILITY) {
    const reason = pickReason(rng);
    return {
      ...prev,
      rngCursor: rng.cursor,
      currentPhase: 'trade', // skip directly to next phase
      log: [
        ...prev.log,
        { year: prev.year, phase: 'production', player: prev.currentPlayer,
          message: `Production skipped: ${reason}` },
      ],
    };
  }
  // Real production tick: codes 0-3 yield to stockpile; Stable produces horse.
  const players = prev.players.map((p) => ({ ...p, stockpile: [...p.stockpile] as typeof p.stockpile }));
  const territories: Territory[] = prev.territories.map((t) => ({ ...t }));
  for (const t of prev.territories) {
    if (t.ownerId === null) continue;
    if (t.resource === null) continue;
    if (t.resource >= 0 && t.resource <= 3) {
      const yield_ = t.hasResourceDouble ? 2 : 1;
      players[t.ownerId]!.stockpile[t.resource] += yield_;
    } else if (t.resource === 4 /* Stable */) {
      addHorseAt(territories, prev.touching, t.id, t.ownerId, rng);
    }
  }
  return {
    ...prev,
    rngCursor: rng.cursor,
    territories,
    players,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'production', player: prev.currentPlayer, message: 'Production tick complete' },
    ],
  };
}

export function playersNeedingStockpileLocation(state: GameState): number[] {
  const need: number[] = [];
  for (const p of state.players) {
    if (p.status !== 'playing') continue;
    if (p.stockpileLocation !== null) continue;
    const stockpileSum =
      p.stockpile[0] + p.stockpile[1] + p.stockpile[2] + p.stockpile[3] + p.stockpile[4];
    if (stockpileSum === 0) continue;
    // Player must also own at least one territory to drop stockpile on
    const ownsLand = state.territories.some((t) => t.ownerId === p.id);
    if (!ownsLand) continue;
    need.push(p.id);
  }
  return need;
}
