import type { GameSetup, GameState, PlayerId, Stockpile } from './types.js';

export type Plan =
  | { kind: 'newGame'; setup: GameSetup; seed: number }
  | { kind: 'selection'; player: PlayerId; territoryId: number }
  | { kind: 'production' }
  | { kind: 'trade'; proposer: PlayerId; tradee: PlayerId; give: Stockpile; receive: Stockpile }
  | { kind: 'tradeResponse'; accept: boolean }
  | { kind: 'tradeRejectAll'; tradee: PlayerId; trader: PlayerId }
  | { kind: 'horseFrom'; player: PlayerId; territoryId: number }
  | { kind: 'horseTo'; player: PlayerId; territoryId: number }
  | { kind: 'shipStockpile'; player: PlayerId; from: number; to: number }
  | { kind: 'shipHorse'; player: PlayerId; from: number; to: number;
      restStop?: number; pickUpWeaponFrom?: number; moveWeaponTo?: number }
  | { kind: 'shipWeapon'; player: PlayerId; from: number; to: number }
  | { kind: 'shipBoat'; player: PlayerId; boatId: number; toX: number; toY: number;
      pickUpHorseFrom?: number; pickUpWeaponFrom?: number }
  | { kind: 'attack'; player: PlayerId; targetTerritoryId: number;
      fromTerritoryId: number;
      boatId: number | null;
      horseFromTerritoryId: number | null;
      weaponFromTerritoryId: number | null }
  | { kind: 'alliesDecision'; player: PlayerId; choice: 'attacker' | 'neutral' | 'defender' }
  | { kind: 'resolveCombat' }
  | { kind: 'buildCity'; player: PlayerId; territoryId: number; payInGold: boolean }
  | { kind: 'buildWeapon'; player: PlayerId; territoryId: number; payInGold: boolean }
  | { kind: 'buildBoat'; player: PlayerId; territoryId: number; lakeId: number; payInGold: boolean }
  | { kind: 'endPhase'; player: PlayerId }
  | { kind: 'savegame'; slot: 'autosave' | 'slot1' | 'slot2' | 'slot3' }
  | { kind: 'loadgame'; state: GameState }
  | { kind: 'loadmap'; mapText: string };

export type PlanKind = Plan['kind'];
