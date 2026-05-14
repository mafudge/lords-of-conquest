import type { GameState, PlayerId, Stockpile } from '../types.js';
import { recomputeResourceDoubles } from '../activation.js';
import { addBoat } from '../boats.js';

export function applyBuildCity(
  prev: GameState,
  player: PlayerId,
  territoryId: number,
  payInGold: boolean,
): GameState {
  if (prev.currentPhase !== 'development') {
    throw new Error(`buildCity illegal during ${prev.currentPhase} phase`);
  }
  if (player !== prev.currentPlayer) {
    throw new Error(`buildCity by player ${player} but current is ${prev.currentPlayer}`);
  }
  const t = prev.territories[territoryId];
  if (!t) throw new Error(`Invalid territory id`);
  if (t.ownerId !== player) throw new Error(`Territory not owned by player`);
  if (t.hasCity) throw new Error(`Territory already has a city`);

  const stock = prev.players[player]!.stockpile;
  if (payInGold) {
    if (stock[3] < 4) throw new Error(`Insufficient gold (need 4)`);
  } else {
    if (stock[0] < 1 || stock[1] < 1 || stock[2] < 1 || stock[3] < 1) {
      throw new Error(`Insufficient resources (need 1 each iron/coal/tree/gold)`);
    }
  }

  const players = prev.players.map((p) => {
    if (p.id !== player) return p;
    const s: Stockpile = [...p.stockpile] as Stockpile;
    if (payInGold) s[3] -= 4;
    else { s[0] -= 1; s[1] -= 1; s[2] -= 1; s[3] -= 1; }
    return { ...p, stockpile: s };
  });
  const territories = prev.territories.map((tt) =>
    tt.id === territoryId ? { ...tt, hasCity: true } : tt);
  const swept = recomputeResourceDoubles({ ...prev, players, territories });
  return {
    ...swept,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'development', player,
        message: `City built on territory ${territoryId} (${payInGold ? 'gold' : 'resources'})` },
    ],
  };
}

export function applyBuildWeapon(
  prev: GameState,
  player: PlayerId,
  territoryId: number,
  payInGold: boolean,
): GameState {
  if (prev.currentPhase !== 'development') {
    throw new Error(`buildWeapon illegal during ${prev.currentPhase} phase`);
  }
  if (player !== prev.currentPlayer) {
    throw new Error(`buildWeapon by player ${player} but current is ${prev.currentPlayer}`);
  }
  const t = prev.territories[territoryId];
  if (!t) throw new Error(`Invalid territory id`);
  if (t.ownerId !== player) throw new Error(`Territory not owned by player`);
  if (t.hasWeapon) throw new Error(`Territory already has a weapon`);

  const stock = prev.players[player]!.stockpile;
  if (payInGold) {
    if (stock[3] < 2) throw new Error(`Insufficient gold (need 2)`);
  } else {
    if (stock[0] < 1 || stock[1] < 1) {
      throw new Error(`Insufficient resources (need 1 iron + 1 coal)`);
    }
  }
  const players = prev.players.map((p) => {
    if (p.id !== player) return p;
    const s: Stockpile = [...p.stockpile] as Stockpile;
    if (payInGold) s[3] -= 2;
    else { s[0] -= 1; s[1] -= 1; }
    return { ...p, stockpile: s };
  });
  const territories = prev.territories.map((tt) =>
    tt.id === territoryId ? { ...tt, hasWeapon: true } : tt);
  return {
    ...prev,
    players,
    territories,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'development', player,
        message: `Weapon built on territory ${territoryId}` },
    ],
  };
}

export function applyBuildBoat(
  prev: GameState,
  player: PlayerId,
  territoryId: number,
  lakeId: number,
  payInGold: boolean,
): GameState {
  if (prev.currentPhase !== 'development') {
    throw new Error(`buildBoat illegal during ${prev.currentPhase} phase`);
  }
  if (player !== prev.currentPlayer) {
    throw new Error(`buildBoat by player ${player} but current is ${prev.currentPlayer}`);
  }
  const t = prev.territories[territoryId];
  if (!t) throw new Error(`Invalid territory id`);
  if (t.ownerId !== player) throw new Error(`Territory not owned by player`);

  const stock = prev.players[player]!.stockpile;
  if (payInGold) {
    if (stock[3] < 3) throw new Error(`Insufficient gold (need 3)`);
  } else {
    if (stock[2] < 3) throw new Error(`Insufficient trees (need 3)`);
  }

  const result = addBoat(prev, territoryId, lakeId, player);
  if (result.kind === 'landlocked') {
    throw new Error(`Selected territory is landlocked`);
  }
  if (result.kind === 'allPortsFull') {
    throw new Error(`All Ports Full`);
  }
  if (result.kind === 'dockStrike') {
    throw new Error(`Dock Strike (boat pool exhausted)`);
  }
  const players = prev.players.map((p) => {
    if (p.id !== player) return p;
    const s: Stockpile = [...p.stockpile] as Stockpile;
    if (payInGold) s[3] -= 3;
    else s[2] -= 3;
    return { ...p, stockpile: s };
  });
  return {
    ...prev,
    boats: result.boats,
    players,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'development', player,
        message: `Boat ${result.boatId} built at territory ${territoryId} (lake ${lakeId})` },
    ],
  };
}
