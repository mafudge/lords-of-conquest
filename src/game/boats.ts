import type { Boat, GameState, PlayerId } from './types.js';

export type AddBoatResult =
  | { kind: 'ok'; boatId: number; boats: Array<Boat | null> }
  | { kind: 'landlocked' }       // territory does not border the requested lake (-1)
  | { kind: 'allPortsFull' }     // no -1 water square adjacent on the chosen lake (-2)
  | { kind: 'dockStrike' };      // 256-slot pool exhausted (-3)

export function findFreeBoatSlot(boats: ReadonlyArray<Boat | null>): number {
  for (let i = 0; i < boats.length; i++) {
    if (boats[i] === null) return i;
  }
  return -1;
}

// Mirrors LocApplet.addBoat L3123-L3178. For Plan 3 we only need the basic
// validation + slot allocation; "All Ports Full" detection (which checks for
// a free water square adjacent to the territory on the requested lake) is
// added in Plan 4 when buildBoat needs it.
export function addBoat(
  state: GameState,
  territoryId: number,
  lakeId: number,
  ownerId: PlayerId,
): AddBoatResult {
  const t = state.territories[territoryId];
  if (!t || !t.bordersLakes.has(lakeId)) {
    return { kind: 'landlocked' };
  }
  const slot = findFreeBoatSlot(state.boats);
  if (slot === -1) return { kind: 'dockStrike' };
  const boats = [...state.boats];
  boats[slot] = {
    id: slot,
    x: -1, y: -1,
    homeTerritoryId: territoryId,
    ownerId,
    carryHorse: false,
    carryWeapon: false,
  };
  return { kind: 'ok', boatId: slot, boats };
}
