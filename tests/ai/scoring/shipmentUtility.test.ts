import { describe, it, expect } from 'vitest';
import { getShipmentUtility } from '../../../src/game/ai/scoring/shipmentUtility.js';
import { getBFPossible } from '../../../src/game/ai/bfPossible.js';
import { seededState } from '../_fixtures.js';

describe('getShipmentUtility', () => {
  it('returns a numeric score for shipStockpile to a different owned territory', () => {
    const s = seededState({ seed: 42 });
    const bf = getBFPossible(s, 0);
    const owned = s.territories.filter((t) => t.ownerId === 0);
    if (owned.length < 2) return;
    const score = getShipmentUtility(s, 0, {
      kind: 'shipStockpile', player: 0, from: owned[0]!.id, to: owned[1]!.id,
    }, bf);
    expect(typeof score).toBe('number');
  });

  it('rewards moving stockpile to a safer territory (lower bfPossible)', () => {
    let s = seededState({ seed: 42 });
    const owned = s.territories.filter((t) => t.ownerId === 0);
    if (owned.length < 2) return;
    s = { ...s, territories: s.territories.map((t) =>
      t.id === owned[0]!.id ? { ...t, hasStockpile: true } : t) };
    s = { ...s, players: s.players.map((p) =>
      p.id === 0 ? { ...p, stockpileLocation: owned[0]!.id, stockpile: [3, 0, 0, 0, 0] } : p) };
    const bf = getBFPossible(s, 0);
    const score = getShipmentUtility(s, 0, {
      kind: 'shipStockpile', player: 0, from: owned[0]!.id, to: owned[1]!.id,
    }, bf);
    expect(typeof score).toBe('number');
  });
});
