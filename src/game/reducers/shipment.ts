import type { GameState, PlayerId, Stockpile } from '../types.js';
import { GRID_WIDTH } from '../constants.js';

export function applyShipStockpile(
  prev: GameState,
  player: PlayerId,
  from: number,
  to: number,
): GameState {
  if (prev.currentPhase !== 'shipment') {
    throw new Error(`shipStockpile illegal during ${prev.currentPhase} phase`);
  }
  if (player !== prev.currentPlayer) {
    throw new Error(`shipStockpile by player ${player} but current is ${prev.currentPlayer}`);
  }
  if (prev.shipmentUsed) throw new Error(`Player ${player} has already shipped this turn`);
  if (from === to) throw new Error(`Cannot ship stockpile to the same territory`);
  const fromT = prev.territories[from];
  const toT = prev.territories[to];
  if (!fromT || !toT) throw new Error(`Invalid territory id`);
  if (fromT.ownerId !== player) throw new Error(`Source territory not owned by player`);
  if (toT.ownerId !== player) throw new Error(`Destination territory not owned by player`);
  if (prev.players[player]!.stockpileLocation !== from) {
    throw new Error(`Source ${from} is not the player's stockpile location`);
  }
  const territories = prev.territories.map((t) => {
    if (t.id === from) return { ...t, hasStockpile: false };
    if (t.id === to) return { ...t, hasStockpile: true };
    return t;
  });
  const players = prev.players.map((p) =>
    p.id === player ? { ...p, stockpileLocation: to } : p,
  );
  return {
    ...prev,
    territories,
    players,
    shipmentUsed: true,
    shipmentForfeitsSecondAttack: true,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'shipment', player,
        message: `Stockpile shipped from ${from} to ${to} (forfeits 2nd attack)` },
    ],
  };
}

// ─── shipHorse ───────────────────────────────────────────────────────────────

export type ShipHorseInput = {
  player: PlayerId;
  from: number;
  to: number;
  restStop?: number;
  pickUpWeaponFrom?: number;
  moveWeaponTo?: number;
};

export function applyShipHorse(prev: GameState, input: ShipHorseInput): GameState {
  if (prev.currentPhase !== 'shipment') {
    throw new Error(`shipHorse illegal during ${prev.currentPhase} phase`);
  }
  if (input.player !== prev.currentPlayer) {
    throw new Error(`shipHorse by player ${input.player} but current is ${prev.currentPlayer}`);
  }
  if (prev.shipmentUsed) throw new Error(`Already shipped this turn`);
  const fromT = prev.territories[input.from];
  const toT = prev.territories[input.to];
  if (!fromT || !toT) throw new Error(`Invalid territory id`);
  if (fromT.ownerId !== input.player) throw new Error(`Source not owned`);
  if (toT.ownerId !== input.player) throw new Error(`Destination not owned`);
  if (!fromT.hasHorse) throw new Error(`Source has no horse`);

  if (prev.touching[input.from]?.[input.to]) {
    // 1-hop move
    const territories = prev.territories.map((t) => {
      if (t.id === input.from) return { ...t, hasHorse: false };
      return t;
    });
    let players = prev.players;
    if (toT.hasHorse) {
      players = players.map((p) => {
        if (p.id !== input.player) return p;
        const stock: Stockpile = [...p.stockpile] as Stockpile;
        stock[4] = Math.max(0, stock[4] - 1);
        return { ...p, stockpile: stock };
      });
    } else {
      territories[input.to] = { ...territories[input.to]!, hasHorse: true };
    }
    return {
      ...prev,
      territories,
      players,
      shipmentUsed: true,
      log: [
        ...prev.log,
        { year: prev.year, phase: 'shipment', player: input.player,
          message: `Horse shipped from ${input.from} to ${input.to}` },
      ],
    };
  }

  // Not adjacent — need restStop for 2-hop
  if (input.restStop === undefined) {
    throw new Error(`Destination not adjacent (use restStop for 2-hop moves)`);
  }

  const rs = prev.territories[input.restStop];
  if (!rs) throw new Error(`Invalid restStop ${input.restStop}`);
  if (rs.ownerId !== input.player) throw new Error(`restStop not owned by player`);
  if (!prev.touching[input.from]?.[input.restStop]) {
    throw new Error(`restStop is not adjacent to source`);
  }
  if (!prev.touching[input.restStop]?.[input.to]) {
    throw new Error(`Destination not adjacent to restStop`);
  }
  const territories2 = prev.territories.map((t) => {
    if (t.id === input.from) return { ...t, hasHorse: false };
    if (t.id === input.to) {
      return toT.hasHorse ? t : { ...t, hasHorse: true };
    }
    return t;
  });
  let players2 = prev.players;
  if (toT.hasHorse) {
    players2 = players2.map((p) => {
      if (p.id !== input.player) return p;
      const stock: Stockpile = [...p.stockpile] as Stockpile;
      stock[4] = Math.max(0, stock[4] - 1);
      return { ...p, stockpile: stock };
    });
  }
  return {
    ...prev,
    territories: territories2,
    players: players2,
    shipmentUsed: true,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'shipment', player: input.player,
        message: `Horse shipped 2-hop from ${input.from} via ${input.restStop} to ${input.to}` },
    ],
  };
}

// ─── shipWeapon ──────────────────────────────────────────────────────────────

export function applyShipWeapon(
  prev: GameState,
  player: PlayerId,
  from: number,
  to: number,
): GameState {
  if (prev.currentPhase !== 'shipment') {
    throw new Error(`shipWeapon illegal during ${prev.currentPhase} phase`);
  }
  if (player !== prev.currentPlayer) {
    throw new Error(`shipWeapon by player ${player} but current is ${prev.currentPlayer}`);
  }
  if (prev.shipmentUsed) throw new Error(`Already shipped this turn`);
  const fromT = prev.territories[from];
  const toT = prev.territories[to];
  if (!fromT || !toT) throw new Error(`Invalid territory id`);
  if (fromT.ownerId !== player) throw new Error(`Source not owned`);
  if (toT.ownerId !== player) throw new Error(`Destination not owned`);
  if (!fromT.hasWeapon) throw new Error(`Source has no weapon`);
  if (!prev.touching[from]?.[to]) {
    throw new Error(`Destination not adjacent (weapon shipping is 1 hop only)`);
  }
  const territories = prev.territories.map((t) => {
    if (t.id === from) return { ...t, hasWeapon: false };
    if (t.id === to && !toT.hasWeapon) return { ...t, hasWeapon: true };
    return t;
  });
  return {
    ...prev,
    territories,
    shipmentUsed: true,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'shipment', player,
        message: `Weapon shipped from ${from} to ${to}` },
    ],
  };
}

// ─── shipBoat ────────────────────────────────────────────────────────────────

export type ShipBoatInput = {
  player: PlayerId;
  boatId: number;
  toX: number;
  toY: number;
  pickUpHorseFrom?: number;
  pickUpWeaponFrom?: number;
};

export function applyShipBoat(prev: GameState, input: ShipBoatInput): GameState {
  if (prev.currentPhase !== 'shipment') {
    throw new Error(`shipBoat illegal during ${prev.currentPhase} phase`);
  }
  if (input.player !== prev.currentPlayer) {
    throw new Error(`shipBoat by player ${input.player} but current is ${prev.currentPlayer}`);
  }
  if (prev.shipmentUsed) throw new Error(`Already shipped this turn`);
  const boat = prev.boats[input.boatId];
  if (!boat) throw new Error(`No boat ${input.boatId}`);
  if (boat.ownerId !== input.player) throw new Error(`Boat not owned by player`);
  const srcSq = prev.squares[boat.y * GRID_WIDTH + boat.x];
  if (!srcSq) throw new Error(`Boat is at invalid position`);
  const dstSq = prev.squares[input.toY * GRID_WIDTH + input.toX];
  if (!dstSq) throw new Error(`Destination out of bounds`);
  if (dstSq.territoryId !== null) {
    throw new Error(`Destination is land, not water`);
  }
  if (dstSq.lakeId !== srcSq.lakeId) {
    throw new Error(`Destination is on a different lake`);
  }
  const boats = prev.boats.map((b) =>
    b && b.id === input.boatId ? { ...b, x: input.toX, y: input.toY } : b,
  );
  let territories = prev.territories;

  if (input.pickUpHorseFrom !== undefined) {
    const t = prev.territories[input.pickUpHorseFrom];
    if (!t) throw new Error(`Invalid pickUpHorseFrom`);
    if (t.ownerId !== input.player) throw new Error(`Horse pickup not owned`);
    if (!t.hasHorse) throw new Error(`No horse at pickup`);
    if (!t.bordersLakes.has(srcSq.lakeId!)) {
      throw new Error(`Horse pickup not adjacent to boat's lake`);
    }
    const updated = boats[input.boatId]!;
    boats[input.boatId] = { ...updated, carryHorse: true };
    territories = territories.map((tt) =>
      tt.id === input.pickUpHorseFrom ? { ...tt, hasHorse: false } : tt,
    );
  }
  if (input.pickUpWeaponFrom !== undefined) {
    const t = prev.territories[input.pickUpWeaponFrom];
    if (!t) throw new Error(`Invalid pickUpWeaponFrom`);
    if (t.ownerId !== input.player) throw new Error(`Weapon pickup not owned`);
    if (!t.hasWeapon) throw new Error(`No weapon at pickup`);
    if (!t.bordersLakes.has(srcSq.lakeId!)) {
      throw new Error(`Weapon pickup not adjacent to boat's lake`);
    }
    const updated = boats[input.boatId]!;
    boats[input.boatId] = { ...updated, carryWeapon: true };
    territories = territories.map((tt) =>
      tt.id === input.pickUpWeaponFrom ? { ...tt, hasWeapon: false } : tt,
    );
  }
  return {
    ...prev,
    boats,
    territories,
    shipmentUsed: true,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'shipment', player: input.player,
        message: `Boat ${input.boatId} moved to (${input.toX},${input.toY})` },
    ],
  };
}
