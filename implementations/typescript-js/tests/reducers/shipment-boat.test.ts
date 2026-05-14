import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import { GRID_WIDTH } from '../../src/game/constants.js';
import type { GameState, GameSetup, Boat } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function shipmentWithBoat(): { state: GameState; boatId: number; toX: number; toY: number } {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 37 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'shipment', currentPlayer: 0, shipmentUsed: false, shipmentForfeitsSecondAttack: [] };
  const coastTerr = s.territories.find(
    (t) => t.ownerId === 0 && t.bordersLakes.size > 0,
  );
  if (!coastTerr) throw new Error('No coastal owned territory');
  const lakeId = [...coastTerr.bordersLakes][0]!;
  const waterIdx = s.squares.findIndex((sq) => sq.lakeId === lakeId && sq.territoryId === null);
  if (waterIdx < 0) throw new Error('No water square for lake');
  const wsq = s.squares[waterIdx]!;
  const boat: Boat = {
    id: 0, x: wsq.x, y: wsq.y, homeTerritoryId: coastTerr.id, ownerId: 0,
    carryHorse: false, carryWeapon: false,
  };
  s.boats[0] = boat;
  const destIdx = s.squares.findIndex(
    (sq, i) => sq.lakeId === lakeId && sq.territoryId === null && i !== waterIdx,
  );
  if (destIdx < 0) throw new Error('No second water square');
  const dsq = s.squares[destIdx]!;
  return { state: s, boatId: 0, toX: dsq.x, toY: dsq.y };
}

describe('shipBoat', () => {
  it('moves boat to a water square on the same lake', () => {
    const { state: s, boatId, toX, toY } = shipmentWithBoat();
    const out = reduce(s, { kind: 'shipBoat', player: 0, boatId, toX, toY });
    expect(out.boats[boatId]!.x).toBe(toX);
    expect(out.boats[boatId]!.y).toBe(toY);
    expect(out.shipmentUsed).toBe(true);
  });

  it('rejects moving boat onto a non-water square', () => {
    const { state: s, boatId } = shipmentWithBoat();
    const landIdx = s.squares.findIndex((sq) => sq.territoryId !== null);
    const lsq = s.squares[landIdx]!;
    expect(() => reduce(s, { kind: 'shipBoat', player: 0, boatId, toX: lsq.x, toY: lsq.y }))
      .toThrow(/water|land/i);
  });

  it('rejects moving boat to a different lake', () => {
    const { state: s, boatId } = shipmentWithBoat();
    const myLake = s.squares[s.boats[boatId]!.y * GRID_WIDTH + s.boats[boatId]!.x]!.lakeId;
    const otherIdx = s.squares.findIndex(
      (sq) => sq.lakeId !== null && sq.lakeId !== myLake && sq.territoryId === null,
    );
    if (otherIdx < 0) return;
    const osq = s.squares[otherIdx]!;
    expect(() => reduce(s, { kind: 'shipBoat', player: 0, boatId, toX: osq.x, toY: osq.y }))
      .toThrow(/lake/i);
  });

  it('picks up a horse from an adjacent owned territory', () => {
    const { state: s, boatId, toX, toY } = shipmentWithBoat();
    const homeT = s.territories[s.boats[boatId]!.homeTerritoryId]!;
    s.territories[homeT.id]!.hasHorse = true;
    const out = reduce(s, {
      kind: 'shipBoat', player: 0, boatId, toX, toY,
      pickUpHorseFrom: homeT.id,
    });
    expect(out.boats[boatId]!.carryHorse).toBe(true);
    expect(out.territories[homeT.id]!.hasHorse).toBe(false);
  });
});
