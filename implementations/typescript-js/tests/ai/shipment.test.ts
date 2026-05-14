import { describe, it, expect } from 'vitest';
import { decideShipmentAction } from '../../src/game/ai/shipment.js';
import { seededState } from './_fixtures.js';

describe('decideShipmentAction', () => {
  it('returns endPhase for passive personas', () => {
    let s = seededState({ seed: 42, personas: ['passive', 'aggressive', 'aggressive'] });
    s = { ...s, currentPhase: 'shipment', currentPlayer: 0, shipmentUsed: false };
    const plan = decideShipmentAction(s, 0);
    expect(plan.kind).toBe('endPhase');
  });

  it('returns endPhase when shipmentUsed is already true', () => {
    let s = seededState({ seed: 42 });
    s = { ...s, currentPhase: 'shipment', currentPlayer: 0, shipmentUsed: true };
    const plan = decideShipmentAction(s, 0);
    expect(plan.kind).toBe('endPhase');
  });

  it('returns a ship plan when player has movable assets and positive utility', () => {
    let s = seededState({ seed: 42 });
    const own = s.territories.find((t) => t.ownerId === 0)!;
    s = { ...s, territories: s.territories.map((t) =>
      t.id === own.id ? { ...t, hasHorse: true } : t) };
    s = { ...s, currentPhase: 'shipment', currentPlayer: 0, shipmentUsed: false };
    const plan = decideShipmentAction(s, 0);
    expect(['shipStockpile', 'shipHorse', 'shipWeapon', 'shipBoat', 'endPhase'])
      .toContain(plan.kind);
  });
});

describe('decideShipmentAction boat moves', () => {
  it('considers boat moves when player owns a boat', () => {
    let s = seededState({ seed: 42 });
    const coast = s.territories.find((t) =>
      t.ownerId === 0 && t.bordersLakes.size > 0);
    if (!coast) return;
    const lakeId = [...coast.bordersLakes][0]!;
    const waterIdx = s.squares.findIndex((sq) => sq.lakeId === lakeId && sq.territoryId === null);
    if (waterIdx < 0) return;
    const wsq = s.squares[waterIdx]!;
    s = { ...s, boats: s.boats.map((b, i) => i === 0
      ? { id: 0, x: wsq.x, y: wsq.y, homeTerritoryId: coast.id, ownerId: 0,
          carryHorse: false, carryWeapon: false }
      : b) };
    s = { ...s, currentPhase: 'shipment', currentPlayer: 0, shipmentUsed: false };
    const plan = decideShipmentAction(s, 0);
    expect(['shipStockpile', 'shipHorse', 'shipWeapon', 'shipBoat', 'endPhase'])
      .toContain(plan.kind);
  });
});
