# Lords of Conquest — Modern Port Design

**Status:** Approved for planning.
**Date:** 2026-05-06.
**Source of truth:** Randy Gettman's 2003 Java applet (`loc.jar`, `LocApplet.class` and friends), decompiled and cataloged from the Internet Archive's capture of the angelfire mirror. The CheerpJ embed (`/index.html` + `/loc.jar`) ships alongside this port and serves as a behavior reference and a fallback playable artifact.

## Overview

A modern, browser-based port of Randy Gettman's *Lords of Conquest* applet — itself a faithful imitation of the 1986 Electronic Arts strategy game. **Feature-equivalent** to Gettman's applet: every menu, every option, every rule, every AI behavior must match. Implementation is idiomatic 2026 TypeScript: pure-reducer state, modern flat UI in the DOM, no AWT carry-over, no compiled-Java aesthetic.

The game runs entirely client-side from a static site. Built as a portfolio piece — code clarity, polish, demonstrable AI, and faithfulness to Gettman's quirks all matter.

## Goals

- **Behavior equivalence with Gettman's applet.** Same rules, same AI decisions for the same inputs, same numeric constants where they matter (e.g., `ptResource = [7,7,7,9,7]`).
- **Feature equivalence.** Every game-start option, every dialog, every shipment subcase, every bring-forces variant, the allies system, scouting report, save-map-text, etc.
- **Modern, readable TypeScript.** Pure reducer over an immutable `GameState`. Plans become a discriminated union. UI is plain DOM + CSS, no React, no game-engine framework.
- **Modern UI.** Replace Gettman's 42-card AWT CardLayout with a single fluid screen plus a small set of context-sensitive overlays. Same affordances, fewer mode-switches. Modern flat aesthetic — rounded tiles, sans-serif, vivid palette, all SVG/CSS.
- **Determinism.** Single seedable RNG for map generation and combat resolution. Identical `(seed, params, action sequence)` always yields identical outcomes. Seeds shareable via `?seed=…`.
- **Static-site deploy** to GitHub Pages or Vercel. No backend.

## Non-goals (out of scope for MVP)

- Hotseat or networked multiplayer.
- Mobile / responsive layout (desktop-first).
- Sound effects and music (Gettman didn't have any either; he literally jokes about the lack on the win screen).
- Tutorial / onboarding (deferred to post-MVP).
- WebAssembly / compiled-language game logic.

## Tech stack

- **Language:** TypeScript (strict).
- **Build / dev server:** Vite.
- **UI:** Plain DOM + CSS Grid for the board. SVG for in-tile glyphs. No UI framework.
- **Tests:** Vitest. Unit + property tests on pure game core. Snapshot tests of canonical game scenarios.
- **Deploy:** static site to GitHub Pages.

## Architecture

Three layers, one-way data flow.

```
┌──────────────────────────────────────────────────────────┐
│  UI (src/ui/)                                            │
│  BoardView · TurnHUD · TradePanel · CombatPanel ·        │
│  AlliesPanel · DevPanel · NewGameWizard · ScoutingReport │
└──────────────────┬─────────────────────▲─────────────────┘
                   │ dispatch(action)    │ render(state)
                   ▼                     │
┌──────────────────────────────────────────────────────────┐
│  Core (src/game/)                                        │
│  types · reducer · plans · rules/ · mapgen · ai/         │
│  reduce(state, action) → state'                          │
│  ai.decideAction(state, player, phase) → Plan[]          │
│  generateMap(seed, params) → Board                       │
└──────────────────┬─────────────────────▲─────────────────┘
                   │ save / encode       │ load / decode
                   ▼                     │
┌──────────────────────────────────────────────────────────┐
│  Platform (src/platform/)                                │
│  storage (localStorage) · urlSeed · mapTextCodec         │
└──────────────────────────────────────────────────────────┘
```

**Invariants:**

- UI never imports from platform. All persistence flows through core.
- Core has zero browser dependencies. Runs in Node for tests.
- Every mutation goes through `reduce(state, plan)` returning a new immutable `GameState`.
- AI is a pure function of `GameState`; no DOM, no `setTimeout`, no global state.
- Animation timing is owned by the UI layer, not the AI. Gettman's `Thread.sleep(1000)` in `LocAI` is **not** ported — the UI inserts pacing pauses around AI moves instead.

## Data model

Codes match `Square.java` exactly so cross-referencing the Java is unambiguous.

```ts
// Resource & item codes — same numbering as Square.java
export const enum Code {
  NOTHING   = -1,
  IRON      = 0,
  COAL      = 1,
  TREE      = 2,
  GOLD      = 3,
  STABLE    = 4,   // on-tile resource that produces horses
  CITY      = 5,
  HORSE     = 6,   // mobile unit produced by Stable
  WEAPON    = 7,
  STOCKPILE = 8,
  BOAT      = 9,
}

export type ResourceCode = Code.IRON | Code.COAL | Code.TREE | Code.GOLD | Code.STABLE; // 0..4
export type ItemCode     = Code.CITY | Code.HORSE | Code.WEAPON | Code.STOCKPILE;       // 5..8

export type PlayerId = 0 | 1 | 2 | 3 | 4 | 5 | 6;          // up to 7 players (Gettman's hard cap)
export const NATIVES_PLAYER_ID = 7;                         // ForceCount slot for unowned tiles

export type Persona = 'human' | 'passive' | 'defensive' | 'aggressive';
//                    LocAI: HUMAN=0, PASSIVE=1, DEFENSIVE=2, AGGRESSIVE=3

export type ElementOfChance = 'low' | 'medium' | 'high';
// Drives BOTH combat tie-break and full combat resolution. See "Combat" below.

export type Phase =
  | 'setup'        // pre-game wizard
  | 'selection'    // initial territory draft (one-time)
  | 'production'
  | 'trade'
  | 'shipment'
  | 'conquest'
  | 'development'
  | 'gameOver';

// A single grid square. The grid is fixed 40×20. With water boundary on, the
// outermost ring is always sea (boundary water).
export type Square = {
  x: number;                    // 0..39
  y: number;                    // 0..19
  territoryId: number | null;   // null means open water (or boundary water)
  lakeId: number | null;        // -1/null on land or annexed water; otherwise a lake index
  isBoundaryWater: boolean;     // outer ring when water boundary is enabled
};

// A territory is a connected set of squares with one designated "feature" square
// that may carry a resource code (0..4) or an item code (5..8). See Territory.java
// — Gettman models this as Square[] with each square holding its own code; we
// flatten to "resource (0..4) on this territory" + per-item flags. The combat
// math is identical because force counts only depend on totals, not positions.
export type Territory = {
  id: number;                          // 0..numTerritories-1
  ownerId: PlayerId | null;            // null = unowned (counts as natives in force calc)
  resource: ResourceCode | null;       // 0..4 if any (set during setup, immutable)
  hasCity: boolean;                    // ItemCode.CITY  (max 1)
  hasWeapon: boolean;                  // ItemCode.WEAPON (max 1)
  hasHorse: boolean;                   // ItemCode.HORSE  (max 1 on a tile, see addHorse)
  hasStockpile: boolean;               // ItemCode.STOCKPILE — owner's stockpile lives here
  hasResourceDouble: boolean;          // "second resource icon" added when a city activates
                                       // this resource (matches numResources()==2 in Java).
                                       // Drives the +2 production rule.
  squares: number[];                   // Square ids that make up this territory
  bordersLakes: Set<number>;           // lake ids this territory touches
  citiesAdjacent: number;              // cached count of adjacent friendly cities
};

export type Boat = {
  id: number;                          // 0..255 (256-slot pool, matching Gettman)
  x: number; y: number;                // current grid position (a water cell)
  homeTerritoryId: number;             // territory that built / docks this boat
  ownerId: PlayerId;
  carryHorse: boolean;                 // can carry 1 horse
  carryWeapon: boolean;                // can carry 1 weapon
};

export type Stockpile = [number, number, number, number, number];
// Indexed by ResourceCode 0..4 = [iron, coal, tree, gold, stable].
// "stable" is the horse-producing resource; trading "horses" trades slot 4.

export type Player = {
  id: PlayerId;
  name: string;                        // user-editable (default = color name)
  color: PlayerColor;                  // see palette
  persona: Persona;                    // human | passive | defensive | aggressive
  status: 'playing' | 'eliminated' | 'notPlaying';
  stockpile: Stockpile;
  stockpileLocation: number | null;    // territory id where the stockpile sits
};

export type PlayerColor = 'red' | 'blue' | 'cyan' | 'purple' | 'orange' | 'green' | 'yellow';
// Order matches LocApplet.colors[] at L63 — drives default boat sprite mapping.

// Map-generation parameters (game-start configuration)
export type MapParams = {
  waterBoundary: boolean;
  waterArea: 'small' | 'medium' | 'large';
  numTerritories: number;              // 14..64 (clamped by min 7×numPlayers, max 64)
  islands: 'none' | 'some' | 'lots';   // continent / island mix
  shapes: 'regular' | 'irregular';     // territory growth pattern
  resourceDensity:
    | { kind: 'fixed'; level: 'veryLow' | 'low' | 'medium' | 'high' }       // N copies of each resource
    | { kind: 'random'; level: 'veryLow' | 'low' | 'medium' | 'high' };     // round-robin until fraction filled
};

// Game-start configuration
export type GameSetup = {
  players: Array<{
    color: PlayerColor;
    name: string;
    persona: Persona;                  // 'notPlaying' equivalent: omit player from array
  }>;                                  // length 2..7
  citiesToWin: 3 | 4 | 5 | 6 | 7 | 8;
  elementOfChance: ElementOfChance;
  randomizePlayerOrder: boolean;
  map: MapParams;
};

// Lazily-evaluated combat snapshot, recomputed via getForceCount(state, terrId)
export type ForceCount = {
  perPlayer: number[];                 // length 8: indices 0..6 players, 7 natives
};

// In-progress combat state (populated during Conquest UI flow)
export type PendingCombat = {
  attackerId: PlayerId;
  defenderId: PlayerId | null;         // null when attacking unowned
  fromTerritoryId: number;
  targetTerritoryId: number;
  boatId: number | null;               // boat used (or null)
  horseFromTerritoryId: number | null; // -1 in Java = null here
  weaponFromTerritoryId: number | null;
  alliesDecisions: Array<'attacker' | 'neutral' | 'defender'>;
                                       // length numPlayers; entries for attacker
                                       // and defender are ignored
  alliesPending: Set<PlayerId>;        // players whose decision we still need
  attackerStrength: number;            // pre-rolled, before resolution
  defenderStrength: number;
  resolved: boolean;
  attackerWon: boolean;
};

// In-progress trade state
export type PendingTrade = {
  proposerId: PlayerId;
  tradeeId: PlayerId;
  give: Stockpile;                     // proposer gives
  receive: Stockpile;                  // proposer receives
  status: 'proposed' | 'accepted' | 'rejected';
  // If horses are part of the trade, these record the post-accept "Horse From / Horse To"
  // resolution. They are filled in *after* status flips to 'accepted'.
  horseFromTerritoryId?: number;
  horseToTerritoryId?: number;
};

export type LogEntry = {
  year: number;
  phase: Phase;
  player: PlayerId;
  message: string;                     // human-readable
};

export type GameState = {
  schemaVersion: 1;
  seed: number;                        // single mulberry32 seed
  rngCursor: number;                   // increments on every random draw
  setup: GameSetup;                    // immutable post-setup
  squares: Square[];                   // length 40*20 = 800
  territories: Territory[];            // length numTerritories
  boats: Array<Boat | null>;           // 256-slot pool; null = invalid slot
  players: Player[];                   // length 2..7
  turnOrder: PlayerId[];               // rotates each year
  currentPhase: Phase;
  currentPlayer: PlayerId;
  year: number;                        // increments after Development phase
  attackNumber: 1 | 2;                 // current player's attack counter (Conquest)
  shipmentUsed: boolean;               // current player's shipment used flag
  pendingTrade: PendingTrade | null;
  pendingCombat: PendingCombat | null;
  // Year-scoped state
  rejectedTrades: Array<{ trader: PlayerId; tradee: PlayerId; tradeKey: string; count: number }>;
                                       // for triple-rejected lockout & autoReject matrix
  autoReject: boolean[][];             // [tradee][trader] = true means tradee auto-rejects
  // Misc
  log: LogEntry[];                     // ring buffer, last ~50 entries
};
```

### Plan / Action discriminated union

The Java has a class hierarchy `ActionPlan ← {AttackPlan, TradePlan, ShipmentPlan, DevelopmentPlan, SelectionPlan}` plus `PlanBundle` for composition. We model these as a discriminated union; the reducer dispatches on `kind`.

```ts
export type Plan =
  | { kind: 'newGame'; setup: GameSetup; seed: number }
  | { kind: 'selection'; player: PlayerId; territoryId: number }
  | { kind: 'production' /* engine-driven, no inputs */ }
  | { kind: 'trade'; proposer: PlayerId; tradee: PlayerId; give: Stockpile; receive: Stockpile }
  | { kind: 'tradeResponse'; accept: boolean }
  | { kind: 'tradeRejectAll'; tradee: PlayerId; trader: PlayerId } // sets autoReject
  | { kind: 'horseFrom'; player: PlayerId; territoryId: number }    // post-accept horse resolution
  | { kind: 'horseTo';   player: PlayerId; territoryId: number }
  | { kind: 'shipStockpile';   player: PlayerId; from: number; to: number }
  | { kind: 'shipHorse';       player: PlayerId; from: number; to: number;
      restStop?: number; pickUpWeaponFrom?: number; moveWeaponTo?: number }
  | { kind: 'shipWeapon';      player: PlayerId; from: number; to: number }
  | { kind: 'shipBoat';        player: PlayerId; boatId: number; toX: number; toY: number;
      pickUpHorseFrom?: number; pickUpWeaponFrom?: number }
  | { kind: 'attack'; player: PlayerId; targetTerritoryId: number;
      fromTerritoryId: number;
      boatId: number | null;
      horseFromTerritoryId: number | null;
      weaponFromTerritoryId: number | null }
  | { kind: 'alliesDecision'; player: PlayerId; choice: 'attacker' | 'neutral' | 'defender' }
  | { kind: 'resolveCombat' /* engine-driven once allies are settled */ }
  | { kind: 'buildCity';   player: PlayerId; territoryId: number; payInGold: boolean }
  | { kind: 'buildWeapon'; player: PlayerId; territoryId: number; payInGold: boolean }
  | { kind: 'buildBoat';   player: PlayerId; territoryId: number; lakeId: number; payInGold: boolean }
  | { kind: 'endPhase';    player: PlayerId }   // Finished Trading / End Conquest / End Development
  | { kind: 'loadGame'; state: GameState }
  | { kind: 'loadMap'; mapText: string };
```

## Constants (carried over verbatim from Gettman)

```ts
// LocAI personality codes (lh.getPlayerStatus return values)
export const PERSONA_HUMAN      = 0;
export const PERSONA_PASSIVE    = 1;
export const PERSONA_DEFENSIVE  = 2;
export const PERSONA_AGGRESSIVE = 3;

// LocAI scoring weights — exact values from LocAI L15..L50
export const ptCity                    = 8;
export const ptStockpile               = 15;
export const ptRatingsBoundary         = 50;
export const ptCanBuildCity            = 8;
export const ptCanBuildWeapon          = 3;
export const ptCanBuildBoat            = 2;
export const ptTerrWRes                = 2;
export const ptOppWinCity              = -10000;
export const ptFCAdvOwnTerr            = 1;
export const ptFCAdvOppTerr            = 1;
export const ptFCDisOwnTerr            = -5;
export const ptFCDisOppTerr            = -3;
export const ptVulnerableHorse         = -2;
export const ptVulnerableWeapon        = -6;
export const ptVulnerableBoat          = -4;
export const ptVulnerableCity          = -8;
export const ptFCDisStockpile          = -5;
export const ptFCAdvStockpile          = 1;
export const ptGroupHorseWeapon        = 1;
export const ptGroupBoatHW             = 1;
export const ptOwnForceCount           = 1;
export const ptOppForceCount           = -1;
export const ptOppBoatPotential        = -6;
export const ptResource: readonly number[]   = [7, 7, 7, 9, 7];   // by ResourceCode 0..4
export const ptOneOfEach               = 2;
export const ptIronAndCoal             = 2;
export const ptFirstOfType             = 3;
export const ptTouchTerr               = 1;
export const ptTouchTerrWResource      = 2;
export const ptTerrVulnerable          = -5;
export const ptTouchOwnTerr            = 1;
export const ptTouchOwnTerrWResource   = 2;

// Phase-skip probability (LocApplet L2890)
export const PHASE_SKIP_PROBABILITY    = 1 / 6; // ~16.67% — applied to Production, Trade, Shipment

// Map gen (LocApplet L3650-L3680)
export const LAND_BUDGET_WITH_BOUNDARY    = { small: 547, medium: 410, large: 274 };
export const LAND_BUDGET_WITHOUT_BOUNDARY = { small: 640, medium: 480, large: 320 };
export const LAKE_ANNEX_THRESHOLD         = 9;     // assessLakes(9): regions <9 get annexed
export const ISLANDS_SOME_PROBABILITY     = 0.25;  // fall-through to existing-land adjacency

// UI / pacing
export const COMBAT_FLICKER_MS_PER_DIE = 50;       // total ~ 50 * (attackerStr + defenderStr)
export const AI_THINK_PAUSE_MS         = 1000;     // UI inserts; AI decision is synchronous

// Pool sizes
export const MAX_PLAYERS         = 7;
export const MAX_TERRITORIES     = 64;
export const MAX_BOATS           = 256;
export const MAX_LAKES           = 256;
export const SQUARES_PER_TERRITORY_CAP = 99;       // matches Territory.parts[99]
export const GRID_WIDTH  = 40;
export const GRID_HEIGHT = 20;

// Map encoding alphabet (LocApplet L3935 — 64 chars)
export const MAP_ENCODE_ALPHABET =
  '123456789ABCDEFGHIJKLMNPQRSTUWXYZabcdefghijklmnpqrstvwxyz@$%&*()';
```

## Turn structure

### Pre-game

1. **Setup wizard** (UI replacement for Gettman cards 0–7 + 9). Covers:
   - Players (2–7): per-slot color, name, persona.
   - Cities to win (3–8).
   - Element of chance (Low / Medium / High).
   - Randomize player order (default on).
   - Map options: water boundary, water area (small / medium / large), territory count, islands (none / some / lots), shapes (regular / irregular).
   - Resource density (8 modes: fixed × {very low, low, medium, high}, random × {very low, low, medium, high}).
   - Generate map → preview → "Use this map" / "Redo same params" / "Redo new params" / "Load map text" / "Save map text".
2. **Selection phase** (one-time). Each player in turn order picks one unowned territory; this draft repeats until each player has selected as many as `numTerritories / numPlayers + ε` rounds, ending when `terrSelected + numPlayers > numTerritories`. After selection, **turn order is reversed** (matches `mouseReleased` cardNo==10 L6107–L6116).

### Each year, in order

The phase order: **Production → Trade → Shipment → Conquest → Development → next year.**

After Development, `plOrder` rotates by 1 (the last player goes first next year).

#### Production phase

- 1/6 probability of being skipped this year for *all players*; on skip, show a random `reasons.txt` flavor message (the file contains 21 entries, e.g. "Plagues of Cockroaches", "Y2K Bug", "Presidential Vote Recounts").
- For each player in turn order, walk all their territories:
  - Resource codes 0–3 (Iron, Coal, Tree, Gold): +1 to that resource in player's stockpile. **+2 if `hasResourceDouble`** (a city has activated this resource — see City rules).
  - Code 4 (Stable): produces a Horse via `addHorse`:
    - If the territory is empty of horses, place a horse on it.
    - Otherwise, recursively try a 4-neighbor that's also owned by the same player and lacks a horse, biased random. If no neighbor qualifies, the horse is lost (no stockpile increment for excess).
- After production, if any player has a non-empty stockpile but `stockpileLocation == null`, force a "Locate Stockpile" interaction — they must pick one owned territory to drop the stockpile on.

#### Trade phase

- 1/6 skip probability. Skipped phases show a `reasons.txt` line and advance.
- **At 2 players, the entire phase is skipped** (LocApplet L2897).
- For each player in turn order:
  - May propose any number of trades to other players. A trade is `{ give: Stockpile, receive: Stockpile, tradee }` where amounts come from current stockpile.
  - **Trading horses requires "Horse From"/"Horse To" resolution** — the giver picks one of their territories that has a horse to send, and the receiver picks a territory that lacks one. Validator pre-rejects trades where either side wouldn't have enough territories without horses to receive.
  - Tradee accepts, rejects, or "Reject All Trades from `<player>`" which sets `autoReject[tradee][trader] = true` for the rest of the *year*.
  - **Triple-reject lockout:** the same `(trader, tradee, give, receive)` cannot be proposed more than 3 times in one year (`isTradeAlreadyRejected`).
  - "Finished Trading" advances to the next player in this phase.
- AI proposes trades using `LocAI.getProposedTradePlan` (see *AI* section). AI tradees evaluate via `decideTradeAction`.

#### Shipment phase

- 1/6 skip probability.
- Each player gets **one** shipment per turn. Options:
  1. **Move stockpile** to any owned territory.
  2. **Ship horse** to an adjacent owned territory, OR to a 2-hop owned territory provided an intermediate owned tile bridges them. May "rest stop" at intermediate tile to drop a weapon there or pick one up. If destination already has a horse, the moved horse is consumed (Gettman: `addResources(4, -1)`).
  3. **Ship weapon** to an adjacent owned territory (1 hop only).
  4. **Move boat** along connected water (must be on the same lake). May embark a horse (from boat's territory) and/or a weapon.

#### Conquest phase

- Each player gets **up to 2 attacks** per turn. Move-stockpile is allowed *between* attacks but consumes the second attack opportunity if used (LocApplet L2103).
- Click adjacent enemy/unowned tile → compute attacker/defender/others force counts → optionally Bring Forces / Allies.
- **Bring Forces** (overlay): pick committable units:
  - A horse from any tile within 2 hops via owned-tile chain. Adjacent horses are *already counted* in defender-side adjacency; a "brought" horse from non-touching adds **+1** to attacker (`executePlan(AttackPlan)` L1907–L1909).
  - A weapon from an adjacent owned tile. Adjacent weapons already counted; bringing from non-touching adds **+3** (L1911–L1916).
  - A boat docked at a tile adjacent to the target. Bringing a boat adds **+2** (L1892, L6912). The boat may carry 1 horse and/or 1 weapon for additional offensive support.
- **Allies** (overlay): for every non-attacker non-defender player who has any force on the bordering tiles, ask their decision: ally with attacker / neutral / ally with defender. AI uses `decideAlliesAction`. Players must respond before Attack is enabled.
- **Auto-prevent suicide**: at Element of Chance Low or Medium, if `attackerStrength + 6 < defenderStrength`, the Attack control is disabled with a "LOSE!" indicator. This applies to AI as well as humans.
- **End Conquest** advances to next player. If the conqueror now owns *every* territory, jump to game-over.

#### Development phase

- Each player in turn order spends stockpile resources to build:

  | Build  | Resource cost                                       | Gold alternative | Restriction                                         |
  |--------|-----------------------------------------------------|------------------|-----------------------------------------------------|
  | City   | 1 iron + 1 coal + 1 tree + 1 gold                   | 4 gold           | Max 1 per territory; activates adjacent resources    |
  | Weapon | 1 iron + 1 coal                                     | 2 gold           | Max 1 per territory                                 |
  | Boat   | 3 tree                                              | 3 gold           | Coastal territory only; multiple allowed; must pick lake if territory touches more than one |

- Boat builds use `addBoat(territoryId, lakeId)`. Possible failures:
  - "Selected territory is landlocked" (no water-touch).
  - "All Ports Full" (no `-1` water square adjacent on the chosen lake).
  - "Dock Strike" (256-slot pool exhausted across the whole game).
- "End Development" advances to the next player in this phase.
- After all players develop, **end-of-game check** runs (see Victory).

### Year wrap-up

After Development:

1. Run `checkEndOfGame`.
2. Eliminate any player with `terrCount == 0`. They drop from `turnOrder`; `numPlayers` decrements; `chTradee`-equivalent is rebuilt.
3. Rotate `turnOrder` by 1 (last player goes first next year).
4. `year++`.
5. Clear year-scoped trade state: `autoReject`, `rejectedTrades`.

## Combat (exact)

Force count for territory `T` (per `getForceCount` LocApplet L2242–L2316):

```
For each tile S in (T itself ∪ tiles adjacent to T):
  If S is owned by some player p:
    fc[p] += 1
            + (S has Horse  ? 1 : 0)
            + (S has City   ? 2 : 0)
            + (S has Weapon ? 3 : 0)
    If S == T (the central tile only):
      fc[p] += 2 × (number of valid Boats docked at T)
  Else:
    fc[NATIVES] += 1
```

So adjacent friendly territories' **horses** (+1) and **weapons** (+3) and **cities** (+2) all propagate to `T`'s defense. Boats only contribute on the central tile. This differs from the Wikipedia-derived rule the previous spec used; **trust this formula, not Wikipedia**.

**Note:** "Adjacent" means connected via the `touching[][]` matrix Gettman builds in `storeBoardInfo` (4-neighbor for squares, with two squares belonging to different territories making those territories touch).

### Bringing forces

The "bring" mechanism adds units to the attacker side beyond what they already have via adjacency:

- Bring a horse from a non-touching owned tile within 2 hops: **+1**.
- Bring a weapon from a non-touching owned tile within 1 hop (yes, Gettman allows this — see L6646 distance check): **+3**.
- Commit a boat docked adjacent to target (boat must be on a lake bordering `T`): **+2**.
- Boat may carry 1 horse and/or 1 weapon for extra offensive contribution.

Brought units leave their source square and arrive on the target if the attack succeeds; if the attack fails, brought units are destroyed.

### Resolution

By Element of Chance:

- **Low (0):** deterministic. Attacker wins iff `attackerStrength >= defenderStrength`. Tie → attacker.
- **Medium (1):** Attacker wins iff `attackerStrength > defenderStrength`. Tie → coin flip via seeded RNG.
- **High (2):** probabilistic combat. While both > 0, flip seeded coin: <0.5 decrements `attackerStrength`, else decrements `defenderStrength`. Attacker wins iff `defenderStrength == 0` at end. Closed-form in `LocProb.probSuccess(att, def)` for analysis/UI display:
  - `att <= 0 → 0`
  - `def <= 0 → 1`
  - `att == 1 → 0.5^def`
  - `def == 1 → 1 − 0.5^att`
  - else: `Σₖ₌₀..att-1 C(att+def-1, k) / 2^(att+def-1)`.

### Post-attack effects

On attacker win:

- Target territory's owner becomes the attacker.
- All boats docked at target re-flag to attacker ownership (L2093–L2100).
- Defender's horse (if any) is removed; if attacker did **not** bring a horse and the target had one, attacker gains +1 in stockpile slot 4 (L2062–L2070).
- Defender's weapon (if any) similarly transfers if attacker didn't bring one (L2071–L2073).
- If target held the defender's stockpile, **all stockpile slots 0–3** transfer to attacker, defender's slots 0–3 zero out, `stockpileLocation[defender] = null`, `STOCKPILE` icon removed from target (L2083–L2092). Slot 4 (horses) is **not** swept.
- Run the city-activation sweep on every territory to recompute `hasResourceDouble`.

On attacker loss:

- Brought units (horse, weapon, boat-cargo) are destroyed.
- Target unchanged.
- Cleanup of replan-scratch state.

## Map generation (exact)

Implements `LocApplet.generateMap` L3625–L3849.

```ts
function generateMap(seed: number, params: MapParams): { squares: Square[]; territories: Territory[] }
```

1. **Initialize.**
   - 40×20 squares all set to "open water" (`territoryId = null`).
   - If `params.waterBoundary`: outermost ring marked `isBoundaryWater = true` (this prevents seed picks on the ring).
   - All `lakeId = null`.

2. **Compute land budget** `landBudget`:
   - `params.waterBoundary == true`: small=547, medium=410, large=274.
   - `params.waterBoundary == false`: small=640, medium=480, large=320.

3. **Per-territory budget**: `perTerr = floor(landBudget / numTerritories)`. If `params.shapes == 'irregular'`, subtract 2 from `perTerr`.

4. **Min territory size**: `9 - 2*shapesIdx` = 9 (regular) or 7 (irregular).

5. **For each territory `n` from 0 to numTerritories-1:**
   1. Pick a random seed square. Range respects water boundary.
   2. **Continent constraint:** for `n > 0`:
      - `islands == 'none'`: re-pick until adjacent to existing land.
      - `islands == 'some'`: with 25% probability force adjacency; else free pick.
      - `islands == 'lots'`: free pick.
   3. Add seed to territory `n`. Record parity `(seedX % 2, seedY % 2)`.
   4. **Grow until budget met or stuck:**
      - Find growable squares (parts with at least one open-water neighbor).
      - Pick a random growable square, pick a random starting direction `d = floor(rng×4)*2` (0/2/4/6 → E/N/W/S), try in clockwise order until a `-1` neighbor is found, place that square.
      - If `params.shapes == 'irregular'`, additionally jump 2 squares same-direction if that further square is also `-1` and budget remains and matches parity.
   5. **Reject undersized:** if `squareCount < minSize`, un-place all squares of this territory and decrement `n` (retry this index).

6. **`assessLakes(LAKE_ANNEX_THRESHOLD = 9)`:** sweep unvisited water; regions <9 cells are annexed into the territory immediately above them (or below if `y == 0`). Regions ≥9 become a numbered lake; each touching land territory gains that lake id in `bordersLakes`.

7. **`storeBoardInfo`:** build `touching` adjacency and `distance` BFS table.

### Resource placement (LocApplet L3346–L3409)

Density mode determines counts:

- **Fixed Very Low / Low / Medium / High:** place exactly `numPlayers - 2 / -1 / +0 / +1` copies of *each* of the 5 resources. Mode "Medium" gets `+1` extra Stable. (Very Low at 2 players is disabled in the UI.)
- **Random Very Low / Low / Medium / High:** distribute one resource type at a time round-robin via `resourceOrder = [TREE, GOLD, STABLE, IRON, COAL]` until a target fraction of territories carry resources: 0.20 / 0.35 / 0.50 / 0.65.

### Save / Load map text

Encode 20 lines × 40 chars where each char is a territory's index in `MAP_ENCODE_ALPHABET` (64 chars), `.` for water, then footer:
```
#
#########################################
Created by LOC Map Generator
```

Decode parses the same alphabet via flood-fill `addSquaresToTerr`. Validation errors:

- `-1`: fewer than 20 rows or row too short.
- `-2`: a territory has < 7 squares (always 7 for loaded maps regardless of shapes).
- `-3`: `numTerritories` not in `[20, 64]`, or fewer than `7 × numPlayers` territories.

Loaded maps run `assessLakes(1)` (annex no water).

## AI

The AI is structurally encoded — different personas take different *branches*, not different *weights*. There is no single weights vector that is "the persona."

```ts
// Pure function. All randomness routes through state.seed/state.rngCursor.
ai.decideAction(state: GameState, player: PlayerId): Plan;
```

`decideAction` switches on `state.currentPhase`, mirroring `LocAI.decideAction` (L2927):

| Phase | Method |
|---|---|
| selection | `decideSelectionAction` |
| stockpile-locate (post-production sub-phase) | `decideStockpileAction` |
| trade | `getProposedTradePlan` |
| shipment | `decideShipmentAction` |
| conquest | `decideConquestAction` |
| development | `decideDevelopmentAction` |

Plus secondary entry points the engine calls directly:

- `decideTradeAction(state, player, tradePlan): boolean` — accept/reject incoming trade.
- `decideAlliesAction(state, player, attackPlan): 'attacker' | 'neutral' | 'defender'`.

### Personality short-circuits

Read `state.players[player].persona`:

- **Passive:** in *every* phase, returns the empty/no-op plan. Never proposes trades, accepts trades, allies, attacks, or develops. (Selection still happens — see `decideSelectionAction`.)
- **Defensive:** scoring functions are identical to Aggressive, but the conquest gate at `decideConquestAction` requires `attackerEffectiveForce > defenderEffectiveForce` OR a city-block scenario (`bl == true` in L1822–L1825 — defender is the leader, has `numCitiesToWin` cities, and target has the city). All other phases fall through to the same code path as Aggressive.
- **Aggressive:** uses raw utility scores. Plus: in Development, two extra fallback heuristics fire when no positive-utility plan was found — try-build-a-boat and try-build-a-weapon (L514–L604).

### Per-phase method outlines

Each method below is implemented as a pure function in `src/game/ai/`. All cite line refs in `LocAI.java`. See *AI scoring details* in the appendix of this spec for full formulas.

- `decideSelectionAction` (L2800–L2925): score every unowned territory with a sum of `ptResource[r]`, diversity bonuses (`ptOneOfEach`, `ptIronAndCoal`, `ptFirstOfType`), touch bonuses, vulnerability penalty. Pick max-score territory, emit `SelectionPlan`.
- `decideStockpileAction` (L2728–L2798): for each owned territory, score by force advantage, enemy boat potential on touching lake, distance-2 horse rush penalty, and a +3 "safe spot" bonus. Pick best.
- `getProposedTradePlan` (L801–L1014): compute own `BFPossible` and power rating. For each opponent: compute fairness factor `f` from power-rating delta, propose iron/coal-balancing trades, then enumerate up to 3-vs-3 generic offers; accept proposals that improve own utility AND would be accepted by opponent (1-level lookahead via opponent's AI).
- `decideTradeAction` (L1016–L1038): symmetric — fairness factor, then `getTradeUtility(plan, fairness) > 0`.
- `decideShipmentAction` (L2386–L2533): enumerate moves (stockpile relocation, horse 1-2 hop, weapon 1 hop, boat moves with embarkation), score each via `getShipmentUtility`, pick max.
- `decideConquestAction` (L1701–L1990): build allies-decision matrix (recursively call other AIs), then for each potential target territory enumerate attack plans (plain, with adjacent horse/weapon, two-hop weapon shipping, boat assault from any docked boat). Score each via `getConquestUtility`, gate by personality, pick max.
- `decideAlliesAction` (L1530–L1615): branch on whether defender is unowned, on whether the attack would block a city-win, and finally on power-rating delta with `ptRatingsBoundary = 50` thresholds.
- `decideDevelopmentAction` (L172–L624): budget loop (max 100 iterations) that evaluates 4 candidate plan bundles per territory: just-weapons, city+weapons, boat+weapons, boat+city+weapons. Aggressive adds 2 fallback heuristics if nothing scored positive.

### Helper / utility methods

- `getBFPossible(state, player)` (L109–L170): for each territory, max enemy "battle force" reachable. Returns `int[numTerr][7]`.
- `getPowerRatingForPl(state, player, attackPlan?)` (L1617–L1699): overall strength score for trade fairness and ally decisions.
- `getStockpilePoints(state, player, stockpile, BFPossible)` (L1274–L1308).
- `getDevelopmentUtility(state, planBundle, BFPossible)` (L631–L799).
- `getTradeUtility(state, plan, fairness, BFPossible)` (L1310–L1528) — includes the **kingmaker bonus**: trades that would push someone over `numCitiesToWin` get ±100/±1000 swings; trades involving ≥2 horse-resource units get -10000 (never trade horses en masse).
- `getConquestUtility(state, plan, BFPossible, alliesMatrix)` (L1992–L2384).
- `getShipmentUtility(state, plan, BFPossible)` (L2535–L2726).
- `getHorseMoveUtility`, `getTerrNoHorseToRemove`, `getTerrNoHorseToPlace` (L1040–L1272).

### AI animation

`Thread.sleep(1000)` and the animations Gettman uses **inside** AI methods are a UI concern. The AI returns a plan synchronously; the UI inserts `AI_THINK_PAUSE_MS = 1000` between each AI sub-action it animates so a human watching can follow what's happening. AI ally polling becomes synchronous because all AIs in our model live in the same process.

## UI

Replace Gettman's 42-card AWT CardLayout with **one main screen** plus context-sensitive overlays. Same affordances — fewer mode-switches, clearer information density.

### Main screen layout (CSS Grid, desktop ≥ 1280)

- **Top bar (56px):** title, year, current phase, current player avatar, "End Phase" / "End Turn" / "Attack" button (label changes by phase), "Scouting Report" button, "New Game".
- **Left rail (240px):** vertical player list. Each row = avatar, name, persona badge, territory count, city-progress bar, expandable stockpile (5 resource counts). Current player highlighted.
- **Center (flex):** the board. CSS Grid of 40×20 `<button>` cells. Each cell paints the territory color (or sea), borders matched to neighbors via `Square.neighbors[]` to make territories visually contiguous. In-tile glyphs: resource (single SVG icon for Iron/Coal/Tree/Gold/Stable), unit overlays (City, Weapon, Horse, Stockpile, boats stack on coast). Hover shows force-count tooltip. Click selects; phase-appropriate second action (attack target / shipment dest / build target).
- **Right rail (300px):** selected-tile detail (owner, resource, items, force-count breakdown), context-sensitive action buttons, scrolling event log (last ~10 from `state.log`).

### Overlays (modals or side panels — not full-screen card flips)

- **New game wizard** (replaces cards 0–9): a single multi-step form with players, options, and map preview. "Use this map / Redo same / Redo new / Save text / Load text".
- **Resource placement** (replaces card 9): only shown if Random density mode is chosen and user wants to drag-drop redistribute. Default = auto-distribute, button to "Redistribute" or "Manual" mode.
- **Trade panel** (replaces 13–17): split view of proposer/tradee stockpiles, give/take counters, "Propose" / "Accept" / "Reject" / "Reject All". Horse-from / Horse-to picks happen as in-board click prompts after acceptance.
- **Shipment overlay** (replaces 18–22): the right rail's action area becomes the shipment chooser when a tile is selected during the Shipment phase. Move stockpile / horse / weapon / boat — each leads to a destination prompt overlaid on the board (highlighted candidate tiles).
- **Conquest overlay** (replaces 23–30): selected enemy tile triggers the right rail to show attacker/defender breakdowns, "Bring Forces" button (opens a panel for committing horse / weapon / boat / boat-cargo), "Allies" button (opens an allies panel that polls each non-combatant), then "Attack". On Low/Medium chance, "LOSE!" badge replaces Attack if `attackerStrength + 6 < defenderStrength`.
- **Allies panel** (replaces 25): one row per non-combatant player, with their decision (attacker / neutral / defender). AI decisions auto-fill; humans click. Attack disabled until all responses in.
- **Development panel** (replaces 31–32): bottom sheet listing buildable items at the selected tile with cost preview and "Pay in resources / pay in gold" toggle. Boat builds prompt for lake when ambiguous.
- **Combat dialog** (replaces 24's resolution flicker): brief animated sequence of `COMBAT_FLICKER_MS_PER_DIE × (att+def)` total duration, then a result panel with strength breakdown, dice trace if elementOfChance == high, win/loss summary.
- **Scouting Report** (replaces 34–38): right-side drawer with tabs: Force Count (click any tile, see per-player breakdown), Stockpiles (paged through players), Save Map (text dump), Boat Info (click any boat).
- **Phase-skip toast** (replaces 39): non-blocking toast at top showing "Phase skipped: <reason from reasons.txt>".
- **Game over** (replaces 33): full-screen result with winner, year count, "Play Again" → setup wizard.
- **Generic message** (replaces 40): toast.
- **AI thinking indicator** (replaces 41): inline spinner on current player's row in the left rail.

### Visual design

- Modern flat: rounded tiles (4px radius), 16-color palette, sans-serif (Inter), generous whitespace.
- **Player colors** match Gettman's order so existing maps render consistently: red, blue, cyan, purple, orange, green, yellow.
- **Resource glyphs** = original-style icons rendered as SVG (one for each of Iron, Coal, Tree, Gold, Stable). Pixel-art GIFs from `loc.jar` are reference, not used directly.
- **Boat sprite** uses the player color; a single SVG boat path tinted, rather than the 7 separate PNGs Gettman shipped.

## Save / load

Two distinct flows.

### Game state save / load (modern addition Gettman lacks)

- Storage: `localStorage`, namespaced under `loc:save:`.
- Slots: `loc:save:autosave` (every reducer call, debounced 500ms) and `loc:save:slot1..slot3` (user-named).
- Format: `{ schemaVersion: 1, savedAt: ISO8601, state: GameState }` — `JSON.stringify(state)`.
- Load: parse JSON, check `schemaVersion`; mismatch refuses with a message (no migration in MVP).

### Map text save / load (matches Gettman exactly)

- Encode/decode via `MAP_ENCODE_ALPHABET` and the rules described above.
- Provided in the New Game wizard ("Save Map" / "Load Map") and in Scouting Report.

## Project structure

```
lords-of-conquest/
├── public/
│   ├── icons/                       # resource & item SVGs
│   └── favicon.svg
├── src/
│   ├── game/                        # pure core, runs in Node
│   │   ├── types.ts
│   │   ├── codes.ts                 # Code, ResourceCode, ItemCode enums
│   │   ├── constants.ts             # ptResource[], etc.
│   │   ├── plans.ts                 # discriminated-union Plan
│   │   ├── reducer.ts               # reduce(state, plan)
│   │   ├── rules/
│   │   │   ├── selection.ts
│   │   │   ├── production.ts
│   │   │   ├── trade.ts
│   │   │   ├── shipment.ts
│   │   │   ├── conquest.ts
│   │   │   ├── development.ts
│   │   │   └── victory.ts
│   │   ├── force.ts                 # getForceCount, helpers
│   │   ├── locProb.ts               # probSuccess, combination
│   │   ├── mapgen.ts
│   │   ├── mapTextCodec.ts          # encodeMap / decodeMap
│   │   ├── rng.ts                   # seedable mulberry32, advances state.rngCursor
│   │   └── ai/
│   │       ├── index.ts             # decideAction dispatcher
│   │       ├── personas.ts          # short-circuit rules
│   │       ├── selection.ts
│   │       ├── stockpile.ts
│   │       ├── trade.ts
│   │       ├── shipment.ts
│   │       ├── conquest.ts
│   │       ├── allies.ts
│   │       ├── development.ts
│   │       ├── helpers.ts           # getBFPossible, getPowerRatingForPl, getStockpilePoints
│   │       └── utility.ts           # getConquestUtility, getTradeUtility, etc.
│   ├── ui/
│   │   ├── App.ts                   # mounts state subscription
│   │   ├── BoardView.ts
│   │   ├── TopBar.ts
│   │   ├── PlayerRail.ts
│   │   ├── ActionRail.ts
│   │   ├── overlays/
│   │   │   ├── NewGameWizard.ts
│   │   │   ├── TradePanel.ts
│   │   │   ├── AlliesPanel.ts
│   │   │   ├── BringForcesPanel.ts
│   │   │   ├── DevPanel.ts
│   │   │   ├── CombatDialog.ts
│   │   │   ├── ScoutingReport.ts
│   │   │   └── PhaseSkipToast.ts
│   │   ├── icons.ts                 # SVG glyph factory
│   │   └── styles.css
│   ├── platform/
│   │   ├── storage.ts               # localStorage save/load
│   │   ├── urlSeed.ts               # ?seed=… roundtrip
│   │   └── reasons.ts               # bundles reasons.txt as a string array
│   └── main.ts
├── tests/
│   ├── reducer/
│   │   ├── selection.test.ts
│   │   ├── production.test.ts
│   │   ├── trade.test.ts
│   │   ├── shipment.test.ts
│   │   ├── conquest.test.ts
│   │   └── development.test.ts
│   ├── ai/
│   │   ├── personas.test.ts
│   │   ├── conquest.test.ts
│   │   └── trade.test.ts
│   ├── mapgen.test.ts
│   ├── locProb.test.ts
│   ├── mapTextCodec.test.ts
│   └── snapshots/
│       └── canonical-game.test.ts   # 50-action sequence, full state snapshot
├── docs/
│   └── superpowers/specs/2026-05-06-clean-room-port-design.md  ← this file
├── index.html                       # current CheerpJ embed (kept until port reaches feature parity)
├── loc.jar                          # binary reference; remove once the port replaces it as the default
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Testing

- **Unit tests** for `src/game/` with Vitest. Pure functions, no mocks.
- **Snapshot tests** of canonical action sequences under fixed seeds. The "canonical game" test runs ~50 actions through 3 years and freezes the resulting state.
- **Property tests** for `mapgen`:
  - Land tile count == sum of territory `squareCount` == requested `numTerritories × perTerr`-ish.
  - All players reachable.
  - Resource density matches the chosen mode within tolerance.
  - Lake annex below threshold leaves no orphan water islands.
- **`LocProb.probSuccess` parity test** — assert the closed-form matches a Monte-Carlo simulation for a representative grid of (att, def) values to within tolerance.
- **AI persona tests:**
  - Passive AI returns no-op plan in every phase.
  - Defensive AI never attacks unless `attackerForce > defenderForce` or city-block scenario.
  - Aggressive AI's selection-phase pick differs from Defensive given a contrived weighting of resources.
- **Behavior parity smoke tests** (manual): play the same opening 5 turns in the CheerpJ build and the new build with the same seed and confirm equivalent state.
- No automated UI tests in MVP. Manual smoke testing in browser before release.

## Deployment

`vite build` produces a static `dist/`. Deploy to GitHub Pages from `gh-pages` branch.

URL form: `https://<user>.github.io/lords-of-conquest/?seed=abc123`.

The CheerpJ embed at `/` stays available as a fallback under `/legacy/` until the TypeScript port hits feature parity, at which point `/` flips to the TS build and the legacy embed remains accessible at `/legacy/`.

## Open questions / deferred decisions

- **Animation polish.** The combat flicker, AI thinking indicator, and shipment animations need UX iteration. Specs are timing only; visual style settled in the polish pass.
- **Whether to keep Gettman's "doubling" of cities affecting Gold resources.** The Java code excludes resource code 4 (Stable) from the city doubling sweep but **includes** Gold (code 3) — so Gold tiles do get doubled by adjacent cities. This is non-obvious and may surprise players; we keep Gettman's behavior in MVP and add a balance toggle later if needed.
- **Tutorial / onboarding.** Lords of Conquest is obscure enough that visitors will need handholding. Out of MVP scope but should follow the same architecture (a lightweight overlay that highlights elements based on `state.currentPhase`).
- **Mobile / responsive.** Out of MVP. The 40×20 grid does not shrink elegantly to a phone; either crop with pan/zoom or rebuild the board with hex-style layout — neither is a small project.
- **License clearance for `loc.jar`.** The CheerpJ embed redistributes Gettman's binary. Reach out to Gettman for permission before going fully public. The TypeScript port itself is clean-room re-implementation informed by decompiled reference and is not a derivative work.

## Appendix: AI scoring formulas (cited)

This appendix documents the exact scoring functions for each phase. Implementations cite line numbers in `/tmp/loc-applet/decompiled/LocAI.java`.

### `getStockpilePoints` (L1274–L1308)

```
score  = ptCanBuildCity   × min(min(iron,coal), (timber-min)/2 + min(stone,timber))
       + ptCanBuildWeapon × (excess iron+coal pairs and timber pairs capped by weapon vacancies)
       + ptCanBuildBoat   × (extra wood / 3)
       + horseDelta × (horsePlaceUtility or horseRemoveUtility) / 10
```

### `getTradeUtility` (L1310–L1528)

```
score = (post.myStockpilePoints - pre.myStockpilePoints)
      - fairness × (post.theirStockpilePoints - pre.theirStockpilePoints)
      + kingmakerAdjustment
      + horsePenalty                  // -10000 if horse-resource ≥ 2 in either direction
      + stockpileLossPenalty          // -100 if my stockpile would be left under-defended
```

`kingmakerAdjustment`:

| Situation | Delta |
|---|---|
| Trade pushes opponent over `citiesToWin` | -100 (bad, but not -10000 unless sole leader) |
| Trade lets *me* win | +1000 |
| Sole leader trade pushes them to win | -1000 |

### `getConquestUtility` (L1992–L2384)

For target tile `T` on **win**:

```
f2 += 2.0                                        // base for taking T
f2 += ptResource[r] if T has resource
f2 += 1.0 if T has horse, +1.0 extra if attacker did NOT bring own horse
f2 += 3.0 if T has weapon, +3.0 extra if attacker did NOT bring own weapon
f2 += 4.0 × T.boatCount
f2 += 12.0 if T has city
f2 += 5 × stockpileSum if T held defender stockpile  // -ptFCDisStockpile × sum
f2 += ptOppWinCity (-10000) if defender is leader at threshold AND I am behind
```

For non-target adjacent terrs with resources: `+ptTerrWRes (=2)`.

Per territory, force-balance score on **win** (`f2`) and **loss** (`f`):

```
own & winning: ptFCAdvOwnTerr × min(diff, 20) + ptFCAdvStockpile × min(diff, 20) [if has stockpile]
own & losing : ptFCDisOwnTerr (-5)
             + ptVulnerableHorse  (-2) if has horse
             + ptVulnerableWeapon (-6) if has weapon
             + ptVulnerableCity   (-8) if has city
             + ptVulnerableBoat   (-4) per own boat
             + ptFCDisStockpile × stockpileSum (-5×sum)
other terr  : ptFCAdvOppTerr × min(diff, 20) if winning; else ptFCDisOppTerr (-3)
resources   : ±ptResource[r]
```

Then combine by `elementOfChance`:

```
chance == low:    f3 = (att >= def) ? f2 : f
chance == medium: f3 = att > def ? f2 : att == def ? (f2+f)/2 : f
chance == high:   f3 = d × f2 + (1-d) × f   where d = LocProb.probSuccess(att, def)
```

### `getShipmentUtility` (L2535–L2726)

Per terr, hypothetical force balance after shipment:

```
own & winning: ptFCAdvOwnTerr × min(diff, 20)
own & losing:  ptFCDisOwnTerr (-5)
               + ptVulnerableHorse / Weapon / City / Boat as above
aggressive only: also score opp terrs
resources: ±ptResource[r]
stockpile: ptFCAdvStockpile × min(diff, 20) when winning; -3 if any opp reaches it
           ptFCDisStockpile × stockpileSum when losing
group:     +ptGroupHorseWeapon if horse + weapon co-located
           +ptGroupBoatHW       if boat + (horse or weapon)
```

### Selection scoring (L2800–L2925)

```
score = ptResource[r] if r != null
      + diversity bonuses:
          ptFirstOfType    if this is first of resource r I'd own
          ptIronAndCoal    if I have iron < coal (or symmetric)
          ptOneOfEach      if r is the minimum among my owned counts
      + ptTouchTerr / ptTouchTerrWResource for adjacent unclaimed
      + ptTerrVulnerable (-5) if any opponent has FC ≥ mine + 2 here
      + ptTouchOwnTerr / ptTouchOwnTerrWResource for adjacent own (defensive/aggressive only)
```
