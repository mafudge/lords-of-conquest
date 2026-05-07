export enum Code {
  NOTHING = -1,
  IRON = 0,
  COAL = 1,
  TREE = 2,
  GOLD = 3,
  STABLE = 4,
  CITY = 5,
  HORSE = 6,
  WEAPON = 7,
  STOCKPILE = 8,
  BOAT = 9,
}

export type ResourceCode = Code.IRON | Code.COAL | Code.TREE | Code.GOLD | Code.STABLE;
export type ItemCode = Code.CITY | Code.HORSE | Code.WEAPON | Code.STOCKPILE;

export const RESOURCE_CODES: readonly ResourceCode[] = [
  Code.IRON, Code.COAL, Code.TREE, Code.GOLD, Code.STABLE,
] as const;

export const ITEM_CODES: readonly ItemCode[] = [
  Code.CITY, Code.HORSE, Code.WEAPON, Code.STOCKPILE,
] as const;

export function isResourceCode(c: number): c is ResourceCode {
  return c >= Code.IRON && c <= Code.STABLE;
}
