import type { GameState, PlayerId } from '../types.js';

export function applyYearWrap(prev: GameState): GameState {
  const t = prev.turnOrder;
  const rotated: PlayerId[] = t.length > 0 ? [t[t.length - 1]!, ...t.slice(0, -1)] : [];

  const terrCount = new Map<PlayerId, number>();
  for (const tt of prev.territories) {
    if (tt.ownerId !== null) terrCount.set(tt.ownerId, (terrCount.get(tt.ownerId) ?? 0) + 1);
  }
  const surviving = rotated.filter((p) => (terrCount.get(p) ?? 0) > 0);
  const players = prev.players.map((p) =>
    (terrCount.get(p.id) ?? 0) === 0 ? { ...p, status: 'eliminated' as const } : p);

  const N = prev.players.length;
  const autoReject: boolean[][] = Array.from(
    { length: N }, () => new Array<boolean>(N).fill(false));
  const shipmentForfeitsSecondAttack = new Array<boolean>(N).fill(false);

  return {
    ...prev,
    players,
    turnOrder: surviving,
    currentPhase: 'production',
    currentPlayer: surviving[0]!,
    year: prev.year + 1,
    attackNumber: 1,
    shipmentUsed: false,
    shipmentForfeitsSecondAttack,
    pendingTrade: null,
    pendingCombat: null,
    rejectedTrades: [],
    autoReject,
    log: [
      ...prev.log,
      { year: prev.year + 1, phase: 'production', player: surviving[0]!,
        message: `Year ${prev.year + 1} begins` },
    ],
  };
}
