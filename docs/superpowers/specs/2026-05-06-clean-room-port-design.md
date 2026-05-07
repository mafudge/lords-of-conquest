# Lords of Conquest — Clean-Room Port Design

**Status:** Deferred. The current MVP is a CheerpJ embed of Randy Gettman's original Java applet (`/index.html` + `/loc.jar`). This spec describes a future clean-room TypeScript port that may follow once the embed is shipped.
**Date:** 2026-05-06

## Overview

A browser-based clean-room remake of the 1986 Electronic Arts strategy game *Lords of Conquest*. Single-player against 1–3 AI opponents. Runs entirely client-side from a static site. Built as a portfolio piece — code clarity, polish, and demonstrable AI matter.

The game is faithful to the original ruleset (5 resources, 5-phase turn, strength-by-adjacency combat, city-based victory) with modern, voluntary trading and deterministic seeded RNG for reproducible games.

This is **not** a port of Gettman's applet bytecode; that is a separate (Option 1) project that would decompile `loc.jar` and translate the existing Java logic class-by-class.

## Goals

- Faithful implementation of the original ruleset (per Wikipedia: https://en.wikipedia.org/wiki/Lords_of_Conquest).
- Clean, readable, well-tested TypeScript codebase suitable for a portfolio.
- Responsive AI with three distinct personas (aggressive / defensive / passive) — the original game's archetypes.
- Procedural map generation parameterized by territories, continents, islands, and terrain variance.
- Save/load to `localStorage`; resume in-progress games.
- Static-site deploy (GitHub Pages or Vercel).

## Non-goals (out of scope for MVP)

- Hotseat or networked multiplayer.
- Built-in tutorial / onboarding (deferred to near-term post-MVP).
- Sound effects and music.
- Mobile / responsive layout.
- Map editor.
- Replay viewer.
- Preset / shipped maps (procedural only).

## Tech stack

- **Language:** TypeScript (strict mode).
- **Build / dev server:** Vite.
- **UI:** Plain DOM + CSS Grid for the board. No UI framework. Modern flat aesthetic — rounded tiles, sans-serif typography, vivid palette, all SVG/CSS, no sprite art.
- **Tests:** Vitest. Unit + property tests on pure game core.
- **Deploy:** static site to GitHub Pages or Vercel.

## Architecture

Three layers, one-way data flow.

```
┌──────────────────────────────────────────────────────────┐
│  UI (src/ui/)                                            │
│  BoardView · PhaseHUD · TradePanel · CombatDialog · Menu │
└──────────────────┬─────────────────────▲─────────────────┘
                   │ dispatch(action)    │ render(state)
                   ▼                     │
┌──────────────────────────────────────────────────────────┐
│  Core (src/game/)                                        │
│  types · reducer · actions · rules/ · mapgen · ai/       │
│  reduce(state, action) → state'                          │
│  ai.choose(state, persona) → Action[]                    │
│  generateMap(seed, params) → board                       │
└──────────────────┬─────────────────────▲─────────────────┘
                   │ save(state)         │ load() → state
                   ▼                     │
┌──────────────────────────────────────────────────────────┐
│  Platform (src/platform/)                                │
│  storage (localStorage) · urlSeed (?seed=…)              │
└──────────────────────────────────────────────────────────┘
```

**Invariants:**

- UI never imports from platform. All persistence flows through core.
- Core has zero browser dependencies. Runs in Node for tests.
- Click → action → reducer → new state → render. No back-channels.
- `GameState` is immutable. Every reducer call returns a fresh object.

## Data model

```ts
type ResourceKind = 'coal' | 'gold' | 'iron' | 'timber' | 'horses';
type Persona      = 'aggressive' | 'defensive' | 'passive';
type Phase        = 'production' | 'trade' | 'shipment' | 'conquest' | 'development' | 'gameOver';
type PlayerId     = 0 | 1 | 2 | 3;

type Territory = {
  id: number;
  x: number;
  y: number;
  terrain: 'land' | 'sea';
  continentId: number;            // -1 for sea
  coastal: boolean;               // adjacent to sea (boats may be built here)
  waterBorders: number;           // count of bordering sea tiles — caps boats
  owner: PlayerId | null;
  resource: ResourceKind | null;
  hasCity: boolean;               // max 1
  hasWeapon: boolean;             // max 1
  horses: number;                 // 0 or 1 (one horse per territory)
  boats: number;                  // 0..waterBorders
};

type Player = {
  id: PlayerId;
  name: string;
  color: string;                  // hex
  isAI: boolean;
  persona: Persona | null;        // null for human
  stockpile: Record<ResourceKind, number>;
  eliminated: boolean;
};

type MapParams = {
  width: number;
  height: number;
  territories: number;            // total land tile count
  continents: number;             // large connected components
  islands: number;                // small connected components
  variance: number;               // 0..1 — coast irregularity
  resourceMix: 'balanced' | 'scarce' | 'abundant';
};

type TradeOffer = {
  from: PlayerId;
  to: PlayerId;
  offer: Partial<Record<ResourceKind, number>>;
  ask: Partial<Record<ResourceKind, number>>;
  horseLandingTerritory?: number; // required if `offer.horses` or `ask.horses` > 0
};

type CombatState = {
  attacker: PlayerId;
  defender: PlayerId;
  fromTerritoryId: number;
  targetTerritoryId: number;
  committed: { horse: number; weapon: number; boats: number };
  attackerStrength: number;
  defenderStrength: number;
  resolved: boolean;
};

type LogEntry = {
  turn: number;
  phase: Phase;
  player: PlayerId;
  message: string;
};

type GameState = {
  schemaVersion: 1;
  seed: number;
  rngCursor: number;              // monotonically advances on every dice roll
  params: MapParams;
  victoryCities: number;          // 3..8, chosen at game start
  tieBreak: 'attacker' | 'defender' | 'random';
  width: number;
  height: number;
  territories: Territory[];       // flat array, indexed by id
  players: Player[];
  turn: number;
  currentPlayer: PlayerId;
  phase: Phase;
  attacksRemainingThisTurn: number;
  shipmentUsedThisTurn: boolean;
  pendingTrade: TradeOffer | null;
  pendingCombat: CombatState | null;
  log: LogEntry[];                // ring buffer, last ~50 events
};

type Action =
  | { type: 'NEW_GAME'; seed: number; params: MapParams; players: PlayerSetup[]; victoryCities: number; tieBreak: 'attacker' | 'defender' | 'random' }
  | { type: 'END_PHASE' }
  | { type: 'PROPOSE_TRADE'; offer: TradeOffer }
  | { type: 'RESPOND_TRADE'; accept: boolean }
  | { type: 'SHIP_STOCKPILE'; from: number; to: number }       // forfeits 2nd attack
  | { type: 'MOVE_UNIT'; unit: 'horse' | 'boat'; from: number; to: number }
  | { type: 'ATTACK'; from: number; to: number; commit: { horse: boolean; weapon: boolean; boats: number } }
  | { type: 'BUILD_CITY'; territoryId: number; payment: 'resources' | 'gold' }
  | { type: 'BUILD_WEAPON'; territoryId: number; payment: 'resources' | 'gold' }
  | { type: 'BUILD_BOAT'; territoryId: number; payment: 'timber' | 'gold' }
  | { type: 'AI_TURN' }
  | { type: 'LOAD_GAME'; state: GameState };
```

## Turn phases & rules

Each turn rotates: **Production → Trade → Shipment → Conquest → Development → next player.**

### Production (25% chance to skip per turn)

For each owned land territory with a resource: +1 of that resource to owner's stockpile (+2 if the territory has, or is adjacent to, a city).

### Trade

Any player may propose 0..N trades to other players. Trades may include any of the 5 resources. The receiving player accepts or rejects. **Faithful constraint:** trading horses requires the receiver to nominate a territory (owned, with no existing horse) for the horse to land on. **Modernized:** trades are voluntary (the original made trading mandatory); AI evaluates trades using persona-weighted scoring.

### Shipment (25% chance to skip)

Once per turn, the current player either:
- **Ship stockpile:** move an entire territory's-worth of resources from one owned territory to another (forfeits the 2nd attack this turn), OR
- **Move individual units:** a horse may move up to 2 spaces along owned territories; boats move freely along connected water (a boat cannot cross land between bodies of water).

### Conquest

Up to **2 attacks** per turn. (Choosing to ship the stockpile in the Shipment phase forfeits the 2nd attack.)

**Defender strength at territory T:**
```
T.base (= 1)
  + (T.hasCity   ? 2 : 0)
  + (T.hasWeapon ? 3 : 0)
  + (T.horses    ? 1 : 0)
  + (T.boats × 2)                     // defensive boat bonus
  + Σ over friendly adjacent A of T:
        (A.horses ? 1 : 0) + (A.hasWeapon ? 3 : 0)
```
Cities and boats on adjacent territories do **not** propagate. Only horses (+1) and weapons (+3) do.

**Attacker strength at territory T:**
```
Σ over attacker-owned adjacent A of T:
        (A.horses ? 1 : 0) + (A.hasWeapon ? 3 : 0)
+ committed units (see below)
```

Pre-combat, the attacker may **commit** mobile units to the attack:
- Up to 1 horse (from any owned territory within 2 spaces) → +1
- Up to 1 weapon (from any owned territory adjacent to T) → +3
- Boats: 1 boat may ferry 1 horse and/or 1 weapon across water, contributing up to +6 offensive (boat +2, horse +1, weapon +3 — Wikipedia's "max +6 offensively").

Committed units physically leave their source territory and join the attack. They count **once** — via commitment — and do not also contribute through the adjacency sum. If the attack succeeds, they remain on the conquered territory; if it fails, they are destroyed with the rest of the attacker's loss.

**Resolution:** higher total strength wins. Ties broken per game-start setting (`attacker` / `defender` / `random` via seeded RNG). Loser's units on the contested territory are destroyed; on attacker win, the territory flips owner.

### Development

Spend stockpile to build (max one of each per territory; multiple boats allowed):

| Build | Resource cost | Gold alternative | Restriction |
|---|---|---|---|
| City | 1 coal + 1 gold + 1 iron + 1 timber | 4 gold | Max 1 per territory |
| Weapon | 1 coal + 1 iron | 2 gold | Max 1 per territory |
| Boat | 3 timber | 3 gold | Coastal territory only; max = `waterBorders` |

### Victory

First player to either:
- Build `victoryCities` cities (3–8, chosen at game start), OR
- Own every territory.

Eliminated players (zero territories owned) drop out; remaining players continue.

## Procedural map generation

```ts
generateMap(seed: number, params: MapParams) → Territory[]
```

1. **Seed RNG** — single mulberry32 instance keyed off `seed`. All randomness in mapgen draws from it.
2. **Place continent seeds** — `params.continents` points spaced apart (rejection-sampling Poisson-disk on the grid).
3. **Place island seeds** — `params.islands` more points, looser spacing constraint.
4. **Grow regions** — each seed grows by random walk until it has its target tile budget. Continent budget = `(territories × 0.7) / continents`; island budget = `(territories × 0.3) / islands`. `variance` controls how often the walk picks a non-greedy direction (0 = compact circular shapes, 1 = jagged sprawling shapes).
5. **Mark sea** — any non-claimed cell becomes sea (`terrain: 'sea'`, `continentId: -1`).
6. **Tag coastal & waterBorders** — for each land tile, count 4-neighbor sea tiles; coastal = count > 0.
7. **Sprinkle resources** — Poisson-disk distribute each of the 5 resources across land tiles. Density adjusts by `resourceMix`. ~40% of land tiles carry a resource at `balanced`.
8. **Place starting territories** — for each player, pick a land tile farthest (graph distance) from other player starts. Player owns just that one tile at start; everything else is neutral (`owner: null`).
9. **Validate** — each player's neutral neighborhood within N tiles must contain at least one of each resource; all players must be reachable from each other (transitively, via land or via implied boat-buildable coast). Retry generation up to 5 times; if still failing, relax variance and resourceMix and retry once more.

**Determinism:** identical `(seed, params)` always yields identical maps. Seeds are URL-shareable: `?seed=abc123`.

## AI personas

```ts
ai.choose(state, persona) → Action[]
```

Each persona is a fixed weights vector applied to a shared scoring function. The AI plays its turn by enumerating legal sub-actions per phase and greedily picking the highest-scoring sequence.

**Shared scoring components:**
- `economy` = weighted resource stockpile + projected next-turn production
- `territory` = land owned + adjacency-weighted control of contested zones
- `threat` = sum of enemy strength on tiles bordering owned territories
- `cityProgress` = own cities / `victoryCities`
- `weaponPower` = weapons + horses owned

**Persona weights (illustrative — to be tuned during implementation):**

| Persona | economy | territory | threat (penalty) | cityProgress | weaponPower | Attack threshold |
|---|---|---|---|---|---|---|
| Aggressive | 0.5 | 1.5 | 0.3 | 0.7 | 1.5 | strength advantage ≥ 2 |
| Defensive | 1.0 | 0.8 | 1.5 | 1.2 | 0.8 | advantage ≥ 4 or under siege |
| Passive | 1.5 | 0.5 | 1.0 | 1.8 | 0.4 | counter-attack only |

Persona-specific behaviors layered on top of weights:
- **Aggressive:** trades freely if it gains coal or iron (weapon materials); spends every Development phase.
- **Defensive:** garrisons border tiles with horses; builds boats on coasts adjacent to enemies.
- **Passive:** races the city victory; refuses any trade that arms an aggressive neighbor.

## UI

**Single main screen** — three regions in a CSS Grid:

- **Left rail (240px):** player roster (current player highlighted), each player's stockpile, victory progress (cities-built bar), persona label for AI.
- **Center (flex):** the board. CSS Grid where each cell is a `<button>` for the territory. Tile shows: owner color, resource glyph (single letter: C/G/I/T/H), unit glyphs (city, weapon, horse, boats). Hover = highlight + adjacency preview. Click = select; second click on adjacent enemy tile during Conquest phase = attack.
- **Right rail (240px):** selected-tile detail (strength breakdown, units present), context-sensitive action buttons, and a scrolling event log (last ~10 entries from `state.log`).

**Top bar:** turn number, current phase, attacks-remaining counter, "End phase" button (red), Save / New game.

**Modals (only three):**
- **Trade dialog** — give/take resource picker, opponent selector, horse-landing tile picker (when applicable).
- **Combat dialog** — attacker/defender strength breakdown, commit-units checklist (horse, weapon, boats with their carryload), animated dice for tie-breaks, win/loss summary.
- **New game wizard** — single screen: # of players, persona per AI, map params, `victoryCities` (3–8), `tieBreak` rule.

## Save / load

- Storage: `localStorage`, namespaced under `loc:save:`.
- Slots: `loc:save:default` (autosave) and `loc:save:slot1..slot3` (named).
- Format: `{ schemaVersion: 1, savedAt: ISO8601, state: GameState }`.
- Save trigger: autosave fires on every reducer call (debounced to 500 ms); named saves are user-triggered.
- Load: parse JSON, check `schemaVersion`; if mismatch, refuse with message (no migration in MVP).

## Project structure

```
lords-of-conquest/
├── src/
│   ├── game/                   # pure core, runs in Node
│   │   ├── types.ts
│   │   ├── reducer.ts
│   │   ├── actions.ts
│   │   ├── rules/
│   │   │   ├── production.ts
│   │   │   ├── trade.ts
│   │   │   ├── shipment.ts
│   │   │   ├── combat.ts
│   │   │   └── development.ts
│   │   ├── mapgen.ts
│   │   ├── rng.ts              # seedable mulberry32
│   │   └── ai/
│   │       ├── personas.ts
│   │       └── scoring.ts
│   ├── ui/
│   │   ├── BoardView.ts
│   │   ├── PhaseHUD.ts
│   │   ├── TradeDialog.ts
│   │   ├── CombatDialog.ts
│   │   └── NewGameWizard.ts
│   ├── platform/
│   │   ├── storage.ts
│   │   └── urlSeed.ts
│   ├── styles/
│   │   └── main.css
│   └── main.ts
├── tests/
│   ├── reducer.test.ts
│   ├── combat.test.ts
│   ├── mapgen.test.ts
│   └── ai.test.ts
├── public/
│   └── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Testing

- **Unit tests** for `src/game/` with Vitest. Pure functions, no mocks.
- **Snapshot tests** of full turn sequences: given seed `S`, run actions `A₁..Aₙ`, assert final state matches snapshot. Catches reducer regressions.
- **Property tests** for mapgen invariants:
  - Land tile count equals `params.territories`.
  - Connected-component count of land equals `continents + islands`.
  - All players reachable from each other via land/coast.
  - Each player's neighborhood has at least one of each resource.
- **AI persona tests:** feed contrived states, assert chosen action category (attack vs build vs trade) matches persona priorities.
- No UI tests in MVP. Manual smoke testing in browser before release.

## Deployment

`vite build` produces a static `dist/` directory. Deploy targets:
- **GitHub Pages** — push to `gh-pages` branch (default).
- **Vercel** — alternative if custom domain or analytics is desired.

URL form: `…/lords-of-conquest/?seed=abc123` for shareable games.

## Open questions / deferred decisions

- **Exact persona weight tuning** — initial values are illustrative; tune during AI implementation.
- **Combat-dice animation duration & visual style** — settle during UI polish pass.
- **Map size / grid dimensions for given `territories` count** — auto-derive `width × height` (e.g., `ceil(sqrt(territories / land_density)) × ceil(sqrt(territories / land_density))` with `land_density ≈ 0.55`).
- **Tutorial / onboarding** — flagged as near-term post-MVP; not in this spec but should follow the same architecture.
