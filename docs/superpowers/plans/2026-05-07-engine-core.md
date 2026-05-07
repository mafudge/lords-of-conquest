# Engine Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the game-state reducer, persistence (localStorage save/load + map-text load), the selection phase, the production phase (including the 25% skip with `reasons.txt`, city resource doubling, and horse spread from Stables), and the force-count primitive. Deliverable: a `npm run play-game -- --seed 12345` CLI that runs setup → selection → first production deterministically, plus a save/load roundtrip CLI smoke test.

**Architecture:** Single immutable `GameState`. Every state transition routes through `reduce(state, plan)`. The discriminated-union `Plan` type covers every action; this plan implements the handlers for `newGame`, `selection`, `production`, `savegame`, `loadgame`, `loadmap`, and `endPhase`. The other handlers throw `"not implemented in plan 2"` and are filled in by Plan 3. The AI is not invoked from the reducer — it returns plans that the reducer applies. UI animation is a UI concern; the reducer is synchronous.

**Tech Stack:** Same as Plan 1 — TypeScript strict, Vitest, Node 20+ (we run on 18 too), `tsx` for the CLI. No new dependencies.

**Reference:** Decompiled Java at `.reference/decompiled/` (gitignored). Spec at `docs/superpowers/specs/2026-05-06-clean-room-port-design.md`. Plan 1 deliverables at `src/game/{codes,constants,aiConstants,locProb,rng,types,mapTextCodec}.ts` and `src/game/mapgen/`.

---

## File Structure (locked in for Plan 2)

```
src/
├── game/
│   ├── types.ts                        # MODIFY — add Player, GameState, etc.
│   ├── plans.ts                        # NEW — discriminated-union Plan
│   ├── reducer.ts                      # NEW — reduce(state, plan) entry
│   ├── reducers/                       # NEW — per-kind handlers
│   │   ├── newGame.ts
│   │   ├── selection.ts
│   │   ├── production.ts
│   │   ├── persistence.ts              # savegame/loadgame
│   │   ├── loadmap.ts
│   │   └── endPhase.ts
│   ├── force.ts                        # NEW — getForceCount
│   ├── activation.ts                   # NEW — recomputeResourceDoubles
│   ├── reasons.ts                      # NEW — bundles reasons.txt
│   ├── mapTextCodec.ts                 # MODIFY — add decodeMapAndBuildBoard
│   └── ...
├── platform/
│   ├── storage.ts                      # NEW — localStorage wrapper
│   └── urlSeed.ts                      # NEW — ?seed=… roundtrip
├── cli/
│   ├── playGame.ts                     # NEW — scripted run
│   └── saveLoadSmoke.ts                # NEW — roundtrip test
└── ...
tests/
├── reducers/
│   ├── newGame.test.ts
│   ├── selection.test.ts
│   ├── production.test.ts
│   ├── persistence.test.ts
│   └── loadmap.test.ts
├── force.test.ts
├── activation.test.ts
├── platform/
│   ├── storage.test.ts
│   └── urlSeed.test.ts
└── snapshots/
    └── selection-then-production.test.ts
```

---

## Task 1: Extend types — `Player`, `Stockpile`, `Boat`, `PlayerColor`

**Files:**
- Modify: `src/game/types.ts`
- Create: `tests/types-engine.test.ts`

Reference: spec `## Data model` section.

- [ ] **Step 1: Write the failing test**

Create `tests/types-engine.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type {
  Player, Boat, Stockpile, PlayerColor, GameState, GameSetup,
  ElementOfChance, Persona, Phase, ResourceDensity,
} from '../src/game/types.js';

describe('engine types', () => {
  it('Stockpile is a 5-tuple of numbers', () => {
    const s: Stockpile = [0, 0, 0, 0, 0];
    expect(s).toHaveLength(5);
  });

  it('Player has id, color, persona, status, stockpile, stockpileLocation, name', () => {
    const p: Player = {
      id: 0,
      name: 'Red',
      color: 'red',
      persona: 'human',
      status: 'playing',
      stockpile: [0, 0, 0, 0, 0],
      stockpileLocation: null,
    };
    expect(p.id).toBe(0);
  });

  it('Boat has owner, position, cargo flags', () => {
    const b: Boat = {
      id: 0,
      x: 5, y: 5,
      homeTerritoryId: 0,
      ownerId: 0,
      carryHorse: false,
      carryWeapon: false,
    };
    expect(b.id).toBe(0);
  });

  it('PlayerColor and Persona unions accept all expected values', () => {
    const cs: PlayerColor[] = ['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'];
    const ps: Persona[] = ['human', 'passive', 'defensive', 'aggressive'];
    expect(cs).toHaveLength(7);
    expect(ps).toHaveLength(4);
  });

  it('Phase covers all setup + 5 game phases + gameOver', () => {
    const phases: Phase[] = [
      'setup', 'selection', 'production', 'trade', 'shipment',
      'conquest', 'development', 'gameOver',
    ];
    expect(phases).toHaveLength(8);
  });

  it('ElementOfChance accepts low/medium/high', () => {
    const e: ElementOfChance[] = ['low', 'medium', 'high'];
    expect(e).toHaveLength(3);
  });

  it('GameSetup carries players + cities to win + chance + map params', () => {
    const setup: GameSetup = {
      players: [{ color: 'red', name: 'Red', persona: 'human' }, { color: 'blue', name: 'Blue', persona: 'aggressive' }],
      citiesToWin: 5,
      elementOfChance: 'high',
      randomizePlayerOrder: false,
      map: {
        waterBoundary: true,
        waterArea: 'small',
        numTerritories: 24,
        islands: 'some',
        shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' },
      },
    };
    expect(setup.citiesToWin).toBe(5);
  });

  it('GameState has the field set described in the spec', () => {
    // Type-only: this compiles iff the type definition is correct.
    const _hasFields = (s: GameState): unknown => [
      s.schemaVersion, s.seed, s.rngCursor, s.setup, s.squares, s.territories,
      s.boats, s.players, s.turnOrder, s.currentPhase, s.currentPlayer,
      s.year, s.attackNumber, s.shipmentUsed, s.pendingTrade, s.pendingCombat,
      s.rejectedTrades, s.autoReject, s.log,
    ];
    expect(typeof _hasFields).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/types-engine.test.ts`
Expected: FAIL — exports not found.

- [ ] **Step 3: Modify `src/game/types.ts`**

Append after the existing `Board` type and before `sqIndex`:

```ts
// --- engine types ---

export type PlayerColor = 'red' | 'blue' | 'cyan' | 'purple' | 'orange' | 'green' | 'yellow';
export type Persona = 'human' | 'passive' | 'defensive' | 'aggressive';
export type ElementOfChance = 'low' | 'medium' | 'high';

export type Phase =
  | 'setup'
  | 'selection'
  | 'production'
  | 'trade'
  | 'shipment'
  | 'conquest'
  | 'development'
  | 'gameOver';

// 5-tuple keyed by ResourceCode 0..4 = [iron, coal, tree, gold, stable]
export type Stockpile = [number, number, number, number, number];

export type Player = {
  id: PlayerId;
  name: string;
  color: PlayerColor;
  persona: Persona;
  status: 'playing' | 'eliminated' | 'notPlaying';
  stockpile: Stockpile;
  stockpileLocation: number | null;
};

export type Boat = {
  id: number;
  x: number; y: number;
  homeTerritoryId: number;
  ownerId: PlayerId;
  carryHorse: boolean;
  carryWeapon: boolean;
};

export type GameSetup = {
  players: Array<{ color: PlayerColor; name: string; persona: Persona }>;
  citiesToWin: 3 | 4 | 5 | 6 | 7 | 8;
  elementOfChance: ElementOfChance;
  randomizePlayerOrder: boolean;
  map: MapParams;
};

export type TradeOffer = {
  proposerId: PlayerId;
  tradeeId: PlayerId;
  give: Stockpile;
  receive: Stockpile;
  status: 'proposed' | 'accepted' | 'rejected';
  horseFromTerritoryId?: number;
  horseToTerritoryId?: number;
};

export type CombatState = {
  attackerId: PlayerId;
  defenderId: PlayerId | null;
  fromTerritoryId: number;
  targetTerritoryId: number;
  boatId: number | null;
  horseFromTerritoryId: number | null;
  weaponFromTerritoryId: number | null;
  alliesDecisions: Array<'attacker' | 'neutral' | 'defender'>;
  alliesPending: Set<PlayerId>;
  attackerStrength: number;
  defenderStrength: number;
  resolved: boolean;
  attackerWon: boolean;
};

export type LogEntry = {
  year: number;
  phase: Phase;
  player: PlayerId;
  message: string;
};

export type RejectedTrade = {
  trader: PlayerId;
  tradee: PlayerId;
  tradeKey: string;       // canonical hash of give+receive
  count: number;
};

export type GameState = {
  schemaVersion: 1;
  seed: number;
  rngCursor: number;
  setup: GameSetup;
  squares: Square[];
  territories: Territory[];
  boats: Array<Boat | null>;          // 256-slot pool; null = invalid slot
  players: Player[];                   // length 2..7
  turnOrder: PlayerId[];               // current rotation
  currentPhase: Phase;
  currentPlayer: PlayerId;
  year: number;
  attackNumber: 1 | 2;
  shipmentUsed: boolean;
  pendingTrade: TradeOffer | null;
  pendingCombat: CombatState | null;
  rejectedTrades: RejectedTrade[];
  autoReject: boolean[][];             // [tradee][trader] = true means tradee auto-rejects
  log: LogEntry[];                     // ring buffer
};
```

Also update the existing `MapParams` type to align with `GameSetup` (no change needed — already matches).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/types-engine.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/game/types.ts tests/types-engine.test.ts
git commit -m "Extend types with Player, GameState, and engine primitives"
```

---

## Task 2: `Plan` discriminated union

**Files:**
- Create: `src/game/plans.ts`
- Create: `tests/plans.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import type { Plan, PlanKind } from '../src/game/plans.js';

describe('plans', () => {
  it('Plan kinds cover the engine surface', () => {
    const kinds: PlanKind[] = [
      'newGame', 'selection', 'production', 'trade', 'tradeResponse',
      'tradeRejectAll', 'horseFrom', 'horseTo', 'shipStockpile',
      'shipHorse', 'shipWeapon', 'shipBoat', 'attack', 'alliesDecision',
      'resolveCombat', 'buildCity', 'buildWeapon', 'buildBoat',
      'endPhase', 'savegame', 'loadgame', 'loadmap',
    ];
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toHaveLength(22);
  });

  it('newGame plan has setup + seed', () => {
    const p: Plan = {
      kind: 'newGame',
      setup: {
        players: [
          { color: 'red', name: 'Red', persona: 'human' },
          { color: 'blue', name: 'Blue', persona: 'aggressive' },
        ],
        citiesToWin: 5,
        elementOfChance: 'high',
        randomizePlayerOrder: false,
        map: {
          waterBoundary: true, waterArea: 'small', numTerritories: 24,
          islands: 'some', shapes: 'regular',
          resourceDensity: { kind: 'fixed', level: 'medium' },
        },
      },
      seed: 12345,
    };
    expect(p.kind).toBe('newGame');
  });

  it('selection plan has player + territoryId', () => {
    const p: Plan = { kind: 'selection', player: 0, territoryId: 5 };
    expect(p.kind).toBe('selection');
  });

  it('endPhase plan has player', () => {
    const p: Plan = { kind: 'endPhase', player: 0 };
    expect(p.kind).toBe('endPhase');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/plans.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/plans.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/plans.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/plans.ts tests/plans.test.ts
git commit -m "Add Plan discriminated union covering all engine actions"
```

---

## Task 3: Reducer scaffold (default-throws on unhandled kinds)

**Files:**
- Create: `src/game/reducer.ts`
- Create: `tests/reducer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../src/game/reducer.js';
import type { GameState } from '../src/game/types.js';
import type { Plan } from '../src/game/plans.js';

const minimalState = (): GameState => ({
  schemaVersion: 1,
  seed: 0,
  rngCursor: 0,
  setup: {
    players: [],
    citiesToWin: 3,
    elementOfChance: 'high',
    randomizePlayerOrder: false,
    map: {
      waterBoundary: true, waterArea: 'small', numTerritories: 24,
      islands: 'some', shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    },
  },
  squares: [], territories: [], boats: [], players: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

describe('reducer', () => {
  it('throws "not implemented in plan 2" for plan kinds Plan 3 will handle', () => {
    const state = minimalState();
    const plan: Plan = { kind: 'attack', player: 0, targetTerritoryId: 0,
      fromTerritoryId: 0, boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null };
    expect(() => reduce(state, plan)).toThrow(/not implemented/i);
  });

  it('throws "unknown plan kind" for invalid kinds', () => {
    const state = minimalState();
    const plan = { kind: 'bogus' } as unknown as Plan;
    expect(() => reduce(state, plan)).toThrow(/unknown plan kind/i);
  });

  it('returns a new state object (immutability marker)', () => {
    const state = minimalState();
    const plan: Plan = { kind: 'endPhase', player: 0 };
    // endPhase handler is a stub for now; throw or return a new state — but
    // either way, the reducer must NOT mutate the input.
    try { reduce(state, plan); } catch { /* ok */ }
    expect(state.year).toBe(0); // input unchanged
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/reducer.ts`**

```ts
import type { GameState } from './types.js';
import type { Plan } from './plans.js';

const NOT_IMPLEMENTED_KINDS: ReadonlyArray<Plan['kind']> = [
  'trade', 'tradeResponse', 'tradeRejectAll', 'horseFrom', 'horseTo',
  'shipStockpile', 'shipHorse', 'shipWeapon', 'shipBoat',
  'attack', 'alliesDecision', 'resolveCombat',
  'buildCity', 'buildWeapon', 'buildBoat',
];

export function reduce(state: GameState, plan: Plan): GameState {
  switch (plan.kind) {
    case 'newGame':
    case 'selection':
    case 'production':
    case 'endPhase':
    case 'savegame':
    case 'loadgame':
    case 'loadmap':
      throw new Error(`Reducer dispatch for ${plan.kind} is wired in a later task`);
    default: {
      // Distinguish between "Plan 3 territory" and "completely unknown"
      const kind = (plan as { kind?: string }).kind;
      if (kind && (NOT_IMPLEMENTED_KINDS as string[]).includes(kind)) {
        throw new Error(`Reducer for ${kind} is not implemented in plan 2 (Plan 3 territory)`);
      }
      throw new Error(`Reducer received unknown plan kind: ${String(kind)}`);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducer.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducer.ts tests/reducer.test.ts
git commit -m "Scaffold reducer with kind dispatch and explicit not-implemented errors"
```

---

## Task 4: `NEW_GAME` plan handler

**Files:**
- Create: `src/game/reducers/newGame.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/newGame.test.ts`

Reference: spec section "Pre-game". Players are seated with stockpile=[0,0,0,0,0] and stockpileLocation=null. `turnOrder` is `[0,1,...,n-1]`, optionally shuffled with the seeded RNG. Phase becomes `'selection'`. `year=1`. `boats[]` is a 256-slot array of `null`. `autoReject` is a numPlayers×numPlayers matrix of `false`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { Plan } from '../../src/game/plans.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'Red', persona: 'human' },
    { color: 'blue', name: 'Blue', persona: 'aggressive' },
    { color: 'cyan', name: 'Cyan', persona: 'defensive' },
    { color: 'purple', name: 'Purple', persona: 'passive' },
  ],
  citiesToWin: 5,
  elementOfChance: 'high',
  randomizePlayerOrder: false,
  map: {
    waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' },
  },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

describe('NEW_GAME', () => {
  it('initializes 4 players with empty stockpiles', () => {
    const out = reduce(initial(), { kind: 'newGame', setup, seed: 12345 });
    expect(out.players).toHaveLength(4);
    expect(out.players[0]!.stockpile).toEqual([0, 0, 0, 0, 0]);
    expect(out.players[0]!.stockpileLocation).toBeNull();
    expect(out.players.map((p) => p.color)).toEqual(['red', 'blue', 'cyan', 'purple']);
  });

  it('runs map generation deterministically per seed', () => {
    const a = reduce(initial(), { kind: 'newGame', setup, seed: 12345 });
    const b = reduce(initial(), { kind: 'newGame', setup, seed: 12345 });
    expect(a.squares).toEqual(b.squares);
    expect(a.territories.map((t) => t.squares)).toEqual(b.territories.map((t) => t.squares));
  });

  it('transitions to selection phase, year=1, currentPlayer=turnOrder[0]', () => {
    const out = reduce(initial(), { kind: 'newGame', setup, seed: 1 });
    expect(out.currentPhase).toBe('selection');
    expect(out.year).toBe(1);
    expect(out.currentPlayer).toBe(out.turnOrder[0]!);
  });

  it('non-randomized order is [0, 1, …, n-1]', () => {
    const out = reduce(initial(), { kind: 'newGame', setup, seed: 1 });
    expect(out.turnOrder).toEqual([0, 1, 2, 3]);
  });

  it('randomized order shuffles via seeded RNG (deterministic)', () => {
    const setupRand = { ...setup, randomizePlayerOrder: true };
    const a = reduce(initial(), { kind: 'newGame', setup: setupRand, seed: 7 });
    const b = reduce(initial(), { kind: 'newGame', setup: setupRand, seed: 7 });
    expect(a.turnOrder).toEqual(b.turnOrder);
    expect(new Set(a.turnOrder)).toEqual(new Set([0, 1, 2, 3]));
  });

  it('boats slot pool is 256 nulls, autoReject is N×N false', () => {
    const out = reduce(initial(), { kind: 'newGame', setup, seed: 1 });
    expect(out.boats).toHaveLength(256);
    expect(out.boats.every((b) => b === null)).toBe(true);
    expect(out.autoReject).toHaveLength(4);
    expect(out.autoReject.every((row) => row.length === 4 && row.every((v) => v === false))).toBe(true);
  });

  it('rejects setup with fewer than 2 players', () => {
    const bad = { ...setup, players: setup.players.slice(0, 1) };
    expect(() => reduce(initial(), { kind: 'newGame', setup: bad, seed: 1 })).toThrow(/at least 2/i);
  });

  it('rejects setup with more than 7 players', () => {
    const bad = {
      ...setup,
      players: [
        { color: 'red' as const, name: 'r', persona: 'human' as const },
        { color: 'blue' as const, name: 'b', persona: 'human' as const },
        { color: 'cyan' as const, name: 'c', persona: 'human' as const },
        { color: 'purple' as const, name: 'p', persona: 'human' as const },
        { color: 'orange' as const, name: 'o', persona: 'human' as const },
        { color: 'green' as const, name: 'g', persona: 'human' as const },
        { color: 'yellow' as const, name: 'y', persona: 'human' as const },
        { color: 'red' as const, name: 'r2', persona: 'human' as const },
      ],
    };
    expect(() => reduce(initial(), { kind: 'newGame', setup: bad, seed: 1 })).toThrow(/at most 7/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/newGame.test.ts`
Expected: FAIL — reducer throws "wired in a later task".

- [ ] **Step 3: Implement `src/game/reducers/newGame.ts`**

```ts
import type { GameState, GameSetup, Player, PlayerId } from '../types.js';
import { generateMap } from '../mapgen/index.js';
import { createRng, nextInt } from '../rng.js';
import { MAX_BOATS } from '../constants.js';

export function applyNewGame(
  prev: GameState,
  setup: GameSetup,
  seed: number,
): GameState {
  const n = setup.players.length;
  if (n < 2) throw new Error('NEW_GAME requires at least 2 players');
  if (n > 7) throw new Error('NEW_GAME accepts at most 7 players');

  const rng = createRng(seed);
  // Map generation consumes RNG draws first; subsequent randomness (player
  // shuffle) draws from the same stream so the full game is reproducible.
  const board = generateMap(seed, setup.map, n);
  // generateMap runs its own RNG instance; advance our cursor past those draws
  // by constructing a fresh rng for any further consumption. (Each call to
  // generateMap is deterministic per seed.)

  const players: Player[] = setup.players.map((p, i) => ({
    id: i as PlayerId,
    name: p.name,
    color: p.color,
    persona: p.persona,
    status: 'playing',
    stockpile: [0, 0, 0, 0, 0],
    stockpileLocation: null,
  }));

  let turnOrder: PlayerId[] = players.map((p) => p.id);
  if (setup.randomizePlayerOrder) {
    // Fisher-Yates with seeded RNG
    const shuffleRng = createRng(seed ^ 0xa5a5_a5a5);
    for (let i = turnOrder.length - 1; i > 0; i--) {
      const j = nextInt(shuffleRng, i + 1);
      [turnOrder[i], turnOrder[j]] = [turnOrder[j]!, turnOrder[i]!];
    }
  }

  const autoReject: boolean[][] = Array.from(
    { length: n }, () => new Array<boolean>(n).fill(false));

  return {
    ...prev,
    schemaVersion: 1,
    seed,
    rngCursor: rng.cursor,
    setup,
    squares: board.squares,
    territories: board.territories,
    boats: new Array(MAX_BOATS).fill(null),
    players,
    turnOrder,
    currentPhase: 'selection',
    currentPlayer: turnOrder[0]!,
    year: 1,
    attackNumber: 1,
    shipmentUsed: false,
    pendingTrade: null,
    pendingCombat: null,
    rejectedTrades: [],
    autoReject,
    log: [{ year: 1, phase: 'selection', player: turnOrder[0]!, message: 'Game started' }],
  };
}
```

- [ ] **Step 4: Wire into reducer**

Modify `src/game/reducer.ts`:
```ts
import { applyNewGame } from './reducers/newGame.js';

// inside switch:
    case 'newGame':
      return applyNewGame(state, plan.setup, plan.seed);
```

(Replace the `case 'newGame':` line that was `throw new Error(...)` — keep the other cases throwing as before.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/newGame.test.ts`
Expected: 8 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/newGame.ts src/game/reducer.ts tests/reducers/newGame.test.ts
git commit -m "Implement NEW_GAME: seat players, run mapgen, transition to selection"
```

---

## Task 5: `localStorage` wrapper for save/load

**Files:**
- Create: `src/platform/storage.ts`
- Create: `tests/platform/storage.test.ts`

Note: Vitest runs in Node by default. We need a localStorage shim for tests. Use a simple in-memory `Map` injected via the function signature.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveGameToStorage, loadGameFromStorage, listSaveSlots, deleteSaveSlot,
  type StorageLike,
} from '../../src/platform/storage.js';
import type { GameState } from '../../src/game/types.js';

class MemStorage implements StorageLike {
  private data = new Map<string, string>();
  getItem(k: string): string | null { return this.data.get(k) ?? null; }
  setItem(k: string, v: string): void { this.data.set(k, v); }
  removeItem(k: string): void { this.data.delete(k); }
  key(i: number): string | null {
    const arr = Array.from(this.data.keys()); return arr[i] ?? null;
  }
  get length(): number { return this.data.size; }
}

const sampleState = (year: number): GameState => ({
  schemaVersion: 1, seed: 1, rngCursor: 0,
  setup: {
    players: [
      { color: 'red', name: 'r', persona: 'human' },
      { color: 'blue', name: 'b', persona: 'human' },
    ],
    citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
    map: {
      waterBoundary: true, waterArea: 'small', numTerritories: 24,
      islands: 'some', shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    },
  },
  squares: [], territories: [], boats: [], players: [],
  turnOrder: [0, 1], currentPhase: 'selection', currentPlayer: 0,
  year, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [[false, false], [false, false]],
  log: [],
});

describe('storage', () => {
  let s: MemStorage;
  beforeEach(() => { s = new MemStorage(); });

  it('saves and loads a slot', () => {
    saveGameToStorage(s, 'autosave', sampleState(3));
    const loaded = loadGameFromStorage(s, 'autosave');
    expect(loaded.kind).toBe('ok');
    if (loaded.kind === 'ok') expect(loaded.state.year).toBe(3);
  });

  it('returns "missing" if slot absent', () => {
    const loaded = loadGameFromStorage(s, 'slot1');
    expect(loaded.kind).toBe('missing');
  });

  it('returns "schema-mismatch" on bad schemaVersion', () => {
    s.setItem('loc:save:slot1', JSON.stringify({
      schemaVersion: 999, savedAt: '2026-05-07T00:00:00Z', state: sampleState(1),
    }));
    const loaded = loadGameFromStorage(s, 'slot1');
    expect(loaded.kind).toBe('schema-mismatch');
  });

  it('returns "parse-error" on malformed JSON', () => {
    s.setItem('loc:save:slot1', '{not-json');
    const loaded = loadGameFromStorage(s, 'slot1');
    expect(loaded.kind).toBe('parse-error');
  });

  it('listSaveSlots returns occupied slot names', () => {
    saveGameToStorage(s, 'slot1', sampleState(1));
    saveGameToStorage(s, 'slot3', sampleState(2));
    expect(listSaveSlots(s).sort()).toEqual(['slot1', 'slot3']);
  });

  it('deleteSaveSlot removes a slot', () => {
    saveGameToStorage(s, 'slot1', sampleState(1));
    deleteSaveSlot(s, 'slot1');
    expect(loadGameFromStorage(s, 'slot1').kind).toBe('missing');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/platform/storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/platform/storage.ts`**

```ts
import type { GameState } from '../game/types.js';

export type StorageLike = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  key(i: number): string | null;
  readonly length: number;
};

export type SaveSlot = 'autosave' | 'slot1' | 'slot2' | 'slot3';
const ALL_SLOTS: ReadonlyArray<SaveSlot> = ['autosave', 'slot1', 'slot2', 'slot3'];
const PREFIX = 'loc:save:';

type Envelope = { schemaVersion: 1; savedAt: string; state: GameState };

export type LoadResult =
  | { kind: 'ok'; state: GameState; savedAt: string }
  | { kind: 'missing' }
  | { kind: 'schema-mismatch'; got: number }
  | { kind: 'parse-error'; message: string };

export function saveGameToStorage(s: StorageLike, slot: SaveSlot, state: GameState): void {
  const env: Envelope = {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    state,
  };
  s.setItem(PREFIX + slot, JSON.stringify(env));
}

export function loadGameFromStorage(s: StorageLike, slot: SaveSlot): LoadResult {
  const raw = s.getItem(PREFIX + slot);
  if (raw === null) return { kind: 'missing' };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch (e) { return { kind: 'parse-error', message: String((e as Error).message ?? e) }; }
  const env = parsed as Partial<Envelope>;
  if (env.schemaVersion !== 1) return { kind: 'schema-mismatch', got: Number(env.schemaVersion ?? -1) };
  if (!env.state) return { kind: 'parse-error', message: 'envelope missing state' };
  return { kind: 'ok', state: env.state as GameState, savedAt: String(env.savedAt) };
}

export function listSaveSlots(s: StorageLike): SaveSlot[] {
  return ALL_SLOTS.filter((slot) => s.getItem(PREFIX + slot) !== null);
}

export function deleteSaveSlot(s: StorageLike, slot: SaveSlot): void {
  s.removeItem(PREFIX + slot);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/platform/storage.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/platform/storage.ts tests/platform/storage.test.ts
git commit -m "Add localStorage save/load with schema check and slot mgmt"
```

---

## Task 6: URL seed parameter codec

**Files:**
- Create: `src/platform/urlSeed.ts`
- Create: `tests/platform/urlSeed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseSeedFromUrl, formatSeedAsUrl } from '../../src/platform/urlSeed.js';

describe('urlSeed', () => {
  it('parses ?seed=12345', () => {
    expect(parseSeedFromUrl('https://example.com/?seed=12345')).toBe(12345);
  });

  it('parses bare ?seed=42 query string', () => {
    expect(parseSeedFromUrl('?seed=42')).toBe(42);
  });

  it('returns null when no seed', () => {
    expect(parseSeedFromUrl('https://example.com/')).toBeNull();
  });

  it('returns null on non-numeric seed', () => {
    expect(parseSeedFromUrl('?seed=abc')).toBeNull();
  });

  it('handles negative seeds', () => {
    expect(parseSeedFromUrl('?seed=-7')).toBe(-7);
  });

  it('formatSeedAsUrl appends/replaces the seed param', () => {
    expect(formatSeedAsUrl('https://example.com/', 99)).toBe('https://example.com/?seed=99');
    expect(formatSeedAsUrl('https://example.com/?seed=1', 99)).toBe('https://example.com/?seed=99');
    expect(formatSeedAsUrl('https://example.com/?foo=bar', 99))
      .toBe('https://example.com/?foo=bar&seed=99');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/platform/urlSeed.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/platform/urlSeed.ts`**

```ts
export function parseSeedFromUrl(href: string): number | null {
  // Accept either a full URL or a bare query string.
  const q = href.includes('?') ? href.slice(href.indexOf('?')) : href.startsWith('?') ? href : '';
  if (!q) return null;
  const params = new URLSearchParams(q.slice(1));
  const v = params.get('seed');
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formatSeedAsUrl(href: string, seed: number): string {
  const [base, query = ''] = href.split('?', 2);
  const params = new URLSearchParams(query);
  params.set('seed', String(seed));
  return `${base}?${params.toString()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/platform/urlSeed.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/platform/urlSeed.ts tests/platform/urlSeed.test.ts
git commit -m "Add ?seed=… URL roundtrip"
```

---

## Task 7: `reasons.txt` loader

**Files:**
- Create: `src/game/reasons.ts`
- Create: `tests/reasons.test.ts`

The applet ships a `reasons.txt` file inside `loc.jar`. We extracted its contents during decompilation; the file is a list of 21 short flavor strings used as the "phase skipped" message. Embed them directly.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { REASONS, pickReason } from '../src/game/reasons.js';
import { createRng } from '../src/game/rng.js';

describe('reasons', () => {
  it('exports the original 21 reason strings', () => {
    expect(REASONS).toHaveLength(21);
    expect(REASONS).toContain('Plagues of Cockroaches');
    expect(REASONS).toContain('Y2K Bug');
    expect(REASONS).toContain('Presidential Vote Recounts');
  });

  it('pickReason returns a string from REASONS deterministically per RNG state', () => {
    const r = createRng(7);
    const a = pickReason(r);
    const r2 = createRng(7);
    const b = pickReason(r2);
    expect(a).toBe(b);
    expect(REASONS).toContain(a);
  });

  it('pickReason advances the RNG cursor', () => {
    const r = createRng(7);
    const beforeCursor = r.cursor;
    pickReason(r);
    expect(r.cursor).toBeGreaterThan(beforeCursor);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reasons.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/reasons.ts`**

```ts
import { type RngState, nextInt } from './rng.js';

// Verbatim from reasons.txt inside loc.jar (21 entries).
export const REASONS: readonly string[] = [
  'Plagues of Cockroaches',
  'Stack Imbalance',
  'Floods',
  'Bureaucracy',
  'Seemingly Insoluble Problems',
  'Political Scandals',
  'Eons of Game Playing',
  'Feverish Apathy',
  'Y2K Bug',
  'Recession',
  'Vicious Vermin',
  'Strong Siroccos',
  'A Series of Snafus',
  'The Release of a Star Wars Movie',
  'Earthquakes',
  'Rampaging Pestilence',
  'General Lawlessness',
  'Civil Wars',
  'Glorification of Ignorance',
  'Public Executions',
  'Presidential Vote Recounts',
] as const;

export function pickReason(r: RngState): string {
  return REASONS[nextInt(r, REASONS.length)]!;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reasons.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reasons.ts tests/reasons.test.ts
git commit -m "Embed Gettman reasons.txt for phase-skip flavor"
```

---

## Task 8: Selection plan handler

**Files:**
- Create: `src/game/reducers/selection.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/selection.test.ts`

Reference: spec section "Selection phase" + LocApplet L6093-L6141.

Selection rules:
1. Plan `{ kind: 'selection', player, territoryId }` — assigns the territory to the player.
2. Validation:
   - `currentPhase` must be `'selection'`.
   - `player` must equal `currentPlayer`.
   - Territory must exist and be unowned (`ownerId === null`).
3. After the assignment, advance `currentPlayer` to the next entry in `turnOrder`.
4. **Selection phase end:** when `selectedCount + numPlayers > numTerritories`. At that point, do NOT advance `currentPlayer`; instead, the phase end will be triggered by the next `endPhase` plan. (We'll detect end-of-selection in the `endPhase` handler in Task 10. For Task 8 we just keep advancing player.)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
    { color: 'cyan', name: 'c', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: {
    waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' },
  },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function bootstrap(seed: number): GameState {
  return reduce(initial(), { kind: 'newGame', setup, seed });
}

describe('selection plan', () => {
  it('assigns owner of an unowned territory and advances currentPlayer', () => {
    const s0 = bootstrap(99);
    const player = s0.currentPlayer;
    const target = s0.territories.find((t) => t.ownerId === null)!.id;
    const s1 = reduce(s0, { kind: 'selection', player, territoryId: target });
    expect(s1.territories.find((t) => t.id === target)!.ownerId).toBe(player);
    // currentPlayer rotates within turnOrder
    const idx = s0.turnOrder.indexOf(player);
    expect(s1.currentPlayer).toBe(s0.turnOrder[(idx + 1) % s0.turnOrder.length]);
  });

  it('rejects selection when phase is not selection', () => {
    const s0 = bootstrap(99);
    const s1 = { ...s0, currentPhase: 'production' as const };
    expect(() => reduce(s1, { kind: 'selection', player: s0.currentPlayer, territoryId: 0 }))
      .toThrow(/phase/i);
  });

  it('rejects selection by wrong player', () => {
    const s0 = bootstrap(99);
    const wrong = (s0.currentPlayer === 0 ? 1 : 0) as 0 | 1;
    expect(() => reduce(s0, { kind: 'selection', player: wrong, territoryId: 0 }))
      .toThrow(/current player/i);
  });

  it('rejects selecting an already-owned territory', () => {
    const s0 = bootstrap(99);
    const target = s0.territories[0]!.id;
    const s1 = reduce(s0, { kind: 'selection', player: s0.currentPlayer, territoryId: target });
    expect(() => reduce(s1, { kind: 'selection', player: s1.currentPlayer, territoryId: target }))
      .toThrow(/unowned/i);
  });

  it('rejects nonexistent territory', () => {
    const s0 = bootstrap(99);
    expect(() => reduce(s0, { kind: 'selection', player: s0.currentPlayer, territoryId: 9999 }))
      .toThrow(/territory/i);
  });

  it('handles a 3-player draft of all 24 territories', () => {
    let s = bootstrap(7);
    for (let i = 0; i < 24; i++) {
      const free = s.territories.find((t) => t.ownerId === null);
      if (!free) break;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    const owned = s.territories.filter((t) => t.ownerId !== null);
    expect(owned).toHaveLength(24);
    // Even distribution-ish: each player owns 7 or 8
    const counts = [0, 0, 0];
    for (const t of s.territories) counts[t.ownerId!]!++;
    expect(counts.reduce((a, b) => a + b, 0)).toBe(24);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/selection.test.ts`
Expected: FAIL — selection case in reducer still throws.

- [ ] **Step 3: Implement `src/game/reducers/selection.ts`**

```ts
import type { GameState, PlayerId } from '../types.js';

export function applySelection(
  prev: GameState,
  player: PlayerId,
  territoryId: number,
): GameState {
  if (prev.currentPhase !== 'selection') {
    throw new Error(`Selection plan illegal during ${prev.currentPhase} phase`);
  }
  if (player !== prev.currentPlayer) {
    throw new Error(`Selection by player ${player} but current player is ${prev.currentPlayer}`);
  }
  const t = prev.territories[territoryId];
  if (!t) throw new Error(`No territory ${territoryId}`);
  if (t.ownerId !== null) throw new Error(`Territory ${territoryId} is not unowned`);

  const territories = prev.territories.map((tt) =>
    tt.id === territoryId ? { ...tt, ownerId: player } : tt
  );

  // Advance current player within turnOrder
  const idx = prev.turnOrder.indexOf(player);
  const nextPlayer = prev.turnOrder[(idx + 1) % prev.turnOrder.length]!;

  return {
    ...prev,
    territories,
    currentPlayer: nextPlayer,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'selection', player, message: `Selected territory ${territoryId}` },
    ],
  };
}
```

- [ ] **Step 4: Wire into reducer**

In `src/game/reducer.ts`, replace the `case 'selection':` `throw` line with:
```ts
import { applySelection } from './reducers/selection.js';

// inside switch:
    case 'selection':
      return applySelection(state, plan.player, plan.territoryId);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/selection.test.ts`
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/selection.ts src/game/reducer.ts tests/reducers/selection.test.ts
git commit -m "Implement selection plan handler with validation and player rotation"
```

---

## Task 9: Selection phase end detection (`endPhase` for selection)

**Files:**
- Create: `src/game/reducers/endPhase.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/endPhase-selection.test.ts`

Reference: spec — "After selection, **turn order is reversed**" (LocApplet L6107-L6116).

The `endPhase` handler is the engine's phase-transition driver. For Task 9 we only handle the selection→production transition; production→trade etc. are deferred until the production handler exists (Task 14) and Plan 3.

Behavior:
- `endPhase` plan can only be issued when *every* land territory has an owner OR when the human/AI explicitly ends selection (which may leave some territories unowned — Gettman allows this, see L6105 "selectedCount + numPlayers > numTerritories"). For Plan 2, **only allow `endPhase` from selection when all territories are owned** (simpler MVP rule); fewer-territories case is a Plan 3 concern.
- On valid end of selection: reverse `turnOrder`, set `currentPlayer = turnOrder[0]`, set `currentPhase = 'production'`, log entry.
- For other phases, throw `not implemented in plan 2`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
    { color: 'cyan', name: 'c', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: {
    waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' },
  },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

describe('endPhase: selection → production', () => {
  it('reverses turn order and transitions to production', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    const originalOrder = [...s.turnOrder];
    // Drain all 24 territories
    for (let i = 0; i < 24; i++) {
      const free = s.territories.find((t) => t.ownerId === null);
      if (!free) break;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(s.currentPhase).toBe('production');
    expect(s.turnOrder).toEqual([...originalOrder].reverse());
    expect(s.currentPlayer).toBe(s.turnOrder[0]!);
  });

  it('rejects endPhase from selection when territories remain unowned', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    // Only one selection
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    expect(() => reduce(s, { kind: 'endPhase', player: s.currentPlayer }))
      .toThrow(/unowned territories/i);
  });

  it('rejects endPhase from a phase Plan 2 does not handle', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    // Drain selection
    for (let i = 0; i < 24; i++) {
      const free = s.territories.find((t) => t.ownerId === null);
      if (!free) break;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    // Now in production; endPhase from production is not in Plan 2
    expect(() => reduce(s, { kind: 'endPhase', player: s.currentPlayer }))
      .toThrow(/not implemented|production/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/endPhase-selection.test.ts`
Expected: FAIL — endPhase still throws.

- [ ] **Step 3: Implement `src/game/reducers/endPhase.ts`**

```ts
import type { GameState, PlayerId } from '../types.js';

export function applyEndPhase(prev: GameState, _player: PlayerId): GameState {
  switch (prev.currentPhase) {
    case 'selection': {
      const unowned = prev.territories.filter((t) => t.ownerId === null);
      if (unowned.length > 0) {
        throw new Error(`Cannot end selection — ${unowned.length} unowned territories remain`);
      }
      const reversed: PlayerId[] = [...prev.turnOrder].reverse();
      return {
        ...prev,
        turnOrder: reversed,
        currentPhase: 'production',
        currentPlayer: reversed[0]!,
        log: [
          ...prev.log,
          { year: prev.year, phase: 'production', player: reversed[0]!,
            message: 'Selection complete — turn order reversed' },
        ],
      };
    }
    default:
      throw new Error(`endPhase from ${prev.currentPhase} is not implemented in plan 2 (Plan 3 territory)`);
  }
}
```

- [ ] **Step 4: Wire into reducer**

In `src/game/reducer.ts`:
```ts
import { applyEndPhase } from './reducers/endPhase.js';

// inside switch:
    case 'endPhase':
      return applyEndPhase(state, plan.player);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/endPhase-selection.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/endPhase.ts src/game/reducer.ts tests/reducers/endPhase-selection.test.ts
git commit -m "Implement endPhase for selection: reverse turn order, advance to production"
```

---

## Task 10: `getForceCount` primitive

**Files:**
- Create: `src/game/force.ts`
- Create: `tests/force.test.ts`

Reference: spec section "Combat (exact)". Formula:

```
For each tile in (T ∪ adjacent-tiles):
  if owned by p: fc[p] += 1 + horse?1 + city?2 + weapon?3
  if S == T (central tile only): fc[p] += 2 × #boats on T
  else (not owned): fc[NATIVES_PLAYER_ID] += 1
```

"Adjacent" here means via `state.territories[i].squares` adjacency to T's squares — but at the territory level we use the precomputed `touching` matrix.

Wait: re-read. Gettman's `getForceCount(int n)` operates at the territory level via the `touching[][]` matrix. "Tiles in (T ∪ adjacent territories)" actually means: territory T itself, plus every territory T2 that touches T. Each contributing territory contributes its base+items; the boat contribution comes only from T itself.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { getForceCount } from '../src/game/force.js';
import { Code } from '../src/game/codes.js';
import type { GameState, Territory, Player, GameSetup, Boat } from '../src/game/types.js';

function emptyState(numPlayers: number, numTerritories: number, touching: boolean[][]): GameState {
  const players: Player[] = Array.from({ length: numPlayers }, (_, i) => ({
    id: i as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    name: `P${i}`, color: 'red', persona: 'human',
    status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null,
  }));
  const territories: Territory[] = Array.from({ length: numTerritories }, (_, i) => ({
    id: i, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
  }));
  const setup: GameSetup = {
    players: players.map((p) => ({ color: p.color, name: p.name, persona: p.persona })),
    citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
    map: {
      waterBoundary: true, waterArea: 'small', numTerritories,
      islands: 'some', shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    },
  };
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0, setup,
    squares: [], territories, boats: new Array(256).fill(null), players,
    turnOrder: players.map((p) => p.id), currentPhase: 'production',
    currentPlayer: 0, year: 1, attackNumber: 1, shipmentUsed: false,
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: Array.from({ length: numPlayers }, () => new Array(numPlayers).fill(false)),
    log: [],
    // touching/distance attached separately for simplicity in tests
    // (we expose them via a side-channel here):
    // @ts-expect-error — extended for testing
    touching,
  } as GameState & { touching: boolean[][] };
}

describe('getForceCount', () => {
  it('unowned territory with no neighbors gives only natives', () => {
    const s = emptyState(2, 1, [[false]]);
    const fc = getForceCount(s, 0);
    expect(fc.perPlayer[7]).toBe(1); // T itself, unowned → natives
    expect(fc.perPlayer[0]).toBe(0);
    expect(fc.perPlayer[1]).toBe(0);
  });

  it('player-owned T with no neighbors and no items gives base 1', () => {
    const s = emptyState(2, 1, [[false]]);
    s.territories[0]!.ownerId = 0;
    const fc = getForceCount(s, 0);
    expect(fc.perPlayer[0]).toBe(1);
    expect(fc.perPlayer[7]).toBe(0);
  });

  it('items on T contribute: city +2, weapon +3, horse +1, boats +2 each', () => {
    const s = emptyState(2, 1, [[false]]);
    s.territories[0]!.ownerId = 0;
    s.territories[0]!.hasCity = true;
    s.territories[0]!.hasWeapon = true;
    s.territories[0]!.hasHorse = true;
    s.boats[0] = { id: 0, x: 0, y: 0, homeTerritoryId: 0, ownerId: 0, carryHorse: false, carryWeapon: false };
    s.boats[1] = { id: 1, x: 0, y: 0, homeTerritoryId: 0, ownerId: 0, carryHorse: false, carryWeapon: false };
    // Base 1 + horse 1 + city 2 + weapon 3 + 2 boats × 2 = 11
    const fc = getForceCount(s, 0);
    expect(fc.perPlayer[0]).toBe(11);
  });

  it('adjacent friendly territory contributes its base + horse + city + weapon (boats DO NOT propagate)', () => {
    const s = emptyState(2, 2, [[false, true], [true, false]]);
    s.territories[0]!.ownerId = 0;
    s.territories[1]!.ownerId = 0;
    s.territories[1]!.hasHorse = true;
    s.territories[1]!.hasWeapon = true;
    s.boats[0] = { id: 0, x: 0, y: 0, homeTerritoryId: 1, ownerId: 0, carryHorse: false, carryWeapon: false };
    // For force at T0:
    //   T0 contributes: 1 (base)  → 1
    //   T1 contributes: 1 + horse 1 + weapon 3 = 5 (boats DO NOT propagate from adjacent)
    // Total: 6
    const fc = getForceCount(s, 0);
    expect(fc.perPlayer[0]).toBe(6);
  });

  it('adjacent enemy territory contributes to that enemy player', () => {
    const s = emptyState(2, 2, [[false, true], [true, false]]);
    s.territories[0]!.ownerId = 0;
    s.territories[1]!.ownerId = 1;
    s.territories[1]!.hasWeapon = true;
    const fc = getForceCount(s, 0);
    expect(fc.perPlayer[0]).toBe(1);
    expect(fc.perPlayer[1]).toBe(1 + 3); // base + weapon
  });

  it('adjacent unowned territory adds to natives', () => {
    const s = emptyState(2, 2, [[false, true], [true, false]]);
    s.territories[0]!.ownerId = 0;
    // territories[1] is unowned
    const fc = getForceCount(s, 0);
    expect(fc.perPlayer[7]).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/force.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/force.ts`**

```ts
import type { GameState } from './types.js';
import { NATIVES_PLAYER_ID } from './constants.js';

export type ForceCount = { perPlayer: number[] }; // length 8 (indices 0..6 + 7=natives)

// Mirrors LocApplet.getForceCount L2242-L2316. Uses the touching matrix
// stored on the Board (attached to GameState by mapgen).
export function getForceCount(state: GameState, terrId: number): ForceCount {
  const perPlayer = new Array<number>(8).fill(0);
  const touching = (state as unknown as { touching: boolean[][] }).touching;

  const visit = (tid: number, isCenter: boolean) => {
    const t = state.territories[tid];
    if (!t) return;
    if (t.ownerId === null) {
      perPlayer[NATIVES_PLAYER_ID]! += 1;
      return;
    }
    let contribution = 1; // base
    if (t.hasHorse) contribution += 1;
    if (t.hasCity) contribution += 2;
    if (t.hasWeapon) contribution += 3;
    perPlayer[t.ownerId] += contribution;
    if (isCenter) {
      // Boats on the central tile only
      const boats = state.boats.filter((b) => b !== null && b.homeTerritoryId === tid && b.ownerId === t.ownerId);
      perPlayer[t.ownerId] += 2 * boats.length;
    }
  };

  visit(terrId, true);
  if (!touching) return { perPlayer };
  for (let i = 0; i < state.territories.length; i++) {
    if (i !== terrId && touching[terrId]?.[i]) visit(i, false);
  }
  return { perPlayer };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/force.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/force.ts tests/force.test.ts
git commit -m "Add getForceCount primitive matching LocApplet L2242-L2316"
```

---

## Task 11: Wire `touching` and `distance` from `Board` onto `GameState`

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/reducers/newGame.ts`
- Modify: `src/game/force.ts`
- Modify: `tests/force.test.ts`

The previous task accessed `touching` via a hacky type cast. Make `touching` and `distance` first-class fields on `GameState` so the rest of the engine can use them cleanly.

- [ ] **Step 1: Add fields to `GameState`**

Modify the `GameState` type in `src/game/types.ts` — add after `boats`:
```ts
  touching: boolean[][];     // [terrA][terrB] adjacency
  distance: number[][];      // BFS hops between territories
```

- [ ] **Step 2: Populate them in `applyNewGame`**

In `src/game/reducers/newGame.ts`, replace the return object:
```ts
  return {
    ...prev,
    schemaVersion: 1,
    seed,
    rngCursor: rng.cursor,
    setup,
    squares: board.squares,
    territories: board.territories,
    touching: board.touching,
    distance: board.distance,
    boats: new Array(MAX_BOATS).fill(null),
    players,
    turnOrder,
    currentPhase: 'selection',
    currentPlayer: turnOrder[0]!,
    year: 1,
    attackNumber: 1,
    shipmentUsed: false,
    pendingTrade: null,
    pendingCombat: null,
    rejectedTrades: [],
    autoReject,
    log: [{ year: 1, phase: 'selection', player: turnOrder[0]!, message: 'Game started' }],
  };
```

- [ ] **Step 3: Simplify `getForceCount` to use the typed field**

In `src/game/force.ts`, replace `const touching = (state as unknown as { touching: boolean[][] }).touching;` with `const touching = state.touching;` and remove the now-unnecessary `if (!touching)` early return.

- [ ] **Step 4: Update test fixture**

In `tests/force.test.ts`, the helper `emptyState` currently attaches `touching` via `@ts-expect-error`. Move `touching` and `distance` into the typed object directly:

Replace the helper's return statement:
```ts
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0, setup,
    squares: [], territories,
    touching, distance: [],
    boats: new Array(256).fill(null), players,
    turnOrder: players.map((p) => p.id), currentPhase: 'production',
    currentPlayer: 0, year: 1, attackNumber: 1, shipmentUsed: false,
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: Array.from({ length: numPlayers }, () => new Array(numPlayers).fill(false)),
    log: [],
  };
```

(Remove the `@ts-expect-error` and the `as GameState & { touching: ... }` cast.)

- [ ] **Step 5: Run all relevant tests**

Run: `npm test -- tests/force.test.ts tests/reducers/newGame.test.ts`
Expected: all passing.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/game/types.ts src/game/reducers/newGame.ts src/game/force.ts tests/force.test.ts
git commit -m "Lift touching and distance onto GameState as first-class fields"
```

---

## Task 12: City activation sweep (`recomputeResourceDoubles`)

**Files:**
- Create: `src/game/activation.ts`
- Create: `tests/activation.test.ts`

Reference: spec — "City doubling: numResources()==2 triggers a second production tick" + LocApplet L2019-L2055.

A territory's resource is "doubled" when:
1. It has a resource (`resource !== null`) of code 0–3 (Iron, Coal, Tree, Gold). **Stable (code 4) is excluded** per spec.
2. The territory's owner also owns either:
   - The territory itself (a city sitting on the resource), OR
   - Any territory adjacent to it (via `touching`) that has a city.

`recomputeResourceDoubles(state)` returns a new state with `hasResourceDouble` flags refreshed across every territory. Call this any time city ownership changes.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { recomputeResourceDoubles } from '../src/game/activation.js';
import { Code } from '../src/game/codes.js';
import type { GameState, Territory } from '../src/game/types.js';

function makeState(touching: boolean[][], territories: Partial<Territory>[]): GameState {
  const ts: Territory[] = territories.map((t, i) => ({
    id: i, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
    ...t,
  }));
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: [{ color: 'red', name: 'r', persona: 'human' }, { color: 'blue', name: 'b', persona: 'human' }],
      citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: ts.length, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories: ts, touching, distance: [],
    boats: new Array(256).fill(null),
    players: [],
    turnOrder: [], currentPhase: 'production', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false,
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  };
}

describe('recomputeResourceDoubles', () => {
  it('city on a resource tile activates its own resource', () => {
    const s = makeState([[false]], [{ ownerId: 0, resource: Code.IRON, hasCity: true }]);
    const out = recomputeResourceDoubles(s);
    expect(out.territories[0]!.hasResourceDouble).toBe(true);
  });

  it('city on adjacent friendly tile activates a resource', () => {
    const s = makeState(
      [[false, true], [true, false]],
      [
        { ownerId: 0, resource: Code.IRON },
        { ownerId: 0, hasCity: true },
      ],
    );
    const out = recomputeResourceDoubles(s);
    expect(out.territories[0]!.hasResourceDouble).toBe(true);
  });

  it('city on adjacent ENEMY tile does NOT activate', () => {
    const s = makeState(
      [[false, true], [true, false]],
      [
        { ownerId: 0, resource: Code.IRON },
        { ownerId: 1, hasCity: true },
      ],
    );
    const out = recomputeResourceDoubles(s);
    expect(out.territories[0]!.hasResourceDouble).toBe(false);
  });

  it('Stable (code 4) is excluded from doubling', () => {
    const s = makeState([[false]], [{ ownerId: 0, resource: Code.STABLE, hasCity: true }]);
    const out = recomputeResourceDoubles(s);
    expect(out.territories[0]!.hasResourceDouble).toBe(false);
  });

  it('Gold (code 3) IS included (per spec note)', () => {
    const s = makeState([[false]], [{ ownerId: 0, resource: Code.GOLD, hasCity: true }]);
    const out = recomputeResourceDoubles(s);
    expect(out.territories[0]!.hasResourceDouble).toBe(true);
  });

  it('clears double flag when city is destroyed', () => {
    const s = makeState([[false]], [{ ownerId: 0, resource: Code.IRON, hasCity: true, hasResourceDouble: true }]);
    s.territories[0]!.hasCity = false;
    const out = recomputeResourceDoubles(s);
    expect(out.territories[0]!.hasResourceDouble).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/activation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/activation.ts`**

```ts
import type { GameState, Territory } from './types.js';
import { Code } from './codes.js';

// Mirrors LocApplet L2019-L2055. Stable (code 4) is excluded; codes 0-3 (Iron, Coal,
// Tree, Gold) all qualify for doubling.
export function recomputeResourceDoubles(state: GameState): GameState {
  const newTerritories: Territory[] = state.territories.map((t) => ({ ...t }));
  for (const t of newTerritories) {
    t.hasResourceDouble = computeDouble(state, newTerritories, t);
  }
  return { ...state, territories: newTerritories };
}

function computeDouble(state: GameState, terrs: Territory[], t: Territory): boolean {
  if (t.resource === null) return false;
  if (t.resource === Code.STABLE) return false;
  if (t.ownerId === null) return false;
  // Same-tile city
  if (t.hasCity) return true;
  // Adjacent friendly city
  for (let i = 0; i < terrs.length; i++) {
    if (i === t.id) continue;
    if (!state.touching[t.id]?.[i]) continue;
    const other = terrs[i]!;
    if (other.ownerId === t.ownerId && other.hasCity) return true;
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/activation.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/activation.ts tests/activation.test.ts
git commit -m "Add recomputeResourceDoubles for city activation sweep"
```

---

## Task 13: Production phase entry — 1/6 skip + reasons

**Files:**
- Create: `src/game/reducers/production.ts`
- Modify: `src/game/reducer.ts`
- Modify: `src/game/reducers/endPhase.ts`
- Create: `tests/reducers/production-skip.test.ts`

Reference: spec — "Production (25% chance to skip)" was wrong; the actual probability is 1/6 (`PHASE_SKIP_PROBABILITY`). On skip, log a `phase-skipped` entry with a `reasons.txt` line and **transition immediately to the next phase** (which is Trade — but Trade is Plan 3 territory, so for Plan 2 we'll transition to a placeholder `'trade'` phase and stop there).

For Plan 2: production phase entry runs immediately on transition from selection. The actual production tick is wired in Task 14. This task only handles the skip-vs-not-skip decision and logging.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';
import { REASONS } from '../../src/game/reasons.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: {
    waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' },
  },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function drainSelection(s: GameState): GameState {
  for (let i = 0; i < s.territories.length; i++) {
    const free = s.territories.find((t) => t.ownerId === null);
    if (!free) break;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  return s;
}

describe('production phase skip behavior', () => {
  it('production plan applies a skip-or-tick decision (deterministic by seed)', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    s = drainSelection(s);
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    // Now in 'production' phase. Issue the production plan.
    const out = reduce(s, { kind: 'production' });
    // Either we ticked (still in production, ready for endPhase) OR we skipped
    // (phase advanced to trade with a log entry from REASONS).
    if (out.currentPhase === 'trade') {
      const lastLog = out.log[out.log.length - 1]!;
      expect(REASONS).toContain(lastLog.message.replace(/^Production skipped: /, ''));
    } else {
      expect(out.currentPhase).toBe('production');
    }
  });

  it('production decision is deterministic per (seed, year, rngCursor)', () => {
    let a = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    a = drainSelection(a);
    a = reduce(a, { kind: 'endPhase', player: a.currentPlayer });
    a = reduce(a, { kind: 'production' });

    let b = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    b = drainSelection(b);
    b = reduce(b, { kind: 'endPhase', player: b.currentPlayer });
    b = reduce(b, { kind: 'production' });

    expect(a.currentPhase).toBe(b.currentPhase);
    expect(a.log.length).toBe(b.log.length);
  });

  it('production plan rejects when not in production phase', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    expect(() => reduce(s, { kind: 'production' })).toThrow(/phase/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/production-skip.test.ts`
Expected: FAIL — production case in reducer still throws.

- [ ] **Step 3: Implement `src/game/reducers/production.ts`**

```ts
import type { GameState } from '../types.js';
import { PHASE_SKIP_PROBABILITY } from '../constants.js';
import { createRng, nextFloat } from '../rng.js';
import { pickReason } from '../reasons.js';

export function applyProduction(prev: GameState): GameState {
  if (prev.currentPhase !== 'production') {
    throw new Error(`Production plan illegal during ${prev.currentPhase} phase`);
  }
  // Build an RNG positioned at the persistent state cursor
  const rng = { seed: prev.seed, cursor: prev.rngCursor };
  const skipRoll = nextFloat(rng);
  if (skipRoll < PHASE_SKIP_PROBABILITY) {
    const reason = pickReason(rng);
    return {
      ...prev,
      rngCursor: rng.cursor,
      currentPhase: 'trade', // skip directly to next phase
      log: [
        ...prev.log,
        { year: prev.year, phase: 'production', player: prev.currentPlayer,
          message: `Production skipped: ${reason}` },
      ],
    };
  }
  // Production tick — implemented in Task 14.
  // For now, stay in production phase (the production-tick handler runs in Task 14).
  return {
    ...prev,
    rngCursor: rng.cursor,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'production', player: prev.currentPlayer,
        message: 'Production phase begins (tick stub)' },
    ],
  };
}
```

- [ ] **Step 4: Wire into reducer**

In `src/game/reducer.ts`:
```ts
import { applyProduction } from './reducers/production.js';

// inside switch:
    case 'production':
      return applyProduction(state);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/production-skip.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/production.ts src/game/reducer.ts tests/reducers/production-skip.test.ts
git commit -m "Implement production phase entry with 1/6 skip and reasons.txt"
```

---

## Task 14: Production tick — per-resource yield (codes 0-3)

**Files:**
- Modify: `src/game/reducers/production.ts`
- Create: `tests/reducers/production-tick.test.ts`

When NOT skipped, the production phase iterates every owned territory and yields:
- For resource codes 0-3 (Iron, Coal, Tree, Gold): `+1` to that owner's stockpile slot, `+2` if `hasResourceDouble`.
- For Stable (code 4): handled in Task 15 (`addHorse`).
- After per-territory tick: leave the player whose territory we just ticked... actually, Gettman ticks for all territories regardless of player order. We do the same.

Replace the "production tick stub" with the real tick. The production tick runs once per `production` plan invocation; the engine driver (CLI or future UI) decides when to issue it.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import { Code } from '../../src/game/codes.js';
import type { GameState, Territory, GameSetup } from '../../src/game/types.js';

// Inject a state directly (skip mapgen) so we can pin specific resources.
function injectState(territories: Partial<Territory>[]): GameState {
  const setup: GameSetup = {
    players: [
      { color: 'red', name: 'r', persona: 'human' },
      { color: 'blue', name: 'b', persona: 'human' },
    ],
    citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
    map: {
      waterBoundary: true, waterArea: 'small', numTerritories: territories.length,
      islands: 'some', shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    },
  };
  const ts: Territory[] = territories.map((t, i) => ({
    id: i, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
    ...t,
  }));
  return {
    schemaVersion: 1, seed: 0xC0FFEE, rngCursor: 100, // jump past skip roll
    setup,
    squares: [], territories: ts, touching: [], distance: [],
    boats: new Array(256).fill(null),
    players: [
      { id: 0, name: 'r', color: 'red', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
      { id: 1, name: 'b', color: 'blue', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
    ],
    turnOrder: [0, 1], currentPhase: 'production', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false,
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [[false, false], [false, false]],
    log: [],
  };
}

// Pick a seed where the skip-roll DOES NOT fire. We can verify by inspecting
// the result of `nextFloat({seed:0xC0FFEE, cursor:100})` — but easier: keep
// trying cursors until skipRoll >= 1/6.

describe('production tick', () => {
  it('yields +1 to each resource on owned territories', () => {
    const s = injectState([
      { ownerId: 0, resource: Code.IRON },
      { ownerId: 0, resource: Code.GOLD },
      { ownerId: 1, resource: Code.COAL },
    ]);
    // Use a seed that doesn't trigger skip on the first roll. seed=0xC0FFEE
    // cursor=100 might skip — try several cursors and find a non-skip one.
    let state = s;
    for (let attempts = 0; attempts < 100; attempts++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        // Did not skip. Verify yields.
        expect(out.players[0]!.stockpile[Code.IRON]).toBe(1);
        expect(out.players[0]!.stockpile[Code.GOLD]).toBe(1);
        expect(out.players[1]!.stockpile[Code.COAL]).toBe(1);
        return;
      }
      // Try with a different starting cursor to dodge the skip
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('Could not find a non-skip production roll in 100 attempts');
  });

  it('yields +2 when hasResourceDouble is true', () => {
    let state = injectState([
      { ownerId: 0, resource: Code.IRON, hasResourceDouble: true },
    ]);
    for (let attempts = 0; attempts < 100; attempts++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        expect(out.players[0]!.stockpile[Code.IRON]).toBe(2);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('Could not find a non-skip production roll');
  });

  it('does not yield from unowned territories', () => {
    let state = injectState([{ ownerId: null, resource: Code.IRON }]);
    for (let attempts = 0; attempts < 100; attempts++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        expect(out.players[0]!.stockpile[Code.IRON]).toBe(0);
        expect(out.players[1]!.stockpile[Code.IRON]).toBe(0);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('Could not find a non-skip production roll');
  });

  it('Stable (code 4) does NOT yield to the stockpile via this path', () => {
    let state = injectState([{ ownerId: 0, resource: Code.STABLE }]);
    for (let attempts = 0; attempts < 100; attempts++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        // Slot 4 may be incremented later (Task 15: addHorse via stockpile);
        // for the per-resource tick, slot 4 stays at 0.
        expect(out.players[0]!.stockpile[Code.STABLE]).toBe(0);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('Could not find a non-skip production roll');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/production-tick.test.ts`
Expected: FAIL — current production stub doesn't yield resources.

- [ ] **Step 3: Update `src/game/reducers/production.ts`**

Replace the "production tick stub" branch (after the skip check) with:

```ts
  // Real production tick: codes 0-3 yield to stockpile.
  const players = prev.players.map((p) => ({ ...p, stockpile: [...p.stockpile] as typeof p.stockpile }));
  for (const t of prev.territories) {
    if (t.ownerId === null) continue;
    if (t.resource === null) continue;
    if (t.resource < 0 || t.resource > 3) continue; // codes 0..3 only here; Stable in next task
    const yield_ = t.hasResourceDouble ? 2 : 1;
    players[t.ownerId]!.stockpile[t.resource] += yield_;
  }
  return {
    ...prev,
    rngCursor: rng.cursor,
    players,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'production', player: prev.currentPlayer, message: 'Production tick complete' },
    ],
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/production-tick.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/production.ts tests/reducers/production-tick.test.ts
git commit -m "Implement production tick for resource codes 0-3 (Iron/Coal/Tree/Gold)"
```

---

## Task 15: `addHorse` — Stable produces horse units

**Files:**
- Modify: `src/game/reducers/production.ts`
- Create: `tests/reducers/production-stable.test.ts`

Reference: spec — "Code 4 (Stable): produces a Horse via `addHorse`. If the territory is empty of horses, place a horse on it. Otherwise, recursively try a 4-neighbor that's also owned by the same player and lacks a horse."

The recursion uses the seeded RNG to pick the random neighbor.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import { Code } from '../../src/game/codes.js';
import type { GameState, Territory, GameSetup } from '../../src/game/types.js';

function injectState(territories: Partial<Territory>[], touching: boolean[][]): GameState {
  const setup: GameSetup = {
    players: [{ color: 'red', name: 'r', persona: 'human' }, { color: 'blue', name: 'b', persona: 'human' }],
    citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
    map: { waterBoundary: true, waterArea: 'small', numTerritories: territories.length, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
  };
  const ts: Territory[] = territories.map((t, i) => ({
    id: i, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
    ...t,
  }));
  return {
    schemaVersion: 1, seed: 0xCAFEBABE, rngCursor: 100, setup,
    squares: [], territories: ts, touching, distance: [],
    boats: new Array(256).fill(null),
    players: [
      { id: 0, name: 'r', color: 'red', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
      { id: 1, name: 'b', color: 'blue', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
    ],
    turnOrder: [0, 1], currentPhase: 'production', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false,
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [[false, false], [false, false]] as unknown as never,
    autoReject: [[false, false], [false, false]],
    log: [],
  };
}

describe('production: Stable → horse', () => {
  it('places a horse on the Stable tile when it has no horse', () => {
    let state = injectState(
      [{ ownerId: 0, resource: Code.STABLE, hasHorse: false }],
      [[false]],
    );
    for (let i = 0; i < 100; i++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        expect(out.territories[0]!.hasHorse).toBe(true);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('non-skip production not found');
  });

  it('spreads to a neighbor when Stable tile already has a horse', () => {
    let state = injectState(
      [
        { ownerId: 0, resource: Code.STABLE, hasHorse: true },
        { ownerId: 0, hasHorse: false },
      ],
      [[false, true], [true, false]],
    );
    for (let i = 0; i < 100; i++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        expect(out.territories[1]!.hasHorse).toBe(true);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('non-skip production not found');
  });

  it('does not spread to enemy neighbors', () => {
    let state = injectState(
      [
        { ownerId: 0, resource: Code.STABLE, hasHorse: true },
        { ownerId: 1, hasHorse: false },
      ],
      [[false, true], [true, false]],
    );
    for (let i = 0; i < 100; i++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        expect(out.territories[1]!.hasHorse).toBe(false);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('non-skip production not found');
  });

  it('horse is lost if no friendly neighbor has space', () => {
    let state = injectState(
      [
        { ownerId: 0, resource: Code.STABLE, hasHorse: true },
        { ownerId: 0, hasHorse: true },
      ],
      [[false, true], [true, false]],
    );
    for (let i = 0; i < 100; i++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        // Both still have horse — original placement preserved, no overflow.
        expect(out.territories[0]!.hasHorse).toBe(true);
        expect(out.territories[1]!.hasHorse).toBe(true);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('non-skip production not found');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/production-stable.test.ts`
Expected: FAIL — Stable doesn't produce a horse yet.

- [ ] **Step 3: Update `src/game/reducers/production.ts`**

Add an `addHorseAt` helper and wire Stable into the tick loop. Replace the production-tick branch with:

```ts
import type { Territory } from '../types.js';
import { type RngState, nextInt } from '../rng.js';

function addHorseAt(
  territories: Territory[],
  touching: boolean[][],
  startTerrId: number,
  ownerId: number,
  rng: RngState,
  visited: Set<number> = new Set(),
): boolean {
  if (visited.has(startTerrId)) return false;
  visited.add(startTerrId);
  const t = territories[startTerrId];
  if (!t) return false;
  if (t.ownerId !== ownerId) return false;
  if (!t.hasHorse) {
    territories[startTerrId] = { ...t, hasHorse: true };
    return true;
  }
  // Pick a random friendly neighbor that has no horse and recurse.
  const candidates: number[] = [];
  for (let i = 0; i < territories.length; i++) {
    if (i === startTerrId) continue;
    if (!touching[startTerrId]?.[i]) continue;
    if (territories[i]!.ownerId !== ownerId) continue;
    if (visited.has(i)) continue;
    candidates.push(i);
  }
  // Random shuffle
  for (let k = candidates.length - 1; k > 0; k--) {
    const j = nextInt(rng, k + 1);
    [candidates[k], candidates[j]] = [candidates[j]!, candidates[k]!];
  }
  for (const c of candidates) {
    if (addHorseAt(territories, touching, c, ownerId, rng, visited)) return true;
  }
  return false;
}
```

Update the production tick loop:
```ts
  // Real production tick.
  const players = prev.players.map((p) => ({ ...p, stockpile: [...p.stockpile] as typeof p.stockpile }));
  const territories: Territory[] = prev.territories.map((t) => ({ ...t }));
  for (const t of prev.territories) {
    if (t.ownerId === null) continue;
    if (t.resource === null) continue;
    if (t.resource >= 0 && t.resource <= 3) {
      const yield_ = t.hasResourceDouble ? 2 : 1;
      players[t.ownerId]!.stockpile[t.resource] += yield_;
    } else if (t.resource === 4 /* Stable */) {
      addHorseAt(territories, prev.touching, t.id, t.ownerId, rng);
    }
  }
  return {
    ...prev,
    rngCursor: rng.cursor,
    territories,
    players,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'production', player: prev.currentPlayer, message: 'Production tick complete' },
    ],
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/production-stable.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: every previous test still passes.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/production.ts tests/reducers/production-stable.test.ts
git commit -m "Add Stable → horse production with recursive friendly-neighbor spread"
```

---

## Task 16: Auto-locate-stockpile after production

**Files:**
- Modify: `src/game/reducers/production.ts`
- Create: `tests/reducers/production-stockpile-prompt.test.ts`

Reference: spec — "After production, if any player has a non-empty stockpile but `stockpileLocation == null`, force a 'Locate Stockpile' interaction."

We model this by *not* automatically dropping the stockpile; instead, the engine sets a boolean flag (or, more cleanly, leaves `stockpileLocation === null` and the engine's caller is expected to dispatch a `shipStockpile` plan to place it). For Plan 2, we add a getter helper `playersNeedingStockpileLocation(state)` and assert that production leaves the state in the right shape for callers to handle.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import { Code } from '../../src/game/codes.js';
import { playersNeedingStockpileLocation } from '../../src/game/reducers/production.js';
import type { GameState, Territory, GameSetup } from '../../src/game/types.js';

function injectState(territories: Partial<Territory>[]): GameState {
  const setup: GameSetup = {
    players: [{ color: 'red', name: 'r', persona: 'human' }, { color: 'blue', name: 'b', persona: 'human' }],
    citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
    map: { waterBoundary: true, waterArea: 'small', numTerritories: territories.length, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
  };
  const ts: Territory[] = territories.map((t, i) => ({
    id: i, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
    ...t,
  }));
  return {
    schemaVersion: 1, seed: 0xBEEF1234, rngCursor: 100, setup,
    squares: [], territories: ts, touching: ts.map(() => ts.map(() => false)), distance: [],
    boats: new Array(256).fill(null),
    players: [
      { id: 0, name: 'r', color: 'red', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
      { id: 1, name: 'b', color: 'blue', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
    ],
    turnOrder: [0, 1], currentPhase: 'production', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false,
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [[false, false], [false, false]],
    log: [],
  };
}

describe('playersNeedingStockpileLocation', () => {
  it('returns players who own land, have a non-empty stockpile, but no stockpileLocation', () => {
    let state = injectState([
      { ownerId: 0, resource: Code.IRON },
      { ownerId: 1, resource: Code.GOLD },
    ]);
    for (let i = 0; i < 100; i++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        const need = playersNeedingStockpileLocation(out);
        expect(need.sort()).toEqual([0, 1]);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('non-skip production not found');
  });

  it('does not include players whose stockpile is still empty', () => {
    let state = injectState([
      { ownerId: 0 /* no resource */ },
      { ownerId: 1, resource: Code.GOLD },
    ]);
    for (let i = 0; i < 100; i++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        const need = playersNeedingStockpileLocation(out);
        expect(need).toEqual([1]);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('non-skip production not found');
  });

  it('does not include players who already have stockpileLocation set', () => {
    let state = injectState([
      { ownerId: 0, resource: Code.IRON },
    ]);
    state.players[0]!.stockpileLocation = 0;
    state.territories[0]!.hasStockpile = true;
    for (let i = 0; i < 100; i++) {
      const out = reduce(state, { kind: 'production' });
      if (out.currentPhase === 'production') {
        const need = playersNeedingStockpileLocation(out);
        expect(need).toEqual([]);
        return;
      }
      state = { ...state, rngCursor: state.rngCursor + 1 };
    }
    throw new Error('non-skip production not found');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/production-stockpile-prompt.test.ts`
Expected: FAIL — `playersNeedingStockpileLocation` not exported.

- [ ] **Step 3: Append to `src/game/reducers/production.ts`**

```ts
export function playersNeedingStockpileLocation(state: GameState): number[] {
  const need: number[] = [];
  for (const p of state.players) {
    if (p.status !== 'playing') continue;
    if (p.stockpileLocation !== null) continue;
    const stockpileSum =
      p.stockpile[0] + p.stockpile[1] + p.stockpile[2] + p.stockpile[3] + p.stockpile[4];
    if (stockpileSum === 0) continue;
    // Player must also own at least one territory to drop stockpile on
    const ownsLand = state.territories.some((t) => t.ownerId === p.id);
    if (!ownsLand) continue;
    need.push(p.id);
  }
  return need;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/production-stockpile-prompt.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/production.ts tests/reducers/production-stockpile-prompt.test.ts
git commit -m "Expose playersNeedingStockpileLocation for post-production prompt"
```

---

## Task 17: `savegame` and `loadgame` plan handlers

**Files:**
- Create: `src/game/reducers/persistence.ts`
- Modify: `src/game/reducer.ts`
- Modify: `src/game/plans.ts` — add `storage` injection
- Create: `tests/reducers/persistence.test.ts`

The reducer is pure and synchronous. To save to localStorage from inside a reducer, we'd need to inject the storage backend. Cleanest pattern: the reducer for `savegame` is a no-op for state (it returns the input state unchanged) — the *side effect* of writing to storage happens at the dispatcher layer, not inside `reduce`. The reducer simply emits a log entry.

`loadgame` *does* mutate state — it replaces the state with the loaded one (after schema validation, which the platform layer already does).

We therefore:
- Make `savegame` a log-only reducer (callers do the actual `saveGameToStorage` separately).
- Make `loadgame` accept an already-loaded `GameState` and replace state.

Update `Plan` accordingly (`savegame` already has `slot`, `loadgame` already has `state`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [{ color: 'red', name: 'r', persona: 'human' }, { color: 'blue', name: 'b', persona: 'human' }],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

describe('savegame & loadgame', () => {
  it('savegame appends a log entry without mutating other state', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    const yearBefore = s.year;
    const out = reduce(s, { kind: 'savegame', slot: 'autosave' });
    expect(out.year).toBe(yearBefore);
    const last = out.log[out.log.length - 1]!;
    expect(last.message).toMatch(/saved/i);
    expect(last.message).toMatch(/autosave/);
  });

  it('loadgame replaces the entire state with the provided state', () => {
    const a = reduce(initial(), { kind: 'newGame', setup, seed: 1 });
    const b = reduce(initial(), { kind: 'newGame', setup, seed: 2 });
    const out = reduce(a, { kind: 'loadgame', state: b });
    expect(out.seed).toBe(2);
    expect(out.squares).toEqual(b.squares);
  });

  it('loadgame validates schema version', () => {
    const a = reduce(initial(), { kind: 'newGame', setup, seed: 1 });
    const fake = { ...a, schemaVersion: 999 as 1 };
    expect(() => reduce(a, { kind: 'loadgame', state: fake })).toThrow(/schema/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/persistence.test.ts`
Expected: FAIL — savegame/loadgame still throws.

- [ ] **Step 3: Implement `src/game/reducers/persistence.ts`**

```ts
import type { GameState } from '../types.js';
import type { SaveSlot } from '../../platform/storage.js';

export function applySavegame(prev: GameState, slot: SaveSlot): GameState {
  return {
    ...prev,
    log: [
      ...prev.log,
      { year: prev.year, phase: prev.currentPhase, player: prev.currentPlayer,
        message: `Game saved to slot ${slot}` },
    ],
  };
}

export function applyLoadgame(_prev: GameState, loaded: GameState): GameState {
  if (loaded.schemaVersion !== 1) {
    throw new Error(`Cannot load: schema version ${loaded.schemaVersion} ≠ 1`);
  }
  return {
    ...loaded,
    log: [
      ...loaded.log,
      { year: loaded.year, phase: loaded.currentPhase, player: loaded.currentPlayer,
        message: 'Game loaded' },
    ],
  };
}
```

- [ ] **Step 4: Wire into reducer**

In `src/game/reducer.ts`:
```ts
import { applySavegame, applyLoadgame } from './reducers/persistence.js';

// inside switch:
    case 'savegame':
      return applySavegame(state, plan.slot);
    case 'loadgame':
      return applyLoadgame(state, plan.state);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/persistence.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/persistence.ts src/game/reducer.ts tests/reducers/persistence.test.ts
git commit -m "Implement savegame (log-only) and loadgame (state replace) handlers"
```

---

## Task 18: `loadmap` plan handler — decode + adjacency rebuild

**Files:**
- Create: `src/game/reducers/loadmap.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/loadmap.test.ts`

Reference: spec — "Loaded maps run `assessLakes(1)` (annex no water)" and rebuild touching/distance.

The `loadmap` plan accepts the text content of a map file and replaces the current board with the decoded one. Players, stockpiles, and turn state are left intact except that all territory ownership is reset to `null` (the loaded map has no owners) and the phase is reset to `'selection'`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import { encodeMap } from '../../src/game/mapTextCodec.js';
import { generateMap } from '../../src/game/mapgen/index.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [{ color: 'red', name: 'r', persona: 'human' }, { color: 'blue', name: 'b', persona: 'human' }],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

describe('loadmap', () => {
  it('replaces the board with a decoded one and resets ownership to null', () => {
    // Generate a board and encode it
    const board = generateMap(123, setup.map, 2);
    const text = encodeMap(board.squares);
    // Start a game with a different seed
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 999 });
    // Take some territory selections
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: 0 });
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: 1 });
    // Now load the other map
    const out = reduce(s, { kind: 'loadmap', mapText: text });
    expect(out.territories.every((t) => t.ownerId === null)).toBe(true);
    expect(out.currentPhase).toBe('selection');
    expect(out.touching).toBeDefined();
    expect(out.touching.length).toBe(out.territories.length);
  });

  it('rejects invalid map text', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 7 });
    expect(() => reduce(s, { kind: 'loadmap', mapText: 'not a map' }))
      .toThrow(/decode|invalid/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/loadmap.test.ts`
Expected: FAIL — loadmap still throws.

- [ ] **Step 3: Implement `src/game/reducers/loadmap.ts`**

```ts
import type { GameState, Territory } from '../types.js';
import { decodeMap } from '../mapTextCodec.js';
import { assessLakes } from '../mapgen/lakes.js';
import { buildTouching, buildDistance } from '../mapgen/adjacency.js';
import { computeBordersLakes } from '../mapgen/coast.js';

export function applyLoadmap(prev: GameState, mapText: string): GameState {
  const decoded = decodeMap(mapText, { numPlayers: prev.players.length || undefined });
  if (decoded.kind !== 'ok') {
    throw new Error(`Failed to decode map: ${decoded.code} ${decoded.message}`);
  }
  // Run the spec's mandated post-processing
  const squares = [...decoded.squares];
  assessLakes(squares, 1); // annex no water for loaded maps
  const numTerritories = decoded.numTerritories;
  const territories: Territory[] = Array.from({ length: numTerritories }, (_, id) => ({
    id, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
  }));
  for (let i = 0; i < squares.length; i++) {
    const tid = squares[i]!.territoryId;
    if (tid !== null) territories[tid]!.squares.push(i);
  }
  const touching = buildTouching(squares, numTerritories);
  const distance = buildDistance(touching);
  const lakes = computeBordersLakes(squares, numTerritories);
  for (let i = 0; i < numTerritories; i++) {
    territories[i]!.bordersLakes = lakes[i]!;
  }
  // Reset players' ownership-derived state
  const players = prev.players.map((p) => ({
    ...p,
    stockpile: [0, 0, 0, 0, 0] as typeof p.stockpile,
    stockpileLocation: null,
  }));
  return {
    ...prev,
    squares,
    territories,
    touching,
    distance,
    boats: new Array(prev.boats.length).fill(null),
    players,
    currentPhase: 'selection',
    currentPlayer: prev.turnOrder[0] ?? 0,
    year: 1,
    attackNumber: 1,
    shipmentUsed: false,
    pendingTrade: null,
    pendingCombat: null,
    rejectedTrades: [],
    log: [
      ...prev.log,
      { year: 1, phase: 'selection', player: prev.currentPlayer, message: 'Map loaded' },
    ],
  };
}
```

- [ ] **Step 4: Wire into reducer**

In `src/game/reducer.ts`:
```ts
import { applyLoadmap } from './reducers/loadmap.js';

// inside switch:
    case 'loadmap':
      return applyLoadmap(state, plan.mapText);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/loadmap.test.ts`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/loadmap.ts src/game/reducer.ts tests/reducers/loadmap.test.ts
git commit -m "Implement loadmap: decode, assessLakes(1), rebuild adjacency"
```

---

## Task 19: Snapshot test — selection-then-production canonical sequence

**Files:**
- Create: `tests/snapshots/selection-then-production.test.ts`

A canonical end-to-end sequence: NEW_GAME (seed 12345) → drain selection → endPhase → production (loop until non-skip) → assert state shape.

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'Red', persona: 'human' },
    { color: 'blue', name: 'Blue', persona: 'aggressive' },
    { color: 'cyan', name: 'Cyan', persona: 'defensive' },
    { color: 'purple', name: 'Purple', persona: 'passive' },
  ],
  citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

describe('selection → first production', () => {
  it('completes deterministically and produces stockpile yield', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 12345 });

    // Drain selection
    while (s.territories.some((t) => t.ownerId === null)) {
      const free = s.territories.find((t) => t.ownerId === null)!;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    expect(s.territories.every((t) => t.ownerId !== null)).toBe(true);

    // Move to production
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(s.currentPhase).toBe('production');
    expect(s.turnOrder).toEqual([3, 2, 1, 0]); // reversed from [0,1,2,3]

    // Run production. It might skip; if so, we're now in 'trade'.
    const beforeStockpiles = s.players.map((p) => [...p.stockpile]);
    s = reduce(s, { kind: 'production' });

    if (s.currentPhase === 'trade') {
      // Skipped — confirm no stockpile change.
      const afterStockpiles = s.players.map((p) => [...p.stockpile]);
      expect(afterStockpiles).toEqual(beforeStockpiles);
      const lastLog = s.log[s.log.length - 1]!;
      expect(lastLog.message).toMatch(/skipped/i);
    } else {
      // Ticked — at least one player should have +1 in some slot.
      const totalProduced = s.players
        .flatMap((p) => p.stockpile)
        .reduce((a, b) => a + b, 0);
      expect(totalProduced).toBeGreaterThan(0);
    }
  });

  it('runs identically on a re-run with the same seed', () => {
    function run(seed: number): GameState {
      let s = reduce(initial(), { kind: 'newGame', setup, seed });
      while (s.territories.some((t) => t.ownerId === null)) {
        const free = s.territories.find((t) => t.ownerId === null)!;
        s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
      }
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      s = reduce(s, { kind: 'production' });
      return s;
    }
    const a = run(12345);
    const b = run(12345);
    expect(a.players.map((p) => p.stockpile)).toEqual(b.players.map((p) => p.stockpile));
    expect(a.currentPhase).toBe(b.currentPhase);
    expect(a.log.length).toBe(b.log.length);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- tests/snapshots/selection-then-production.test.ts`
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/snapshots/selection-then-production.test.ts
git commit -m "Add canonical selection→production snapshot test"
```

---

## Task 20: CLI — `play-game` scripted demo

**Files:**
- Create: `src/cli/playGame.ts`
- Modify: `package.json` — add `"play-game": "tsx src/cli/playGame.ts"` script

Deliverable: `npm run play-game -- --seed 12345` runs setup, drains selection, runs first production, prints the resulting state summary.

- [ ] **Step 1: Add the npm script**

Modify `package.json`'s `scripts` block — add a line:
```json
"play-game": "tsx src/cli/playGame.ts",
```

- [ ] **Step 2: Implement `src/cli/playGame.ts`**

```ts
#!/usr/bin/env node
import { reduce } from '../game/reducer.js';
import type { GameState, GameSetup } from '../game/types.js';
import { Code } from '../game/codes.js';

function parseArgs(argv: string[]): { seed: number } {
  let seed = Date.now() & 0xffffffff;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--seed' && argv[i + 1]) { seed = Number(argv[++i]); }
    else if (a === '--help' || a === '-h') {
      console.log('Usage: npm run play-game -- --seed N');
      process.exit(0);
    }
  }
  return { seed };
}

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'Red', persona: 'human' },
    { color: 'blue', name: 'Blue', persona: 'aggressive' },
    { color: 'cyan', name: 'Cyan', persona: 'defensive' },
    { color: 'purple', name: 'Purple', persona: 'passive' },
  ],
  citiesToWin: 5,
  elementOfChance: 'high',
  randomizePlayerOrder: false,
  map: {
    waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' },
  },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

const { seed } = parseArgs(process.argv.slice(2));
let s = reduce(initial(), { kind: 'newGame', setup, seed });
console.log(`Seed: ${seed}`);
console.log(`Players: ${s.players.length}`);
console.log(`Initial turn order: ${s.turnOrder.join(', ')}`);
console.log('');

// Drain selection
console.log('--- Selection phase ---');
let selectionMoves = 0;
while (s.territories.some((t) => t.ownerId === null)) {
  const free = s.territories.find((t) => t.ownerId === null)!;
  s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  selectionMoves++;
}
console.log(`Drafted ${selectionMoves} territories.`);
const counts = new Array<number>(s.players.length).fill(0);
for (const t of s.territories) if (t.ownerId !== null) counts[t.ownerId]!++;
console.log(`Distribution: ${s.players.map((p, i) => `${p.name}=${counts[i]}`).join(', ')}`);

// End selection
s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
console.log(`\nReversed turn order: ${s.turnOrder.join(', ')}`);

// First production
console.log('\n--- Production phase ---');
s = reduce(s, { kind: 'production' });
const lastLog = s.log[s.log.length - 1]!;
console.log(lastLog.message);
const resName: Record<number, string> = {
  [Code.IRON]: 'Iron', [Code.COAL]: 'Coal', [Code.TREE]: 'Tree',
  [Code.GOLD]: 'Gold', [Code.STABLE]: 'Stable',
};
console.log('\nStockpiles:');
for (const p of s.players) {
  const parts = p.stockpile
    .map((v, i) => `${resName[i]}=${v}`)
    .filter((part) => !part.endsWith('=0'));
  console.log(`  ${p.name.padEnd(8)} ${parts.length > 0 ? parts.join(' ') : '(empty)'}`);
}
console.log('\nHorses on the map:');
for (const t of s.territories) {
  if (t.hasHorse) {
    const owner = t.ownerId !== null ? s.players[t.ownerId]!.name : '(none)';
    console.log(`  T${t.id} (${owner})`);
  }
}
console.log(`\nFinal phase: ${s.currentPhase}`);
```

- [ ] **Step 3: Smoke-test the CLI**

Run: `npm run play-game -- --seed 12345`
Expected: prints seed, players, draft summary, reversed turn order, production message, stockpiles, horses (if any), final phase. No errors.

- [ ] **Step 4: Commit**

```bash
git add src/cli/playGame.ts package.json
git commit -m "Add play-game CLI: setup, selection, first production"
```

---

## Task 21: CLI — save/load smoke test

**Files:**
- Create: `src/cli/saveLoadSmoke.ts`
- Modify: `package.json`

Demonstrates: roundtrip a GameState through `JSON.stringify` / `JSON.parse` (the core of save/load) and verify it reduces identically afterward.

- [ ] **Step 1: Add npm script**

In `package.json` scripts:
```json
"save-load-smoke": "tsx src/cli/saveLoadSmoke.ts",
```

- [ ] **Step 2: Implement `src/cli/saveLoadSmoke.ts`**

```ts
#!/usr/bin/env node
import { reduce } from '../game/reducer.js';
import type { GameState, GameSetup } from '../game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'Red', persona: 'human' },
    { color: 'blue', name: 'Blue', persona: 'aggressive' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

const seed = Number(process.argv[2] ?? 12345);
let s = reduce(initial(), { kind: 'newGame', setup, seed });
// Drain selection
while (s.territories.some((t) => t.ownerId === null)) {
  const free = s.territories.find((t) => t.ownerId === null)!;
  s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
}
s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });

console.log('Roundtripping GameState through JSON...');
// Serialize Sets via JSON: bordersLakes is a Set, so JSON drops it. We serialize
// by replacing Sets with arrays explicitly in the envelope and rehydrating.
const serialized = JSON.stringify(s, (_, v) => {
  if (v instanceof Set) return { __set: [...v] };
  return v;
});
const reconstructed = JSON.parse(serialized, (_, v) => {
  if (v && typeof v === 'object' && '__set' in v && Array.isArray((v as { __set: unknown[] }).__set)) {
    return new Set((v as { __set: number[] }).__set);
  }
  return v;
}) as GameState;

console.log('Verifying state shape...');
if (reconstructed.schemaVersion !== 1) throw new Error('schemaVersion mismatch');
if (reconstructed.players.length !== s.players.length) throw new Error('players length mismatch');
if (reconstructed.territories.length !== s.territories.length) throw new Error('territories length mismatch');
console.log('OK.');

console.log('Running production on the reconstructed state...');
const out = reduce(reconstructed, { kind: 'production' });
console.log(`Phase: ${out.currentPhase}`);
console.log(`Last log: ${out.log[out.log.length - 1]!.message}`);
console.log('save/load smoke complete.');
```

- [ ] **Step 3: Smoke-test**

Run: `npm run save-load-smoke 12345`
Expected: prints roundtrip steps, ends with "save/load smoke complete." No errors.

- [ ] **Step 4: Commit**

```bash
git add src/cli/saveLoadSmoke.ts package.json
git commit -m "Add save-load smoke CLI roundtripping GameState through JSON"
```

---

## Task 22: Final verification — full test suite, typechecks, both CLIs

**Files:** none (verification only).

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass. Tally should be ≥ 130 across ≥ 25 files.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run gen-map (Plan 1 deliverable still works)**

Run: `npm run gen-map -- --seed 12345`
Expected: ASCII map + summary, no errors.

- [ ] **Step 4: Run play-game**

Run: `npm run play-game -- --seed 12345`
Expected: setup, selection drain, production output, no errors.

- [ ] **Step 5: Run save-load-smoke**

Run: `npm run save-load-smoke 12345`
Expected: completes without errors.

- [ ] **Step 6: Verify CheerpJ embed unaffected**

(If the user has the python http server running) `curl -sI http://localhost:8765/index.html` should return 200. The embed should still work.

No commit for this task.

---

## Self-review notes

- **Spec coverage:**
  - Reducer + Plan union: ✓ (Tasks 1–3, full Plan kinds enumerated; Plan 3 kinds throw "not implemented").
  - NEW_GAME: ✓ (Task 4) — runs mapgen, seats players, transitions to selection.
  - Save/load + URL seed + reasons.txt: ✓ (Tasks 5–7).
  - Selection phase: ✓ (Tasks 8–9) — including reverse-turn-order at end.
  - Force count primitive: ✓ (Tasks 10–11) — wired onto `GameState.touching`.
  - City activation sweep: ✓ (Task 12).
  - Production phase: ✓ (Tasks 13–16) — 1/6 skip with reasons, codes 0–3 yield, Stable spread, stockpile-prompt detection.
  - savegame / loadgame / loadmap handlers: ✓ (Tasks 17–18).
  - Snapshot test: ✓ (Task 19).
  - CLI deliverables: ✓ (Tasks 20–21).
  - Verification: ✓ (Task 22).

- **Deliberately deferred to Plan 3:**
  - Trade / Shipment / Conquest / Development phase handlers (and their plan kinds).
  - Force-count for combat; bring-forces and allies UI flow; combat resolution.
  - Year wrap (rotate turn order, eliminate zero-territory players, year++).
  - End-of-game detection (`checkEndOfGame`).
  - Triple-reject lockout + `autoReject` matrix lifecycle.
  - 25%-skip on Trade and Shipment phases (Production handles its own skip; the others are wired in Plan 3).

- **No placeholders.** Every task has full code or full commands.

- **Type consistency.**
  - `Plan` union, `GameState` shape, `getForceCount` signature, `applySelection` / `applyEndPhase` / `applyProduction` / `applyLoadgame` / `applyLoadmap` / `applySavegame` are all referenced consistently across tasks.

- **Commit cadence.** 21 commits (one per task with code; Task 22 has no commit).

- **Carries over Plan 1 follow-ups.** Task 18's `loadmap` handler explicitly calls `assessLakes(1)` and rebuilds adjacency, addressing the reviewer's noted gap.
