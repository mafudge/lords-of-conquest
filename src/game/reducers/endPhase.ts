import type { GameState, PlayerId } from '../types.js';
import { PHASE_SKIP_PROBABILITY } from '../constants.js';
import { nextFloat } from '../rng.js';
import { pickReason } from '../reasons.js';

export function applyEndPhase(prev: GameState, _player: PlayerId): GameState {
  switch (prev.currentPhase) {
    case 'selection': {
      const unowned = prev.territories.filter((t) => t.ownerId === null);
      if (unowned.length > 0) {
        throw new Error(`Cannot end selection — ${unowned.length} unowned territories remain`);
      }
      const reversed: PlayerId[] = [...prev.turnOrder].reverse();
      return {
        ...prev,
        turnOrder: reversed,
        currentPhase: 'production',
        currentPlayer: reversed[0]!,
        log: [
          ...prev.log,
          { year: prev.year, phase: 'production', player: reversed[0]!,
            message: 'Selection complete — turn order reversed' },
        ],
      };
    }
    case 'production': {
      // Production has completed. Decide whether trade is skipped.
      const numPlayers = prev.players.filter((p) => p.status === 'playing').length;
      // 2-player full-skip rule
      if (numPlayers === 2) {
        return {
          ...prev,
          currentPhase: 'shipment',
          currentPlayer: prev.turnOrder[0]!,
          log: [
            ...prev.log,
            { year: prev.year, phase: 'shipment', player: prev.turnOrder[0]!,
              message: 'Trade phase skipped (2 players)' },
          ],
        };
      }
      // 1/6 skip
      const rng = { seed: prev.seed, cursor: prev.rngCursor };
      const skipRoll = nextFloat(rng);
      if (skipRoll < PHASE_SKIP_PROBABILITY) {
        const reason = pickReason(rng);
        return {
          ...prev,
          rngCursor: rng.cursor,
          currentPhase: 'shipment',
          currentPlayer: prev.turnOrder[0]!,
          log: [
            ...prev.log,
            { year: prev.year, phase: 'trade', player: prev.currentPlayer,
              message: `Trade skipped: ${reason}` },
          ],
        };
      }
      return {
        ...prev,
        rngCursor: rng.cursor,
        currentPhase: 'trade',
        currentPlayer: prev.turnOrder[0]!,
        log: [
          ...prev.log,
          { year: prev.year, phase: 'trade', player: prev.turnOrder[0]!,
            message: 'Trade phase begins' },
        ],
      };
    }
    case 'trade': {
      if (prev.pendingTrade !== null) {
        throw new Error(`Cannot end trade with a pending trade in flight`);
      }
      const idx = prev.turnOrder.indexOf(prev.currentPlayer);
      const nextIdx = (idx + 1) % prev.turnOrder.length;
      if (nextIdx !== 0) {
        return {
          ...prev,
          currentPlayer: prev.turnOrder[nextIdx]!,
          log: [
            ...prev.log,
            { year: prev.year, phase: 'trade', player: prev.turnOrder[nextIdx]!,
              message: `Player ${prev.turnOrder[nextIdx]} begins trading` },
          ],
        };
      }
      // Wrapped — advance to shipment with 1/6 skip
      const rng = { seed: prev.seed, cursor: prev.rngCursor };
      const skipRoll = nextFloat(rng);
      if (skipRoll < PHASE_SKIP_PROBABILITY) {
        const reason = pickReason(rng);
        return {
          ...prev,
          rngCursor: rng.cursor,
          currentPhase: 'conquest',
          currentPlayer: prev.turnOrder[0]!,
          shipmentUsed: false,
          attackNumber: 1,
          log: [
            ...prev.log,
            { year: prev.year, phase: 'shipment', player: prev.currentPlayer,
              message: `Shipment skipped: ${reason}` },
          ],
        };
      }
      return {
        ...prev,
        rngCursor: rng.cursor,
        currentPhase: 'shipment',
        currentPlayer: prev.turnOrder[0]!,
        shipmentUsed: false,
        log: [
          ...prev.log,
          { year: prev.year, phase: 'shipment', player: prev.turnOrder[0]!,
            message: 'Shipment phase begins' },
        ],
      };
    }
    default:
      throw new Error(`endPhase from ${prev.currentPhase} is not implemented in plan 2 (Plan 3 territory)`);
  }
}
