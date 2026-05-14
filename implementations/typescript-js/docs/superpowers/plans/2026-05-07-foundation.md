# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the TypeScript project (Vite + Vitest), implement the deterministic primitives (RNG, `LocProb`), the map generator (40×20 grid, lakes, resource placement), and a round-trip map text codec. Deliverable: a `npm run gen-map -- --seed 12345` CLI that prints a 20×40 ASCII map plus a territory summary, plus full unit-test coverage.

**Architecture:** Pure functional core in `src/game/`. Zero browser dependencies (runs in Node for tests and the CLI). Single seedable RNG (`mulberry32`) with an explicit `cursor` so all randomness is reproducible. The map generator is a sequence of small pure functions, each independently testable. No reducer, no game state, no UI yet — those are Plans 2 and 4.

**Tech Stack:** TypeScript 5 (strict), Vitest, Node 20+, `tsx` for the CLI, no UI framework. The existing `index.html` (CheerpJ embed) stays at the project root untouched.

**Reference:** Decompiled Java source lives at `.reference/decompiled/` (gitignored). When tasks cite line numbers, they point into those files. Read them when porting.

---

## File Structure (locked in for Plan 1)

```
lords-of-conquest/
├── .gitignore                          # already exists
├── index.html                          # already exists (CheerpJ embed) — DO NOT TOUCH
├── loc.jar                             # already exists — DO NOT TOUCH
├── package.json                        # NEW — npm scripts, deps
├── tsconfig.json                       # NEW
├── vitest.config.ts                    # NEW
├── src/
│   ├── game/
│   │   ├── codes.ts                    # Code enum (Square.java codes 0..9)
│   │   ├── constants.ts                # PHASE_SKIP_PROBABILITY, MAX_PLAYERS, etc.
│   │   ├── aiConstants.ts              # ptResource[], ptCity, etc.
│   │   ├── types.ts                    # Square, Territory, MapParams, Board
│   │   ├── rng.ts                      # mulberry32 + RngState
│   │   ├── locProb.ts                  # combination, probSuccess
│   │   ├── mapgen/
│   │   │   ├── index.ts                # generateMap entry point
│   │   │   ├── board.ts                # initBoard, landBudget
│   │   │   ├── grow.ts                 # territory growth (regular + irregular)
│   │   │   ├── continent.ts            # seed-pick + island/continent constraint
│   │   │   ├── lakes.ts                # assessLakes
│   │   │   ├── adjacency.ts            # touching matrix + BFS distance
│   │   │   ├── coast.ts                # coastal/bordersLakes flags
│   │   │   └── resources.ts            # placeResources (fixed + random modes)
│   │   └── mapTextCodec.ts             # encodeMap, decodeMap
│   └── cli/
│       └── genMap.ts                   # CLI entry: parse args, generate, print
└── tests/
    ├── rng.test.ts
    ├── locProb.test.ts
    ├── mapgen/
    │   ├── board.test.ts
    │   ├── grow.test.ts
    │   ├── lakes.test.ts
    │   ├── adjacency.test.ts
    │   ├── resources.test.ts
    │   └── integration.test.ts
    └── mapTextCodec.test.ts
```

---

## Task 1: Project scaffolding — package.json + tsconfig

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.npmrc`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "lords-of-conquest",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "gen-map": "tsx src/cli/genMap.ts"
  },
  "devDependencies": {
    "@types/node": "^20.11.30",
    "tsx": "^4.7.1",
    "typescript": "^5.4.3",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Install deps**

Run: `npm install`
Expected: dependencies installed, `package-lock.json` created.

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors (no source yet, but tsc should not error on empty `include`).

- [ ] **Step 5: Update `.gitignore` to ignore `node_modules/` and `package-lock.json` decision**

Append to `.gitignore`:
```
node_modules/
```

(`package-lock.json` IS committed.)

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json package-lock.json .gitignore
git commit -m "Scaffold TypeScript project with Vitest and tsx"
```

---

## Task 2: Vitest config and smoke test

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/smoke.test.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: false,
    environment: 'node',
  },
});
```

- [ ] **Step 2: Write a smoke test that fails**

Create `tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs a basic assertion', () => {
    expect(2 + 2).toBe(5); // intentionally wrong to verify failure
  });
});
```

- [ ] **Step 3: Run and confirm it fails**

Run: `npm test`
Expected: 1 test failed.

- [ ] **Step 4: Fix the test**

Change `5` to `4` in `tests/smoke.test.ts`.

- [ ] **Step 5: Run and confirm it passes**

Run: `npm test`
Expected: 1 test passed.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/smoke.test.ts
git commit -m "Add Vitest config and smoke test"
```

---

## Task 3: `Code` enum (Square.java codes)

**Files:**
- Create: `src/game/codes.ts`
- Create: `tests/codes.test.ts`

Reference: `.reference/decompiled/Square.java` lines 5–23.

- [ ] **Step 1: Write the failing test**

Create `tests/codes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Code } from '../src/game/codes.js';

describe('Code', () => {
  it('matches Square.java numeric values exactly', () => {
    expect(Code.NOTHING).toBe(-1);
    expect(Code.IRON).toBe(0);
    expect(Code.COAL).toBe(1);
    expect(Code.TREE).toBe(2);
    expect(Code.GOLD).toBe(3);
    expect(Code.STABLE).toBe(4);
    expect(Code.CITY).toBe(5);
    expect(Code.HORSE).toBe(6);
    expect(Code.WEAPON).toBe(7);
    expect(Code.STOCKPILE).toBe(8);
    expect(Code.BOAT).toBe(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/codes.test.ts`
Expected: FAIL — module `../src/game/codes.js` not found.

- [ ] **Step 3: Implement `src/game/codes.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/codes.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/codes.ts tests/codes.test.ts
git commit -m "Add Code enum matching Square.java values"
```

---

## Task 4: Game constants

**Files:**
- Create: `src/game/constants.ts`
- Create: `tests/constants.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import * as C from '../src/game/constants.js';

describe('game constants', () => {
  it('matches Gettman pool sizes and grid dimensions', () => {
    expect(C.GRID_WIDTH).toBe(40);
    expect(C.GRID_HEIGHT).toBe(20);
    expect(C.MAX_PLAYERS).toBe(7);
    expect(C.MAX_TERRITORIES).toBe(64);
    expect(C.MAX_BOATS).toBe(256);
    expect(C.MAX_LAKES).toBe(256);
    expect(C.SQUARES_PER_TERRITORY_CAP).toBe(99);
    expect(C.NATIVES_PLAYER_ID).toBe(7);
  });

  it('uses 1/6 phase skip probability (LocApplet L2890)', () => {
    expect(C.PHASE_SKIP_PROBABILITY).toBeCloseTo(1 / 6, 6);
  });

  it('matches land budgets from LocApplet L3650-3680', () => {
    expect(C.LAND_BUDGET_WITH_BOUNDARY).toEqual({ small: 547, medium: 410, large: 274 });
    expect(C.LAND_BUDGET_WITHOUT_BOUNDARY).toEqual({ small: 640, medium: 480, large: 320 });
  });

  it('uses Gettman lake annex threshold and islands probability', () => {
    expect(C.LAKE_ANNEX_THRESHOLD).toBe(9);
    expect(C.ISLANDS_SOME_PROBABILITY).toBeCloseTo(0.25, 6);
  });

  it('exposes the 64-char map alphabet', () => {
    expect(C.MAP_ENCODE_ALPHABET).toBe(
      '123456789ABCDEFGHIJKLMNPQRSTUWXYZabcdefghijklmnpqrstvwxyz@$%&*()'
    );
    expect(C.MAP_ENCODE_ALPHABET).toHaveLength(64);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/constants.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/constants.ts`**

```ts
// LocApplet L2890
export const PHASE_SKIP_PROBABILITY = 1 / 6;

// LocApplet L3650-3680
export const LAND_BUDGET_WITH_BOUNDARY = { small: 547, medium: 410, large: 274 } as const;
export const LAND_BUDGET_WITHOUT_BOUNDARY = { small: 640, medium: 480, large: 320 } as const;

// LocApplet L3843
export const LAKE_ANNEX_THRESHOLD = 9;

// LocApplet L3699
export const ISLANDS_SOME_PROBABILITY = 0.25;

// LocApplet L3935 — 64 chars, drives MAX_TERRITORIES
export const MAP_ENCODE_ALPHABET =
  '123456789ABCDEFGHIJKLMNPQRSTUWXYZabcdefghijklmnpqrstvwxyz@$%&*()';

// Pool sizes
export const MAX_PLAYERS = 7;
export const MAX_TERRITORIES = 64;
export const MAX_BOATS = 256;
export const MAX_LAKES = 256;
export const SQUARES_PER_TERRITORY_CAP = 99;
export const NATIVES_PLAYER_ID = 7;

// Grid
export const GRID_WIDTH = 40;
export const GRID_HEIGHT = 20;

// UI / pacing (used in Plan 4 — declared here for forward reference)
export const COMBAT_FLICKER_MS_PER_DIE = 50;
export const AI_THINK_PAUSE_MS = 1000;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/constants.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/constants.ts tests/constants.test.ts
git commit -m "Add game constants matching Gettman pool sizes and rates"
```

---

## Task 5: AI scoring constants

**Files:**
- Create: `src/game/aiConstants.ts`
- Create: `tests/aiConstants.test.ts`

Reference: `.reference/decompiled/LocAI.java` lines 5–50.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import * as A from '../src/game/aiConstants.js';

describe('AI constants', () => {
  it('matches LocAI.java L15-50 exactly', () => {
    expect(A.ptCity).toBe(8);
    expect(A.ptStockpile).toBe(15);
    expect(A.ptRatingsBoundary).toBe(50);
    expect(A.ptCanBuildCity).toBe(8);
    expect(A.ptCanBuildWeapon).toBe(3);
    expect(A.ptCanBuildBoat).toBe(2);
    expect(A.ptTerrWRes).toBe(2);
    expect(A.ptOppWinCity).toBe(-10000);
    expect(A.ptFCAdvOwnTerr).toBe(1);
    expect(A.ptFCAdvOppTerr).toBe(1);
    expect(A.ptFCDisOwnTerr).toBe(-5);
    expect(A.ptFCDisOppTerr).toBe(-3);
    expect(A.ptVulnerableHorse).toBe(-2);
    expect(A.ptVulnerableWeapon).toBe(-6);
    expect(A.ptVulnerableBoat).toBe(-4);
    expect(A.ptVulnerableCity).toBe(-8);
    expect(A.ptFCDisStockpile).toBe(-5);
    expect(A.ptFCAdvStockpile).toBe(1);
    expect(A.ptGroupHorseWeapon).toBe(1);
    expect(A.ptGroupBoatHW).toBe(1);
    expect(A.ptOwnForceCount).toBe(1);
    expect(A.ptOppForceCount).toBe(-1);
    expect(A.ptOppBoatPotential).toBe(-6);
    expect(A.ptOneOfEach).toBe(2);
    expect(A.ptIronAndCoal).toBe(2);
    expect(A.ptFirstOfType).toBe(3);
    expect(A.ptTouchTerr).toBe(1);
    expect(A.ptTouchTerrWResource).toBe(2);
    expect(A.ptTerrVulnerable).toBe(-5);
    expect(A.ptTouchOwnTerr).toBe(1);
    expect(A.ptTouchOwnTerrWResource).toBe(2);
  });

  it('ptResource is [7, 7, 7, 9, 7]', () => {
    expect(A.ptResource).toEqual([7, 7, 7, 9, 7]);
    expect(A.ptResource).toHaveLength(5);
  });

  it('persona codes match LocAI.java L9-12', () => {
    expect(A.PERSONA_HUMAN).toBe(0);
    expect(A.PERSONA_PASSIVE).toBe(1);
    expect(A.PERSONA_DEFENSIVE).toBe(2);
    expect(A.PERSONA_AGGRESSIVE).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/aiConstants.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/aiConstants.ts`**

```ts
// LocAI.java L9-12
export const PERSONA_HUMAN = 0;
export const PERSONA_PASSIVE = 1;
export const PERSONA_DEFENSIVE = 2;
export const PERSONA_AGGRESSIVE = 3;

// LocAI.java L15-50 — verbatim numeric constants
export const ptCity = 8;
export const ptStockpile = 15;
export const ptRatingsBoundary = 50;
export const ptCanBuildCity = 8;
export const ptCanBuildWeapon = 3;
export const ptCanBuildBoat = 2;
export const ptTerrWRes = 2;
export const ptOppWinCity = -10000;
export const ptFCAdvOwnTerr = 1;
export const ptFCAdvOppTerr = 1;
export const ptFCDisOwnTerr = -5;
export const ptFCDisOppTerr = -3;
export const ptVulnerableHorse = -2;
export const ptVulnerableWeapon = -6;
export const ptVulnerableBoat = -4;
export const ptVulnerableCity = -8;
export const ptFCDisStockpile = -5;
export const ptFCAdvStockpile = 1;
export const ptGroupHorseWeapon = 1;
export const ptGroupBoatHW = 1;
export const ptOwnForceCount = 1;
export const ptOppForceCount = -1;
export const ptOppBoatPotential = -6;
export const ptResource: readonly number[] = [7, 7, 7, 9, 7];
export const ptOneOfEach = 2;
export const ptIronAndCoal = 2;
export const ptFirstOfType = 3;
export const ptTouchTerr = 1;
export const ptTouchTerrWResource = 2;
export const ptTerrVulnerable = -5;
export const ptTouchOwnTerr = 1;
export const ptTouchOwnTerrWResource = 2;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/aiConstants.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/aiConstants.ts tests/aiConstants.test.ts
git commit -m "Add AI scoring constants verbatim from LocAI.java"
```

---

## Task 6: Seedable RNG (mulberry32)

**Files:**
- Create: `src/game/rng.ts`
- Create: `tests/rng.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { createRng, nextFloat, nextInt, type RngState } from '../src/game/rng.js';

describe('rng', () => {
  it('createRng returns state with seed and zero cursor', () => {
    const r = createRng(42);
    expect(r.seed).toBe(42);
    expect(r.cursor).toBe(0);
  });

  it('same seed produces identical sequence', () => {
    const a = createRng(123);
    const b = createRng(123);
    const seqA = [nextFloat(a), nextFloat(a), nextFloat(a)];
    const seqB = [nextFloat(b), nextFloat(b), nextFloat(b)];
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different first draws', () => {
    expect(nextFloat(createRng(1))).not.toBe(nextFloat(createRng(2)));
  });

  it('nextFloat returns values in [0, 1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = nextFloat(r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt(r, n) returns 0..n-1', () => {
    const r = createRng(99);
    const counts = new Array<number>(5).fill(0);
    for (let i = 0; i < 5000; i++) {
      const v = nextInt(r, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      counts[v]!++;
    }
    // Loosely uniform — every bucket got hit
    counts.forEach((c) => expect(c).toBeGreaterThan(500));
  });

  it('cursor increments on each draw', () => {
    const r = createRng(5);
    nextFloat(r);
    nextFloat(r);
    nextInt(r, 10);
    expect(r.cursor).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/rng.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/rng.ts`**

```ts
// Seedable PRNG. Single instance per game; cursor advances on every draw so
// (seed, cursor) → state is fully reproducible.
export type RngState = {
  seed: number;
  cursor: number;
};

export function createRng(seed: number): RngState {
  return { seed, cursor: 0 };
}

// Mulberry32: 32-bit state, fast, good distribution for game-scale needs.
function mulberry32(state: number): number {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextFloat(r: RngState): number {
  // Mix seed + cursor so independent (seed, cursor) pairs give independent draws
  const v = mulberry32((r.seed ^ Math.imul(r.cursor + 1, 0x85ebca6b)) >>> 0);
  r.cursor++;
  return v;
}

export function nextInt(r: RngState, exclusiveMax: number): number {
  if (exclusiveMax <= 0) return 0;
  return Math.floor(nextFloat(r) * exclusiveMax);
}

export function nextBool(r: RngState, probabilityTrue = 0.5): boolean {
  return nextFloat(r) < probabilityTrue;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/rng.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/rng.ts tests/rng.test.ts
git commit -m "Add seedable mulberry32 RNG with explicit cursor"
```

---

## Task 7: `LocProb.combination`

**Files:**
- Create: `src/game/locProb.ts`
- Create: `tests/locProb.test.ts`

Reference: `.reference/decompiled/LocProb.java` L5–20.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { combination } from '../src/game/locProb.js';

describe('combination', () => {
  it('C(n, 0) = 1', () => {
    expect(combination(5, 0)).toBe(1);
    expect(combination(0, 0)).toBe(1);
  });
  it('C(n, n) = 1', () => {
    expect(combination(5, 5)).toBe(1);
  });
  it('C(5, 2) = 10', () => {
    expect(combination(5, 2)).toBe(10);
  });
  it('C(10, 3) = 120', () => {
    expect(combination(10, 3)).toBe(120);
  });
  it('C(20, 10) = 184756', () => {
    expect(combination(20, 10)).toBe(184756);
  });
  it('returns 0 for negative inputs (Gettman edge)', () => {
    expect(combination(-1, 2)).toBe(0);
    expect(combination(5, -1)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/locProb.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/locProb.ts`** (combination only for now)

```ts
// Mirrors LocProb.java L5-20.
export function combination(n: number, k: number): number {
  if (n < 0 || k < 0) return 0;
  if (k === 0 || n === 0) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result *= (n - i) / (i + 1);
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/locProb.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/locProb.ts tests/locProb.test.ts
git commit -m "Add LocProb.combination with negative-input guard"
```

---

## Task 8: `LocProb.probSuccess` base cases

**Files:**
- Modify: `src/game/locProb.ts`
- Modify: `tests/locProb.test.ts`

Reference: `.reference/decompiled/LocProb.java` L22–43.

- [ ] **Step 1: Append failing tests for the base cases**

Append to `tests/locProb.test.ts`:
```ts
import { probSuccess } from '../src/game/locProb.js';

describe('probSuccess base cases', () => {
  it('attacker <= 0 ⇒ 0', () => {
    expect(probSuccess(0, 5)).toBe(0);
    expect(probSuccess(-3, 5)).toBe(0);
  });
  it('defender <= 0 ⇒ 1', () => {
    expect(probSuccess(5, 0)).toBe(1);
    expect(probSuccess(5, -1)).toBe(1);
  });
  it('attacker == 1 ⇒ 0.5^def', () => {
    expect(probSuccess(1, 1)).toBeCloseTo(0.5, 10);
    expect(probSuccess(1, 3)).toBeCloseTo(0.125, 10);
    expect(probSuccess(1, 5)).toBeCloseTo(1 / 32, 10);
  });
  it('defender == 1 ⇒ 1 - 0.5^att', () => {
    expect(probSuccess(1, 1)).toBeCloseTo(0.5, 10);
    expect(probSuccess(3, 1)).toBeCloseTo(1 - 0.125, 10);
    expect(probSuccess(5, 1)).toBeCloseTo(1 - 1 / 32, 10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/locProb.test.ts`
Expected: FAIL — `probSuccess` not exported.

- [ ] **Step 3: Append `probSuccess` (base cases only) to `src/game/locProb.ts`**

```ts
export function probSuccess(att: number, def: number): number {
  if (att <= 0) return 0;
  if (def <= 0) return 1;
  if (att === 1) return Math.pow(0.5, def);
  if (def === 1) return 1 - Math.pow(0.5, att);
  // General case implemented in Task 9
  throw new Error('General case not implemented yet');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/locProb.test.ts`
Expected: 10 passed (combination tests + 4 base-case tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/locProb.ts tests/locProb.test.ts
git commit -m "Add probSuccess base cases (att/def <= 0, att/def == 1)"
```

---

## Task 9: `LocProb.probSuccess` general case

**Files:**
- Modify: `src/game/locProb.ts`
- Modify: `tests/locProb.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `tests/locProb.test.ts`:
```ts
describe('probSuccess general case', () => {
  it('symmetric attack 2v2 ≈ 0.5', () => {
    expect(probSuccess(2, 2)).toBeCloseTo(0.5, 10);
  });
  it('larger attacker wins more often', () => {
    expect(probSuccess(5, 3)).toBeGreaterThan(0.5);
    expect(probSuccess(10, 3)).toBeGreaterThan(probSuccess(5, 3));
  });
  it('matches Gettman formula for 3v3', () => {
    // Σ C(att+def-1, k) for k=0..att-1, divided by 2^(att+def-1)
    // For (3,3): (C(5,0) + C(5,1) + C(5,2)) / 2^5 = (1 + 5 + 10) / 32 = 16/32 = 0.5
    expect(probSuccess(3, 3)).toBeCloseTo(0.5, 10);
  });
  it('matches Gettman formula for 4v2', () => {
    // (C(5,0)+C(5,1)+C(5,2)+C(5,3))/32 = (1+5+10+10)/32 = 26/32 = 0.8125
    expect(probSuccess(4, 2)).toBeCloseTo(0.8125, 10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/locProb.test.ts`
Expected: FAIL with "General case not implemented yet".

- [ ] **Step 3: Implement the general case**

Replace the `throw` in `src/game/locProb.ts` with:
```ts
  let sum = 0;
  for (let k = 0; k < att; k++) {
    sum += combination(att + def - 1, k);
  }
  return sum / Math.pow(2, att + def - 1);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/locProb.test.ts`
Expected: 14 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/locProb.ts tests/locProb.test.ts
git commit -m "Implement LocProb.probSuccess general case"
```

---

## Task 10: Monte-Carlo parity test for `probSuccess`

**Files:**
- Modify: `tests/locProb.test.ts`

- [ ] **Step 1: Append a Monte-Carlo parity test**

```ts
import { createRng, nextFloat } from '../src/game/rng.js';

function simulateBattle(att: number, def: number, r: ReturnType<typeof createRng>): boolean {
  let a = att;
  let d = def;
  while (a > 0 && d > 0) {
    if (nextFloat(r) < 0.5) a--;
    else d--;
  }
  return d === 0;
}

describe('probSuccess Monte-Carlo parity', () => {
  it.each([
    [2, 3], [3, 2], [4, 4], [5, 7], [10, 8],
  ])('closed-form ≈ simulation for %i vs %i', (att, def) => {
    const r = createRng(0xCAFE);
    const trials = 20_000;
    let wins = 0;
    for (let i = 0; i < trials; i++) {
      if (simulateBattle(att, def, r)) wins++;
    }
    const empirical = wins / trials;
    const closedForm = probSuccess(att, def);
    expect(Math.abs(empirical - closedForm)).toBeLessThan(0.02);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/locProb.test.ts`
Expected: 19 passed (5 new parametric tests).

- [ ] **Step 3: Commit**

```bash
git add tests/locProb.test.ts
git commit -m "Add Monte-Carlo parity test for probSuccess"
```

---

## Task 11: Map types — `Square`, `Territory`, `MapParams`, `Board`

**Files:**
- Create: `src/game/types.ts`
- Create: `tests/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import type { Square, Territory, MapParams, Board } from '../src/game/types.js';
import { Code } from '../src/game/codes.js';

describe('types', () => {
  it('Square accepts the expected shape', () => {
    const s: Square = {
      x: 5, y: 7, territoryId: 0, lakeId: null, isBoundaryWater: false,
    };
    expect(s.x).toBe(5);
  });

  it('Territory accepts the expected shape', () => {
    const t: Territory = {
      id: 0,
      ownerId: null,
      resource: Code.IRON,
      hasCity: false,
      hasWeapon: false,
      hasHorse: false,
      hasStockpile: false,
      hasResourceDouble: false,
      squares: [0, 1, 2],
      bordersLakes: new Set<number>(),
      citiesAdjacent: 0,
    };
    expect(t.id).toBe(0);
  });

  it('MapParams has all expected fields', () => {
    const p: MapParams = {
      waterBoundary: true,
      waterArea: 'small',
      numTerritories: 24,
      islands: 'some',
      shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    };
    expect(p.numTerritories).toBe(24);
  });

  it('Board has squares and territories arrays', () => {
    const b: Board = { squares: [], territories: [] };
    expect(b.squares).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/types.ts`**

```ts
import type { ResourceCode } from './codes.js';

export type Square = {
  x: number;          // 0..GRID_WIDTH-1
  y: number;          // 0..GRID_HEIGHT-1
  territoryId: number | null;   // null = open water (or boundary water)
  lakeId: number | null;        // null on land or annexed water; otherwise lake index
  isBoundaryWater: boolean;
};

export type PlayerId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Territory = {
  id: number;
  ownerId: PlayerId | null;
  resource: ResourceCode | null;
  hasCity: boolean;
  hasWeapon: boolean;
  hasHorse: boolean;
  hasStockpile: boolean;
  hasResourceDouble: boolean;
  squares: number[];           // Square ids that make up this territory
  bordersLakes: Set<number>;
  citiesAdjacent: number;
};

export type ResourceDensity =
  | { kind: 'fixed'; level: 'veryLow' | 'low' | 'medium' | 'high' }
  | { kind: 'random'; level: 'veryLow' | 'low' | 'medium' | 'high' };

export type MapParams = {
  waterBoundary: boolean;
  waterArea: 'small' | 'medium' | 'large';
  numTerritories: number;
  islands: 'none' | 'some' | 'lots';
  shapes: 'regular' | 'irregular';
  resourceDensity: ResourceDensity;
};

export type Board = {
  squares: Square[];           // length GRID_WIDTH * GRID_HEIGHT
  territories: Territory[];    // length numTerritories
  // Adjacency caches (built after generation)
  touching?: boolean[][];      // [terrA][terrB] (square symmetric)
  distance?: number[][];       // BFS hops between territories
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/types.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/types.ts tests/types.test.ts
git commit -m "Add Square, Territory, MapParams, Board types"
```

---

## Task 12: Square indexing helpers

**Files:**
- Modify: `src/game/types.ts`
- Create: `tests/squareIndex.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { sqIndex, sqXY, NEIGHBOR_OFFSETS } from '../src/game/types.js';

describe('square indexing', () => {
  it('sqIndex(x, y) = y * GRID_WIDTH + x', () => {
    expect(sqIndex(0, 0)).toBe(0);
    expect(sqIndex(39, 0)).toBe(39);
    expect(sqIndex(0, 1)).toBe(40);
    expect(sqIndex(5, 3)).toBe(125);
  });

  it('sqXY is the inverse of sqIndex', () => {
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 40; x++) {
        const i = sqIndex(x, y);
        expect(sqXY(i)).toEqual({ x, y });
      }
    }
  });

  it('NEIGHBOR_OFFSETS has 4 cardinal directions in clockwise order from East', () => {
    // E, S, W, N
    expect(NEIGHBOR_OFFSETS).toEqual([
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/squareIndex.test.ts`
Expected: FAIL — exports not found.

- [ ] **Step 3: Append helpers to `src/game/types.ts`**

```ts
import { GRID_WIDTH } from './constants.js';

export function sqIndex(x: number, y: number): number {
  return y * GRID_WIDTH + x;
}

export function sqXY(i: number): { x: number; y: number } {
  return { x: i % GRID_WIDTH, y: Math.floor(i / GRID_WIDTH) };
}

// 4-neighbor offsets in clockwise order starting from East (matches LocApplet
// L3737-L3825 growth direction increments by 2: 0=E, 2=N, 4=W, 6=S — but we
// translate to 4 cardinal entries here for clarity).
export const NEIGHBOR_OFFSETS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 1, dy: 0 },   // E
  { dx: 0, dy: 1 },   // S
  { dx: -1, dy: 0 },  // W
  { dx: 0, dy: -1 },  // N
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/squareIndex.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/types.ts tests/squareIndex.test.ts
git commit -m "Add square index helpers and 4-neighbor offsets"
```

---

## Task 13: `initBoard` — empty 40×20 grid, water boundary

**Files:**
- Create: `src/game/mapgen/board.ts`
- Create: `tests/mapgen/board.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { initBoard, computeLandBudget } from '../../src/game/mapgen/board.js';

describe('initBoard', () => {
  it('creates 800 squares', () => {
    const sq = initBoard(false);
    expect(sq).toHaveLength(800);
  });

  it('all squares default to open water', () => {
    const sq = initBoard(false);
    for (const s of sq) {
      expect(s.territoryId).toBeNull();
      expect(s.lakeId).toBeNull();
      expect(s.isBoundaryWater).toBe(false);
    }
  });

  it('with boundary, only the outermost ring is boundary water', () => {
    const sq = initBoard(true);
    for (const s of sq) {
      const onEdge = s.x === 0 || s.x === 39 || s.y === 0 || s.y === 19;
      expect(s.isBoundaryWater).toBe(onEdge);
    }
  });
});

describe('computeLandBudget', () => {
  it('matches LocApplet L3650-3680 with boundary', () => {
    expect(computeLandBudget(true, 'small')).toBe(547);
    expect(computeLandBudget(true, 'medium')).toBe(410);
    expect(computeLandBudget(true, 'large')).toBe(274);
  });
  it('matches without boundary', () => {
    expect(computeLandBudget(false, 'small')).toBe(640);
    expect(computeLandBudget(false, 'medium')).toBe(480);
    expect(computeLandBudget(false, 'large')).toBe(320);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapgen/board.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/mapgen/board.ts`**

```ts
import {
  GRID_WIDTH, GRID_HEIGHT,
  LAND_BUDGET_WITH_BOUNDARY, LAND_BUDGET_WITHOUT_BOUNDARY,
} from '../constants.js';
import type { Square, MapParams } from '../types.js';

export function initBoard(waterBoundary: boolean): Square[] {
  const squares: Square[] = new Array(GRID_WIDTH * GRID_HEIGHT);
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const onEdge = x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1;
      squares[y * GRID_WIDTH + x] = {
        x, y,
        territoryId: null,
        lakeId: null,
        isBoundaryWater: waterBoundary && onEdge,
      };
    }
  }
  return squares;
}

export function computeLandBudget(
  waterBoundary: boolean,
  waterArea: MapParams['waterArea'],
): number {
  return waterBoundary
    ? LAND_BUDGET_WITH_BOUNDARY[waterArea]
    : LAND_BUDGET_WITHOUT_BOUNDARY[waterArea];
}

export function perTerritoryBudget(
  landBudget: number,
  numTerritories: number,
  shapes: MapParams['shapes'],
): number {
  let perTerr = Math.floor(landBudget / numTerritories);
  if (shapes === 'irregular') perTerr -= 2;
  return perTerr;
}

export function minTerritorySize(shapes: MapParams['shapes']): number {
  return shapes === 'irregular' ? 7 : 9;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapgen/board.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapgen/board.ts tests/mapgen/board.test.ts
git commit -m "Add initBoard, computeLandBudget, perTerritoryBudget, minTerritorySize"
```

---

## Task 14: `pickSeedSquare` — respects water boundary

**Files:**
- Create: `src/game/mapgen/continent.ts`
- Create: `tests/mapgen/continent.test.ts`

Reference: `.reference/decompiled/LocApplet.java` L3693–3719.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { pickSeedSquare } from '../../src/game/mapgen/continent.js';
import { initBoard } from '../../src/game/mapgen/board.js';
import { createRng } from '../../src/game/rng.js';

describe('pickSeedSquare', () => {
  it('with boundary, never picks ring squares', () => {
    const sq = initBoard(true);
    const r = createRng(1);
    for (let i = 0; i < 200; i++) {
      const idx = pickSeedSquare(sq, r, true);
      const s = sq[idx]!;
      expect(s.isBoundaryWater).toBe(false);
      expect(s.x).toBeGreaterThanOrEqual(1);
      expect(s.x).toBeLessThanOrEqual(38);
      expect(s.y).toBeGreaterThanOrEqual(1);
      expect(s.y).toBeLessThanOrEqual(18);
    }
  });

  it('without boundary, can pick any open-water square', () => {
    const sq = initBoard(false);
    const r = createRng(2);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      seen.add(pickSeedSquare(sq, r, false));
    }
    // Should hit at least 100 distinct cells
    expect(seen.size).toBeGreaterThan(100);
  });

  it('skips squares already claimed by a territory', () => {
    const sq = initBoard(false);
    // Claim 5 squares
    for (let i = 0; i < 5; i++) sq[i]!.territoryId = 0;
    const r = createRng(3);
    for (let i = 0; i < 200; i++) {
      const idx = pickSeedSquare(sq, r, false);
      expect(sq[idx]!.territoryId).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapgen/continent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/mapgen/continent.ts`**

```ts
import type { Square } from '../types.js';
import { type RngState, nextInt } from '../rng.js';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants.js';

// Returns a random Square index that is open-water (territoryId == null) and
// not boundary-water (when waterBoundary is on). Mirrors LocApplet L3693-3698.
export function pickSeedSquare(squares: Square[], r: RngState, waterBoundary: boolean): number {
  // Bounded retry — if the board is mostly full this could loop, but generateMap
  // ensures we always have plenty of open water when seeding territories.
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const x = waterBoundary ? 1 + nextInt(r, GRID_WIDTH - 2) : nextInt(r, GRID_WIDTH);
    const y = waterBoundary ? 1 + nextInt(r, GRID_HEIGHT - 2) : nextInt(r, GRID_HEIGHT);
    const idx = y * GRID_WIDTH + x;
    const s = squares[idx]!;
    if (s.territoryId === null && !s.isBoundaryWater) return idx;
  }
  throw new Error('pickSeedSquare: no open-water square found');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapgen/continent.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapgen/continent.ts tests/mapgen/continent.test.ts
git commit -m "Add pickSeedSquare respecting water boundary"
```

---

## Task 15: Continent constraint — `enforceContinentConstraint`

**Files:**
- Modify: `src/game/mapgen/continent.ts`
- Modify: `tests/mapgen/continent.test.ts`

Reference: LocApplet L3699–3719.

- [ ] **Step 1: Append failing tests**

```ts
import { isAdjacentToLand, enforceContinentConstraint } from '../../src/game/mapgen/continent.js';

describe('isAdjacentToLand', () => {
  it('returns true if any 4-neighbor has a territoryId', () => {
    const sq = initBoard(false);
    sq[5]!.territoryId = 0; // (5, 0)
    expect(isAdjacentToLand(sq, 4, 0)).toBe(true);   // west neighbor of (5,0)
    expect(isAdjacentToLand(sq, 6, 0)).toBe(true);   // east neighbor of (5,0)
    expect(isAdjacentToLand(sq, 5, 1)).toBe(true);   // south neighbor of (5,0)
    expect(isAdjacentToLand(sq, 7, 0)).toBe(false);  // not adjacent
    expect(isAdjacentToLand(sq, 5, 5)).toBe(false);  // not adjacent
  });

  it('treats edges correctly (no out-of-bounds wrap)', () => {
    const sq = initBoard(false);
    sq[0]!.territoryId = 0; // (0, 0)
    expect(isAdjacentToLand(sq, 0, 1)).toBe(true);
    expect(isAdjacentToLand(sq, 1, 0)).toBe(true);
    expect(isAdjacentToLand(sq, 39, 19)).toBe(false);
  });
});

describe('enforceContinentConstraint', () => {
  it("'lots' returns the proposed seed unchanged", () => {
    const sq = initBoard(false);
    sq[0]!.territoryId = 0;
    const r = createRng(1);
    expect(enforceContinentConstraint(sq, r, 100, 'lots', false, 1)).toBe(100);
  });

  it("'none' rerolls until adjacent to existing land (n>0)", () => {
    const sq = initBoard(false);
    sq[40]!.territoryId = 0; // (0, 1)
    const r = createRng(1);
    const idx = enforceContinentConstraint(sq, r, 999, 'none', false, 1);
    // The chosen idx must be adjacent to (0,1)
    const x = idx % 40;
    const y = Math.floor(idx / 40);
    const adjacentToSeed =
      (x === 0 && y === 0) || (x === 0 && y === 2) || (x === 1 && y === 1);
    expect(adjacentToSeed).toBe(true);
  });

  it("for n == 0 (first territory), returns proposed seed unchanged regardless of mode", () => {
    const sq = initBoard(false);
    const r = createRng(1);
    expect(enforceContinentConstraint(sq, r, 100, 'none', false, 0)).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapgen/continent.test.ts`
Expected: FAIL — exports not found.

- [ ] **Step 3: Append to `src/game/mapgen/continent.ts`**

```ts
import { ISLANDS_SOME_PROBABILITY } from '../constants.js';
import type { MapParams } from '../types.js';
import { nextFloat } from '../rng.js';

export function isAdjacentToLand(squares: Square[], x: number, y: number): boolean {
  // 4-neighbor check
  if (x > 0 && squares[y * GRID_WIDTH + (x - 1)]!.territoryId !== null) return true;
  if (x < GRID_WIDTH - 1 && squares[y * GRID_WIDTH + (x + 1)]!.territoryId !== null) return true;
  if (y > 0 && squares[(y - 1) * GRID_WIDTH + x]!.territoryId !== null) return true;
  if (y < GRID_HEIGHT - 1 && squares[(y + 1) * GRID_WIDTH + x]!.territoryId !== null) return true;
  return false;
}

// LocApplet L3699-3719: continent vs island constraint, only enforced for n > 0.
export function enforceContinentConstraint(
  squares: Square[],
  r: RngState,
  proposedIdx: number,
  islands: MapParams['islands'],
  waterBoundary: boolean,
  territoryIndex: number,
): number {
  if (territoryIndex === 0 || islands === 'lots') return proposedIdx;

  const mustBeAdjacent = islands === 'none' || (islands === 'some' && nextFloat(r) < ISLANDS_SOME_PROBABILITY);
  if (!mustBeAdjacent) return proposedIdx;

  // Reroll up to a generous bound until the seed is adjacent to some existing land.
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const idx = pickSeedSquare(squares, r, waterBoundary);
    const s = squares[idx]!;
    if (isAdjacentToLand(squares, s.x, s.y)) return idx;
  }
  throw new Error('enforceContinentConstraint: no adjacent open-water square found');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapgen/continent.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapgen/continent.ts tests/mapgen/continent.test.ts
git commit -m "Add isAdjacentToLand and enforceContinentConstraint"
```

---

## Task 16: Territory growth — single step (regular shape)

**Files:**
- Create: `src/game/mapgen/grow.ts`
- Create: `tests/mapgen/grow.test.ts`

Reference: LocApplet L3725–3828.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { growOnce } from '../../src/game/mapgen/grow.js';
import { initBoard } from '../../src/game/mapgen/board.js';
import { createRng } from '../../src/game/rng.js';

describe('growOnce (regular)', () => {
  it('extends the territory by one square in a cardinal direction', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0; // seed at (20, 2)
    const r = createRng(1);
    const grew = growOnce(sq, r, 0, 'regular');
    expect(grew).toBe(true);
    // Count squares now claimed by territory 0
    const claimed = sq.filter((s) => s.territoryId === 0);
    expect(claimed).toHaveLength(2);
  });

  it('returns false when no growable square exists', () => {
    const sq = initBoard(false);
    // Single seed surrounded by other territories
    sq[100]!.territoryId = 0;
    sq[99]!.territoryId = 1;   // west
    sq[101]!.territoryId = 1;  // east
    sq[60]!.territoryId = 1;   // north
    sq[140]!.territoryId = 1;  // south
    const r = createRng(2);
    expect(growOnce(sq, r, 0, 'regular')).toBe(false);
  });

  it('does not pick boundary-water squares', () => {
    const sq = initBoard(true);
    sq[41]!.territoryId = 0; // (1, 1) — adjacent to boundary on west and north
    const r = createRng(3);
    growOnce(sq, r, 0, 'regular');
    const claimed = sq.filter((s) => s.territoryId === 0);
    for (const s of claimed) {
      expect(s.isBoundaryWater).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapgen/grow.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/mapgen/grow.ts`**

```ts
import type { Square, MapParams } from '../types.js';
import { type RngState, nextInt, nextFloat } from '../rng.js';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants.js';

// 4-neighbor offsets in clockwise order from East — matches LocApplet's
// `(int)(rnd*4)*2` choice that picks 0/2/4/6 = E/N/W/S then increments by 2.
const DIRS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 1, dy: 0 },   // E
  { dx: 0, dy: -1 },  // N
  { dx: -1, dy: 0 },  // W
  { dx: 0, dy: 1 },   // S
];

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
}

function isPlaceable(squares: Square[], x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const s = squares[y * GRID_WIDTH + x]!;
  return s.territoryId === null && !s.isBoundaryWater;
}

// Find squares that belong to `terrId` and have at least one placeable neighbor.
function findGrowableParts(squares: Square[], terrId: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < squares.length; i++) {
    const s = squares[i]!;
    if (s.territoryId !== terrId) continue;
    for (const d of DIRS) {
      if (isPlaceable(squares, s.x + d.dx, s.y + d.dy)) {
        result.push(i);
        break;
      }
    }
  }
  return result;
}

// Try one growth step. Returns true if a square was placed, false if the
// territory is fully boxed in.
export function growOnce(
  squares: Square[],
  r: RngState,
  terrId: number,
  _shapes: MapParams['shapes'],
): boolean {
  const growable = findGrowableParts(squares, terrId);
  if (growable.length === 0) return false;

  const part = squares[growable[nextInt(r, growable.length)]!]!;
  // Random starting direction (0..3), then walk clockwise — matches Gettman.
  const startDir = nextInt(r, 4);
  for (let k = 0; k < 4; k++) {
    const d = DIRS[(startDir + k) % 4]!;
    const nx = part.x + d.dx;
    const ny = part.y + d.dy;
    if (isPlaceable(squares, nx, ny)) {
      squares[ny * GRID_WIDTH + nx]!.territoryId = terrId;
      return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapgen/grow.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapgen/grow.ts tests/mapgen/grow.test.ts
git commit -m "Add growOnce for regular-shape territory growth"
```

---

## Task 17: Territory growth — irregular jump

**Files:**
- Modify: `src/game/mapgen/grow.ts`
- Modify: `tests/mapgen/grow.test.ts`

Reference: LocApplet L3780–3822.

- [ ] **Step 1: Append failing test**

```ts
describe('growOnce (irregular)', () => {
  it('jumps 2 squares in same direction when possible (so square count grows by 2)', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;  // seed at (20, 2)
    const r = createRng(0xBEEF);
    let beforeCount = 1;
    let afterCount = 1;
    // Run several growth steps; in irregular mode some should add 2 squares.
    let sawJump = false;
    for (let i = 0; i < 30; i++) {
      const before = sq.filter((s) => s.territoryId === 0).length;
      growOnce(sq, r, 0, 'irregular');
      const after = sq.filter((s) => s.territoryId === 0).length;
      if (after - before === 2) sawJump = true;
    }
    expect(sawJump).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapgen/grow.test.ts`
Expected: FAIL — irregular jump not implemented (current impl always adds 1).

- [ ] **Step 3: Update `growOnce` in `src/game/mapgen/grow.ts`** to handle the jump

Replace the body of `growOnce` after a successful single-step placement:

```ts
export function growOnce(
  squares: Square[],
  r: RngState,
  terrId: number,
  shapes: MapParams['shapes'],
): boolean {
  const growable = findGrowableParts(squares, terrId);
  if (growable.length === 0) return false;

  const part = squares[growable[nextInt(r, growable.length)]!]!;
  const startDir = nextInt(r, 4);
  for (let k = 0; k < 4; k++) {
    const d = DIRS[(startDir + k) % 4]!;
    const nx = part.x + d.dx;
    const ny = part.y + d.dy;
    if (isPlaceable(squares, nx, ny)) {
      squares[ny * GRID_WIDTH + nx]!.territoryId = terrId;
      // Irregular: also try to jump 2 squares in the same direction
      if (shapes === 'irregular') {
        const fx = nx + d.dx;
        const fy = ny + d.dy;
        if (isPlaceable(squares, fx, fy)) {
          squares[fy * GRID_WIDTH + fx]!.territoryId = terrId;
        }
      }
      return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapgen/grow.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapgen/grow.ts tests/mapgen/grow.test.ts
git commit -m "Extend growOnce to perform irregular-shape jump"
```

---

## Task 18: Grow territory until budget or stuck

**Files:**
- Modify: `src/game/mapgen/grow.ts`
- Modify: `tests/mapgen/grow.test.ts`

- [ ] **Step 1: Append failing test**

```ts
import { growToBudget } from '../../src/game/mapgen/grow.js';

describe('growToBudget', () => {
  it('grows the territory to roughly the budget on an open board', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;
    const r = createRng(7);
    const placed = growToBudget(sq, r, 0, 'regular', 12);
    expect(placed).toBeGreaterThanOrEqual(11); // 1 seed + ~11 growth
    expect(placed).toBeLessThanOrEqual(13);
    expect(sq.filter((s) => s.territoryId === 0)).toHaveLength(placed);
  });

  it('stops early if no growable parts remain', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;
    sq[99]!.territoryId = 1;   sq[101]!.territoryId = 1;
    sq[60]!.territoryId = 1;   sq[140]!.territoryId = 1;
    const r = createRng(8);
    expect(growToBudget(sq, r, 0, 'regular', 50)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapgen/grow.test.ts`
Expected: FAIL — `growToBudget` not exported.

- [ ] **Step 3: Append `growToBudget` to `src/game/mapgen/grow.ts`**

```ts
// Grow `terrId` until it has `budget` squares OR no further growth is possible.
// Returns the actual number of squares now claimed by the territory.
export function growToBudget(
  squares: Square[],
  r: RngState,
  terrId: number,
  shapes: MapParams['shapes'],
  budget: number,
): number {
  let count = squares.reduce((n, s) => n + (s.territoryId === terrId ? 1 : 0), 0);
  while (count < budget) {
    if (!growOnce(squares, r, terrId, shapes)) break;
    count = squares.reduce((n, s) => n + (s.territoryId === terrId ? 1 : 0), 0);
  }
  return count;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapgen/grow.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapgen/grow.ts tests/mapgen/grow.test.ts
git commit -m "Add growToBudget driving territory growth to a target size"
```

---

## Task 19: Reject undersized territory and roll back

**Files:**
- Modify: `src/game/mapgen/grow.ts`
- Modify: `tests/mapgen/grow.test.ts`

Reference: LocApplet L3829–3837.

- [ ] **Step 1: Append failing test**

```ts
import { rollbackTerritory } from '../../src/game/mapgen/grow.js';

describe('rollbackTerritory', () => {
  it('clears all squares assigned to the given territory id', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;
    sq[101]!.territoryId = 0;
    sq[102]!.territoryId = 0;
    rollbackTerritory(sq, 0);
    expect(sq.filter((s) => s.territoryId === 0)).toHaveLength(0);
  });

  it('leaves other territories alone', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;
    sq[200]!.territoryId = 1;
    rollbackTerritory(sq, 0);
    expect(sq.filter((s) => s.territoryId === 1)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapgen/grow.test.ts`
Expected: FAIL — `rollbackTerritory` not exported.

- [ ] **Step 3: Append to `src/game/mapgen/grow.ts`**

```ts
export function rollbackTerritory(squares: Square[], terrId: number): void {
  for (const s of squares) {
    if (s.territoryId === terrId) s.territoryId = null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapgen/grow.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapgen/grow.ts tests/mapgen/grow.test.ts
git commit -m "Add rollbackTerritory for undersized retries"
```

---

## Task 20: `assessLakes` — annex small water, number large lakes

**Files:**
- Create: `src/game/mapgen/lakes.ts`
- Create: `tests/mapgen/lakes.test.ts`

Reference: LocApplet L3480–3519.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { assessLakes } from '../../src/game/mapgen/lakes.js';
import { initBoard } from '../../src/game/mapgen/board.js';

describe('assessLakes', () => {
  it('annexes water regions smaller than threshold into the territory above', () => {
    const sq = initBoard(false);
    // Make a single land tile at row 1 above a 3-square pond at row 2.
    // Land at (5, 1)
    sq[1 * 40 + 5]!.territoryId = 0;
    // The 3-square pond is just (5, 2), (5, 3), (5, 4) — already water.
    // The rest of the board is also water; we need to surround it with land
    // to make it a small connected water region. Surround with a large land border:
    for (let i = 0; i < 800; i++) {
      const x = i % 40, y = Math.floor(i / 40);
      // Mark everything except the pond and (5,1) as a separate territory 99
      const isPond = x === 5 && (y >= 2 && y <= 4);
      if (!isPond && sq[i]!.territoryId === null) sq[i]!.territoryId = 99;
    }
    // Re-clear the seed so (5,1) stays in territory 0.
    sq[1 * 40 + 5]!.territoryId = 0;
    assessLakes(sq, 9);
    // The pond (3 squares < 9) should be annexed to territory 0 (the row above)
    expect(sq[2 * 40 + 5]!.territoryId).toBe(0);
    expect(sq[3 * 40 + 5]!.territoryId).toBe(0);
    expect(sq[4 * 40 + 5]!.territoryId).toBe(0);
  });

  it('numbers water regions of size >= threshold as lakes (lakeId set)', () => {
    const sq = initBoard(false);
    // Mark a thin land border around a 5x4=20 sq water pond
    for (let y = 0; y < 20; y++) for (let x = 0; x < 40; x++) {
      const inPond = x >= 10 && x <= 14 && y >= 5 && y <= 8;
      if (!inPond) sq[y * 40 + x]!.territoryId = 99;
    }
    assessLakes(sq, 9);
    for (let y = 5; y <= 8; y++) for (let x = 10; x <= 14; x++) {
      expect(sq[y * 40 + x]!.lakeId).not.toBeNull();
      expect(sq[y * 40 + x]!.territoryId).toBeNull();
    }
    // All 20 cells share the same lakeId
    const ids = new Set(
      [5,6,7,8].flatMap((y) => [10,11,12,13,14].map((x) => sq[y*40+x]!.lakeId)),
    );
    expect(ids.size).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapgen/lakes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/mapgen/lakes.ts`**

```ts
import type { Square } from '../types.js';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants.js';

// Flood-fill all open-water cells (territoryId === null AND not boundary water?
// No — boundary water counts as water for lake purposes too in Gettman, see
// LocApplet L3480-3519). For each connected water region:
//   if size < threshold: annex into the territory immediately ABOVE the
//     uppermost cell (or scan DOWN if at y == 0) — matches Gettman's "above"
//     rule.
//   if size >= threshold: assign a fresh lakeId to every cell in the region.
export function assessLakes(squares: Square[], threshold: number): void {
  const visited = new Set<number>();
  let nextLakeId = 0;
  for (let i = 0; i < squares.length; i++) {
    const s = squares[i]!;
    if (s.territoryId !== null || visited.has(i)) continue;
    // BFS over connected water
    const region: number[] = [];
    const stack = [i];
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      const cs = squares[cur]!;
      if (cs.territoryId !== null) continue;
      visited.add(cur);
      region.push(cur);
      const x = cs.x, y = cs.y;
      const neighbors = [
        x > 0 ? cur - 1 : -1,
        x < GRID_WIDTH - 1 ? cur + 1 : -1,
        y > 0 ? cur - GRID_WIDTH : -1,
        y < GRID_HEIGHT - 1 ? cur + GRID_WIDTH : -1,
      ];
      for (const n of neighbors) if (n >= 0 && !visited.has(n)) stack.push(n);
    }
    if (region.length < threshold) {
      // Find the uppermost cell — the one with min y (and min x as tie-break).
      const top = region.reduce((best, idx) => {
        const a = squares[idx]!, b = squares[best]!;
        if (a.y < b.y || (a.y === b.y && a.x < b.x)) return idx;
        return best;
      });
      const ts = squares[top]!;
      // Look up: territory directly above; if y == 0 scan downward.
      let annexInto: number | null = null;
      if (ts.y === 0) {
        for (let yy = 1; yy < GRID_HEIGHT; yy++) {
          const probe = squares[yy * GRID_WIDTH + ts.x]!;
          if (probe.territoryId !== null) { annexInto = probe.territoryId; break; }
        }
      } else {
        const probe = squares[(ts.y - 1) * GRID_WIDTH + ts.x]!;
        annexInto = probe.territoryId;
      }
      if (annexInto !== null) {
        for (const idx of region) squares[idx]!.territoryId = annexInto;
      }
      // If no surrounding land, leave as water (rare edge case in unconfined gen).
    } else {
      const lakeId = nextLakeId++;
      for (const idx of region) squares[idx]!.lakeId = lakeId;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapgen/lakes.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapgen/lakes.ts tests/mapgen/lakes.test.ts
git commit -m "Add assessLakes: annex small water, number large lakes"
```

---

## Task 21: Adjacency — `touching` matrix

**Files:**
- Create: `src/game/mapgen/adjacency.ts`
- Create: `tests/mapgen/adjacency.test.ts`

Reference: LocApplet L3856–3931.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildTouching } from '../../src/game/mapgen/adjacency.js';
import { initBoard } from '../../src/game/mapgen/board.js';

describe('buildTouching', () => {
  it('two land squares of different territories that share a 4-edge → territories touch', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;
    sq[101]!.territoryId = 1; // east neighbor of (20, 2)
    const t = buildTouching(sq, 2);
    expect(t[0]![1]).toBe(true);
    expect(t[1]![0]).toBe(true);
  });

  it('non-adjacent territories do not touch', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;
    sq[300]!.territoryId = 1;
    const t = buildTouching(sq, 2);
    expect(t[0]![1]).toBe(false);
  });

  it('a territory does not touch itself', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;
    sq[101]!.territoryId = 0;
    const t = buildTouching(sq, 1);
    expect(t[0]![0]).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapgen/adjacency.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/mapgen/adjacency.ts`**

```ts
import type { Square } from '../types.js';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants.js';

// Returns t[a][b] = true iff territories a and b are different and have at least
// one pair of adjacent squares (4-neighbor).
export function buildTouching(squares: Square[], numTerritories: number): boolean[][] {
  const t: boolean[][] = Array.from({ length: numTerritories }, () =>
    new Array<boolean>(numTerritories).fill(false));
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const s = squares[y * GRID_WIDTH + x]!;
      if (s.territoryId === null) continue;
      const me = s.territoryId;
      const checkPairs = [
        x < GRID_WIDTH - 1 ? squares[y * GRID_WIDTH + (x + 1)]!.territoryId : null,
        y < GRID_HEIGHT - 1 ? squares[(y + 1) * GRID_WIDTH + x]!.territoryId : null,
      ];
      for (const other of checkPairs) {
        if (other !== null && other !== me) {
          t[me]![other] = true;
          t[other]![me] = true;
        }
      }
    }
  }
  return t;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapgen/adjacency.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapgen/adjacency.ts tests/mapgen/adjacency.test.ts
git commit -m "Add buildTouching adjacency matrix"
```

---

## Task 22: Adjacency — BFS distance matrix

**Files:**
- Modify: `src/game/mapgen/adjacency.ts`
- Modify: `tests/mapgen/adjacency.test.ts`

- [ ] **Step 1: Append failing test**

```ts
import { buildDistance } from '../../src/game/mapgen/adjacency.js';

describe('buildDistance', () => {
  it('adjacent territories have distance 1', () => {
    const t = [
      [false, true, false],
      [true, false, true],
      [false, true, false],
    ];
    const d = buildDistance(t);
    expect(d[0]![1]).toBe(1);
    expect(d[1]![0]).toBe(1);
    expect(d[1]![2]).toBe(1);
  });

  it('two-hop territories have distance 2', () => {
    const t = [
      [false, true, false],
      [true, false, true],
      [false, true, false],
    ];
    const d = buildDistance(t);
    expect(d[0]![2]).toBe(2);
  });

  it('unreachable territories have Infinity', () => {
    const t = [
      [false, true, false],
      [true, false, false],
      [false, false, false],
    ];
    const d = buildDistance(t);
    expect(d[0]![2]).toBe(Infinity);
  });

  it('self distance is 0', () => {
    const t = [[false, true], [true, false]];
    const d = buildDistance(t);
    expect(d[0]![0]).toBe(0);
    expect(d[1]![1]).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapgen/adjacency.test.ts`
Expected: FAIL — `buildDistance` not exported.

- [ ] **Step 3: Append to `src/game/mapgen/adjacency.ts`**

```ts
// BFS shortest-hop distance between territories. Self-distance is 0; unreachable
// pairs are Infinity.
export function buildDistance(touching: boolean[][]): number[][] {
  const n = touching.length;
  const d: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(Infinity));
  for (let s = 0; s < n; s++) {
    d[s]![s] = 0;
    const queue: number[] = [s];
    while (queue.length) {
      const cur = queue.shift()!;
      for (let nb = 0; nb < n; nb++) {
        if (touching[cur]![nb] && d[s]![nb] === Infinity) {
          d[s]![nb] = d[s]![cur]! + 1;
          queue.push(nb);
        }
      }
    }
  }
  return d;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapgen/adjacency.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapgen/adjacency.ts tests/mapgen/adjacency.test.ts
git commit -m "Add buildDistance BFS matrix"
```

---

## Task 23: Coastal flag and `bordersLakes`

**Files:**
- Create: `src/game/mapgen/coast.ts`
- Create: `tests/mapgen/coast.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { computeBordersLakes } from '../../src/game/mapgen/coast.js';
import { initBoard } from '../../src/game/mapgen/board.js';

describe('computeBordersLakes', () => {
  it('attaches each lake id to every territory whose square borders it', () => {
    const sq = initBoard(false);
    // Land at (10, 5) and (12, 5); water (lake 0) between at (11, 5).
    sq[5 * 40 + 10]!.territoryId = 0;
    sq[5 * 40 + 12]!.territoryId = 1;
    sq[5 * 40 + 11]!.lakeId = 0;
    const result = computeBordersLakes(sq, 2);
    expect([...result[0]!]).toEqual([0]);
    expect([...result[1]!]).toEqual([0]);
  });

  it('a territory not touching any lake has empty set', () => {
    const sq = initBoard(false);
    sq[100]!.territoryId = 0;
    const result = computeBordersLakes(sq, 1);
    expect(result[0]!.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapgen/coast.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/mapgen/coast.ts`**

```ts
import type { Square } from '../types.js';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants.js';

export function computeBordersLakes(squares: Square[], numTerritories: number): Set<number>[] {
  const result: Set<number>[] = Array.from({ length: numTerritories }, () => new Set<number>());
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const s = squares[y * GRID_WIDTH + x]!;
      if (s.territoryId === null) continue;
      const checks = [
        x > 0 ? squares[y * GRID_WIDTH + (x - 1)] : null,
        x < GRID_WIDTH - 1 ? squares[y * GRID_WIDTH + (x + 1)] : null,
        y > 0 ? squares[(y - 1) * GRID_WIDTH + x] : null,
        y < GRID_HEIGHT - 1 ? squares[(y + 1) * GRID_WIDTH + x] : null,
      ];
      for (const n of checks) {
        if (n && n.lakeId !== null) result[s.territoryId]!.add(n.lakeId);
      }
    }
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapgen/coast.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapgen/coast.ts tests/mapgen/coast.test.ts
git commit -m "Add computeBordersLakes per-territory lake adjacency"
```

---

## Task 24: Resource placement — fixed mode

**Files:**
- Create: `src/game/mapgen/resources.ts`
- Create: `tests/mapgen/resources.test.ts`

Reference: LocApplet L3346–3409, especially the `n4 != 4 ? ... : 0` "extra horse for medium" branch.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { placeResourcesFixed } from '../../src/game/mapgen/resources.js';
import { Code } from '../../src/game/codes.js';
import { createRng } from '../../src/game/rng.js';
import type { Territory } from '../../src/game/types.js';

function makeTerrs(n: number): Territory[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
  }));
}

describe('placeResourcesFixed', () => {
  it('places exactly N copies of each resource for "medium" with 4 players', () => {
    const terrs = makeTerrs(40);
    const r = createRng(1);
    placeResourcesFixed(terrs, 'medium', 4, r);
    const counts = new Map<number, number>();
    for (const t of terrs) {
      if (t.resource !== null) counts.set(t.resource, (counts.get(t.resource) ?? 0) + 1);
    }
    // Medium = numPlayers (4) of each, +1 extra Stable.
    expect(counts.get(Code.IRON)).toBe(4);
    expect(counts.get(Code.COAL)).toBe(4);
    expect(counts.get(Code.TREE)).toBe(4);
    expect(counts.get(Code.GOLD)).toBe(4);
    expect(counts.get(Code.STABLE)).toBe(5);
  });

  it('"low" with 3 players → 2 of each, no stable bonus', () => {
    const terrs = makeTerrs(30);
    placeResourcesFixed(terrs, 'low', 3, createRng(2));
    const counts = new Map<number, number>();
    for (const t of terrs) {
      if (t.resource !== null) counts.set(t.resource, (counts.get(t.resource) ?? 0) + 1);
    }
    expect(counts.get(Code.IRON)).toBe(2);
    expect(counts.get(Code.STABLE)).toBe(2);
  });

  it('throws if there are not enough territories to host all resources', () => {
    const terrs = makeTerrs(5); // need at least 4*5 + (1 if medium) = 21
    expect(() => placeResourcesFixed(terrs, 'medium', 4, createRng(3)))
      .toThrow(/not enough territories/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapgen/resources.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/mapgen/resources.ts`**

```ts
import type { Territory, ResourceDensity } from '../types.js';
import { Code, type ResourceCode, RESOURCE_CODES } from '../codes.js';
import { type RngState, nextInt } from '../rng.js';

const FIXED_LEVEL_OFFSET: Record<ResourceDensity['level'], number> = {
  veryLow: -2,
  low: -1,
  medium: 0,
  high: 1,
};

export function placeResourcesFixed(
  terrs: Territory[],
  level: ResourceDensity['level'],
  numPlayers: number,
  r: RngState,
): void {
  const baseCount = numPlayers + FIXED_LEVEL_OFFSET[level];
  if (baseCount < 1) throw new Error(`fixed-mode count would be < 1 for ${level} at ${numPlayers}P`);
  // Medium gets 1 extra Stable (LocApplet L3386: `n4==2 ? 1 : 0`).
  const stableBonus = level === 'medium' ? 1 : 0;
  const total = baseCount * 5 + stableBonus;
  if (total > terrs.length) {
    throw new Error(
      `not enough territories: need ${total} but have ${terrs.length}`,
    );
  }
  const free: Territory[] = terrs.filter((t) => t.resource === null);
  // Shuffle free in place via Fisher-Yates with our RNG
  for (let i = free.length - 1; i > 0; i--) {
    const j = nextInt(r, i + 1);
    [free[i], free[j]] = [free[j]!, free[i]!];
  }
  let cursor = 0;
  for (const code of RESOURCE_CODES) {
    const target = baseCount + (code === Code.STABLE ? stableBonus : 0);
    for (let k = 0; k < target; k++) {
      free[cursor++]!.resource = code;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapgen/resources.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapgen/resources.ts tests/mapgen/resources.test.ts
git commit -m "Add placeResourcesFixed (4 levels, medium gets +1 Stable)"
```

---

## Task 25: Resource placement — random mode

**Files:**
- Modify: `src/game/mapgen/resources.ts`
- Modify: `tests/mapgen/resources.test.ts`

Reference: LocApplet L3346–3409 random branch + L7247–7252 `resourceOrder = {2,3,4,0,1}` (Tree, Gold, Stable, Iron, Coal).

- [ ] **Step 1: Append failing tests**

```ts
import { placeResourcesRandom, RESOURCE_ORDER } from '../../src/game/mapgen/resources.js';

describe('placeResourcesRandom', () => {
  it('exposes resourceOrder = [TREE, GOLD, STABLE, IRON, COAL]', () => {
    expect(RESOURCE_ORDER).toEqual([
      Code.TREE, Code.GOLD, Code.STABLE, Code.IRON, Code.COAL,
    ]);
  });

  it('places resources on roughly the right fraction of territories', () => {
    const terrs = makeTerrs(50);
    const r = createRng(5);
    placeResourcesRandom(terrs, 'medium', r); // 0.50 fraction
    const placed = terrs.filter((t) => t.resource !== null).length;
    expect(placed).toBeGreaterThanOrEqual(24);
    expect(placed).toBeLessThanOrEqual(26);
  });

  it('"high" places more than "low"', () => {
    const a = makeTerrs(50);
    placeResourcesRandom(a, 'high', createRng(6));
    const b = makeTerrs(50);
    placeResourcesRandom(b, 'low', createRng(6));
    const placedA = a.filter((t) => t.resource !== null).length;
    const placedB = b.filter((t) => t.resource !== null).length;
    expect(placedA).toBeGreaterThan(placedB);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapgen/resources.test.ts`
Expected: FAIL — `placeResourcesRandom` / `RESOURCE_ORDER` not exported.

- [ ] **Step 3: Append to `src/game/mapgen/resources.ts`**

```ts
// LocApplet L7247-7252: resourceOrder = {2, 3, 4, 0, 1}
export const RESOURCE_ORDER: readonly ResourceCode[] = [
  Code.TREE, Code.GOLD, Code.STABLE, Code.IRON, Code.COAL,
];

const RANDOM_LEVEL_FRACTION: Record<ResourceDensity['level'], number> = {
  veryLow: 0.20,
  low: 0.35,
  medium: 0.50,
  high: 0.65,
};

export function placeResourcesRandom(
  terrs: Territory[],
  level: ResourceDensity['level'],
  r: RngState,
): void {
  const target = Math.round(terrs.length * RANDOM_LEVEL_FRACTION[level]);
  const free: Territory[] = terrs.filter((t) => t.resource === null);
  // Shuffle
  for (let i = free.length - 1; i > 0; i--) {
    const j = nextInt(r, i + 1);
    [free[i], free[j]] = [free[j]!, free[i]!];
  }
  // Round-robin via RESOURCE_ORDER until target placed (or out of free terrs).
  let cursor = 0;
  let orderIdx = 0;
  while (cursor < target && cursor < free.length) {
    free[cursor++]!.resource = RESOURCE_ORDER[orderIdx]!;
    orderIdx = (orderIdx + 1) % RESOURCE_ORDER.length;
  }
}

export function placeResources(
  terrs: Territory[],
  density: ResourceDensity,
  numPlayers: number,
  r: RngState,
): void {
  if (density.kind === 'fixed') placeResourcesFixed(terrs, density.level, numPlayers, r);
  else placeResourcesRandom(terrs, density.level, r);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapgen/resources.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapgen/resources.ts tests/mapgen/resources.test.ts
git commit -m "Add placeResourcesRandom with RESOURCE_ORDER and density fractions"
```

---

## Task 26: `generateMap` integration

**Files:**
- Create: `src/game/mapgen/index.ts`
- Create: `tests/mapgen/integration.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { generateMap } from '../../src/game/mapgen/index.js';
import type { MapParams } from '../../src/game/types.js';
import { Code } from '../../src/game/codes.js';

const baseParams: MapParams = {
  waterBoundary: true,
  waterArea: 'small',
  numTerritories: 24,
  islands: 'some',
  shapes: 'regular',
  resourceDensity: { kind: 'fixed', level: 'medium' },
};

describe('generateMap', () => {
  it('produces the requested number of territories', () => {
    const board = generateMap(12345, baseParams, 4);
    expect(board.territories).toHaveLength(24);
  });

  it('every territory has at least the minimum square count', () => {
    const board = generateMap(12345, baseParams, 4);
    for (const t of board.territories) {
      expect(t.squares.length).toBeGreaterThanOrEqual(9); // regular minSize
    }
  });

  it('same seed + params produces identical output (determinism)', () => {
    const a = generateMap(12345, baseParams, 4);
    const b = generateMap(12345, baseParams, 4);
    expect(a.squares).toEqual(b.squares);
    expect(a.territories.map((t) => ({
      ...t, bordersLakes: [...t.bordersLakes].sort()
    }))).toEqual(b.territories.map((t) => ({
      ...t, bordersLakes: [...t.bordersLakes].sort()
    })));
  });

  it('different seeds produce different maps', () => {
    const a = generateMap(1, baseParams, 4);
    const b = generateMap(2, baseParams, 4);
    expect(a.squares).not.toEqual(b.squares);
  });

  it('all territories are reachable from each other (transitively, via touching)', () => {
    const board = generateMap(42, baseParams, 4);
    const t = board.touching!;
    const visited = new Set<number>([0]);
    const queue = [0];
    while (queue.length) {
      const cur = queue.shift()!;
      for (let i = 0; i < board.territories.length; i++) {
        if (t[cur]![i] && !visited.has(i)) {
          visited.add(i);
          queue.push(i);
        }
      }
    }
    // Note: with islands enabled, full graph connectivity is NOT guaranteed.
    // For 'none' islands mode it should be — assert that path explicitly.
    const noIslands = generateMap(42, { ...baseParams, islands: 'none' }, 4);
    const tn = noIslands.touching!;
    const visN = new Set<number>([0]);
    const qN = [0];
    while (qN.length) {
      const cur = qN.shift()!;
      for (let i = 0; i < noIslands.territories.length; i++) {
        if (tn[cur]![i] && !visN.has(i)) { visN.add(i); qN.push(i); }
      }
    }
    expect(visN.size).toBe(noIslands.territories.length);
  });

  it('every resource code appears the expected number of times for fixed-medium 4P', () => {
    const board = generateMap(12345, baseParams, 4);
    const counts = new Map<number, number>();
    for (const t of board.territories) {
      if (t.resource !== null) counts.set(t.resource, (counts.get(t.resource) ?? 0) + 1);
    }
    expect(counts.get(Code.IRON)).toBe(4);
    expect(counts.get(Code.COAL)).toBe(4);
    expect(counts.get(Code.TREE)).toBe(4);
    expect(counts.get(Code.GOLD)).toBe(4);
    expect(counts.get(Code.STABLE)).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapgen/integration.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/mapgen/index.ts`**

```ts
import type { Board, MapParams, Territory } from '../types.js';
import { Code } from '../codes.js';
import { createRng } from '../rng.js';
import {
  initBoard, computeLandBudget, perTerritoryBudget, minTerritorySize,
} from './board.js';
import { pickSeedSquare, enforceContinentConstraint } from './continent.js';
import { growToBudget, rollbackTerritory } from './grow.js';
import { assessLakes } from './lakes.js';
import { buildTouching, buildDistance } from './adjacency.js';
import { computeBordersLakes } from './coast.js';
import { placeResources } from './resources.js';
import { GRID_WIDTH, LAKE_ANNEX_THRESHOLD } from '../constants.js';

const MAX_TERRITORY_RETRIES = 50;

export function generateMap(seed: number, params: MapParams, numPlayers: number): Board {
  const r = createRng(seed);
  const squares = initBoard(params.waterBoundary);
  const landBudget = computeLandBudget(params.waterBoundary, params.waterArea);
  const perTerr = perTerritoryBudget(landBudget, params.numTerritories, params.shapes);
  const minSize = minTerritorySize(params.shapes);

  let n = 0;
  let retries = 0;
  while (n < params.numTerritories) {
    const proposed = pickSeedSquare(squares, r, params.waterBoundary);
    const seedIdx = enforceContinentConstraint(
      squares, r, proposed, params.islands, params.waterBoundary, n,
    );
    squares[seedIdx]!.territoryId = n;
    const placed = growToBudget(squares, r, n, params.shapes, perTerr);
    if (placed < minSize) {
      rollbackTerritory(squares, n);
      retries++;
      if (retries > MAX_TERRITORY_RETRIES) {
        throw new Error(`Too many retries placing territory ${n} (min ${minSize})`);
      }
      continue;
    }
    n++;
    retries = 0;
  }

  assessLakes(squares, LAKE_ANNEX_THRESHOLD);

  // Build territory objects from the final square assignments.
  const territories: Territory[] = Array.from({ length: params.numTerritories }, (_, id) => ({
    id,
    ownerId: null,
    resource: null,
    hasCity: false,
    hasWeapon: false,
    hasHorse: false,
    hasStockpile: false,
    hasResourceDouble: false,
    squares: [],
    bordersLakes: new Set<number>(),
    citiesAdjacent: 0,
  }));
  for (let i = 0; i < squares.length; i++) {
    const tid = squares[i]!.territoryId;
    if (tid !== null) territories[tid]!.squares.push(i);
  }

  const touching = buildTouching(squares, params.numTerritories);
  const distance = buildDistance(touching);
  const lakes = computeBordersLakes(squares, params.numTerritories);
  for (let i = 0; i < params.numTerritories; i++) {
    territories[i]!.bordersLakes = lakes[i]!;
  }

  placeResources(territories, params.resourceDensity, numPlayers, r);

  return { squares, territories, touching, distance };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapgen/integration.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapgen/index.ts tests/mapgen/integration.test.ts
git commit -m "Add generateMap end-to-end with property tests"
```

---

## Task 27: Map text encoder

**Files:**
- Create: `src/game/mapTextCodec.ts`
- Create: `tests/mapTextCodec.test.ts`

Reference: LocApplet L3934–3954.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { encodeMap } from '../src/game/mapTextCodec.js';
import { initBoard } from '../src/game/mapgen/board.js';

describe('encodeMap', () => {
  it('all-water board encodes as 20 lines of 40 dots followed by footer', () => {
    const sq = initBoard(false);
    const text = encodeMap(sq);
    const lines = text.split('\n');
    expect(lines.slice(0, 20)).toEqual(Array(20).fill('.'.repeat(40)));
    expect(lines[20]).toBe('#');
    expect(lines[21]).toBe('#########################################');
    expect(lines[22]).toBe('Created by LOC Map Generator');
  });

  it('encodes territory ids using the 64-char alphabet', () => {
    const sq = initBoard(false);
    sq[0]!.territoryId = 0;     // '1'
    sq[1]!.territoryId = 1;     // '2'
    sq[39]!.territoryId = 9;    // 'A'
    const text = encodeMap(sq);
    const firstRow = text.split('\n')[0]!;
    expect(firstRow[0]).toBe('1');
    expect(firstRow[1]).toBe('2');
    expect(firstRow[39]).toBe('A');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapTextCodec.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/mapTextCodec.ts`**

```ts
import type { Square } from './types.js';
import { GRID_WIDTH, GRID_HEIGHT, MAP_ENCODE_ALPHABET } from './constants.js';

export function encodeMap(squares: Square[]): string {
  const rows: string[] = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    let row = '';
    for (let x = 0; x < GRID_WIDTH; x++) {
      const t = squares[y * GRID_WIDTH + x]!.territoryId;
      row += t === null ? '.' : MAP_ENCODE_ALPHABET[t]!;
    }
    rows.push(row);
  }
  rows.push('#');
  rows.push('#########################################');
  rows.push('Created by LOC Map Generator');
  return rows.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapTextCodec.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapTextCodec.ts tests/mapTextCodec.test.ts
git commit -m "Add encodeMap with 64-char alphabet and footer"
```

---

## Task 28: Map text decoder — happy path

**Files:**
- Modify: `src/game/mapTextCodec.ts`
- Modify: `tests/mapTextCodec.test.ts`

Reference: LocApplet L3521–3596 (`loadMap`).

- [ ] **Step 1: Append failing test**

```ts
import { decodeMap } from '../src/game/mapTextCodec.js';

describe('decodeMap (happy path)', () => {
  it('round-trips a simple all-water map', () => {
    const sq = initBoard(false);
    const text = encodeMap(sq);
    const decoded = decodeMap(text);
    expect(decoded.kind).toBe('ok');
    if (decoded.kind === 'ok') {
      expect(decoded.squares).toHaveLength(800);
      expect(decoded.numTerritories).toBe(0);
    }
  });

  it('round-trips a small map with two territories', () => {
    const sq = initBoard(false);
    // Territory 0: 7 connected squares (min for irregular allowed by load)
    for (let i = 0; i < 7; i++) sq[i]!.territoryId = 0;
    // Territory 1: 7 connected squares on row 1
    for (let i = 40; i < 47; i++) sq[i]!.territoryId = 1;
    const text = encodeMap(sq);
    const decoded = decodeMap(text);
    expect(decoded.kind).toBe('ok');
    if (decoded.kind === 'ok') {
      expect(decoded.numTerritories).toBe(2);
      for (let i = 0; i < 7; i++) expect(decoded.squares[i]!.territoryId).toBe(0);
      for (let i = 40; i < 47; i++) expect(decoded.squares[i]!.territoryId).toBe(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapTextCodec.test.ts`
Expected: FAIL — `decodeMap` not exported.

- [ ] **Step 3: Append to `src/game/mapTextCodec.ts`**

```ts
export type DecodeResult =
  | { kind: 'ok'; squares: Square[]; numTerritories: number }
  | { kind: 'error'; code: -1 | -2 | -3; message: string };

const ALPHABET_INDEX: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < MAP_ENCODE_ALPHABET.length; i++) m[MAP_ENCODE_ALPHABET[i]!] = i;
  return m;
})();

export function decodeMap(text: string): DecodeResult {
  const lines = text.split(/\r?\n/);
  // Need at least 20 grid rows.
  if (lines.length < GRID_HEIGHT) {
    return { kind: 'error', code: -1, message: 'Fewer than 20 grid rows' };
  }
  const grid = lines.slice(0, GRID_HEIGHT);
  for (const row of grid) {
    if (row.length < GRID_WIDTH) {
      return { kind: 'error', code: -1, message: `Row too short (need ${GRID_WIDTH})` };
    }
  }
  const squares: Square[] = new Array(GRID_WIDTH * GRID_HEIGHT);
  let maxTerr = -1;
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const ch = grid[y]![x]!;
      let tid: number | null = null;
      if (ch !== '.') {
        const idx = ALPHABET_INDEX[ch];
        if (idx === undefined) {
          return { kind: 'error', code: -1, message: `Unknown character '${ch}' at (${x},${y})` };
        }
        tid = idx;
        if (idx > maxTerr) maxTerr = idx;
      }
      squares[y * GRID_WIDTH + x] = {
        x, y, territoryId: tid, lakeId: null, isBoundaryWater: false,
      };
    }
  }
  const numTerritories = maxTerr + 1;
  return { kind: 'ok', squares, numTerritories };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapTextCodec.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapTextCodec.ts tests/mapTextCodec.test.ts
git commit -m "Add decodeMap happy path"
```

---

## Task 29: Map text decoder — validation & errors

**Files:**
- Modify: `src/game/mapTextCodec.ts`
- Modify: `tests/mapTextCodec.test.ts`

Reference: LocApplet L3571 (min size 7), L3600 (cap 99), L3829 (range 20–64).

- [ ] **Step 1: Append failing tests**

```ts
describe('decodeMap (validation)', () => {
  it('returns -2 if any territory has fewer than 7 squares', () => {
    const sq = initBoard(false);
    sq[0]!.territoryId = 0;        // 1 square — too small
    for (let i = 40; i < 47; i++) sq[i]!.territoryId = 1;
    const text = encodeMap(sq);
    const r = decodeMap(text);
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.code).toBe(-2);
  });

  it('returns -3 if numTerritories is below 20 (when also given numPlayers >= 2)', () => {
    const sq = initBoard(false);
    // 5 territories of 7 squares each
    for (let t = 0; t < 5; t++) for (let i = 0; i < 7; i++) sq[t * 40 + i]!.territoryId = t;
    const text = encodeMap(sq);
    const r = decodeMap(text, { numPlayers: 2 });
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.code).toBe(-3);
  });

  it('returns -3 if territories < 7 × numPlayers', () => {
    const sq = initBoard(false);
    // 20 territories of 7 squares each (20 ≥ 20 OK), but 4P needs ≥ 28
    for (let t = 0; t < 20; t++) for (let i = 0; i < 7; i++) {
      const idx = t * 7 + (i < 7 ? i : 0);
      if (idx < 800) sq[idx]!.territoryId = t;
    }
    const text = encodeMap(sq);
    const r = decodeMap(text, { numPlayers: 4 });
    if (r.kind === 'error') expect(r.code).toBe(-3);
  });

  it('returns -1 if a row is shorter than 40', () => {
    const text = ['.....', ...Array(19).fill('.'.repeat(40))].join('\n');
    const r = decodeMap(text);
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.code).toBe(-1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mapTextCodec.test.ts`
Expected: FAIL — `decodeMap` doesn't accept options or perform these validations.

- [ ] **Step 3: Update `decodeMap`**

Replace the signature and trailing logic in `src/game/mapTextCodec.ts`:

```ts
export type DecodeOptions = {
  numPlayers?: number;
};

export function decodeMap(text: string, opts: DecodeOptions = {}): DecodeResult {
  const lines = text.split(/\r?\n/);
  if (lines.length < GRID_HEIGHT) {
    return { kind: 'error', code: -1, message: 'Fewer than 20 grid rows' };
  }
  const grid = lines.slice(0, GRID_HEIGHT);
  for (const row of grid) {
    if (row.length < GRID_WIDTH) {
      return { kind: 'error', code: -1, message: `Row too short (need ${GRID_WIDTH})` };
    }
  }
  const squares: Square[] = new Array(GRID_WIDTH * GRID_HEIGHT);
  const territoryCounts = new Map<number, number>();
  let maxTerr = -1;
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const ch = grid[y]![x]!;
      let tid: number | null = null;
      if (ch !== '.') {
        const idx = ALPHABET_INDEX[ch];
        if (idx === undefined) {
          return { kind: 'error', code: -1, message: `Unknown character '${ch}' at (${x},${y})` };
        }
        tid = idx;
        if (idx > maxTerr) maxTerr = idx;
        territoryCounts.set(idx, (territoryCounts.get(idx) ?? 0) + 1);
      }
      squares[y * GRID_WIDTH + x] = {
        x, y, territoryId: tid, lakeId: null, isBoundaryWater: false,
      };
    }
  }
  const numTerritories = maxTerr + 1;
  // -2: any territory below 7 squares, OR exceeding 99
  for (const [tid, count] of territoryCounts) {
    if (count < 7 || count > 99) {
      return { kind: 'error', code: -2, message: `Territory ${tid} has ${count} squares (need 7..99)` };
    }
  }
  // -3: numTerritories not in [20, 64], or fewer than 7 × numPlayers
  if (numTerritories > 0 && (numTerritories < 20 || numTerritories > 64)) {
    return { kind: 'error', code: -3, message: `Territory count ${numTerritories} not in [20, 64]` };
  }
  if (opts.numPlayers !== undefined && numTerritories < 7 * opts.numPlayers) {
    return { kind: 'error', code: -3, message: `Need at least ${7 * opts.numPlayers} territories for ${opts.numPlayers} players` };
  }
  return { kind: 'ok', squares, numTerritories };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mapTextCodec.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapTextCodec.ts tests/mapTextCodec.test.ts
git commit -m "Add decodeMap validation: -1/-2/-3 error codes"
```

---

## Task 30: Map text codec — roundtrip property test

**Files:**
- Modify: `tests/mapTextCodec.test.ts`

- [ ] **Step 1: Append failing test**

```ts
import { generateMap } from '../src/game/mapgen/index.js';

describe('mapTextCodec roundtrip', () => {
  it.each([1, 2, 3, 4, 5])('encode→decode is identity for seed %i', (seed) => {
    const board = generateMap(seed, {
      waterBoundary: true,
      waterArea: 'small',
      numTerritories: 24,
      islands: 'some',
      shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    }, 4);
    const text = encodeMap(board.squares);
    const decoded = decodeMap(text);
    expect(decoded.kind).toBe('ok');
    if (decoded.kind === 'ok') {
      for (let i = 0; i < 800; i++) {
        expect(decoded.squares[i]!.territoryId).toBe(board.squares[i]!.territoryId);
      }
      expect(decoded.numTerritories).toBe(24);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/mapTextCodec.test.ts`
Expected: 13 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/mapTextCodec.test.ts
git commit -m "Add mapTextCodec roundtrip property test"
```

---

## Task 31: CLI — `gen-map` entry point

**Files:**
- Create: `src/cli/genMap.ts`
- Create: `src/cli/asciiPrint.ts`
- Create: `tests/cli/asciiPrint.test.ts`

- [ ] **Step 1: Write the failing test for the printer**

```ts
import { describe, it, expect } from 'vitest';
import { asciiBoard } from '../../src/cli/asciiPrint.js';
import { generateMap } from '../../src/game/mapgen/index.js';

describe('asciiBoard', () => {
  it('prints 20 lines of 40 chars each', () => {
    const board = generateMap(7, {
      waterBoundary: true, waterArea: 'small', numTerritories: 24,
      islands: 'some', shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    }, 4);
    const text = asciiBoard(board.squares);
    const lines = text.split('\n');
    expect(lines).toHaveLength(20);
    for (const line of lines) expect(line).toHaveLength(40);
  });

  it('uses ~ for water and the territory alphabet for land', () => {
    const board = generateMap(7, {
      waterBoundary: true, waterArea: 'small', numTerritories: 24,
      islands: 'some', shapes: 'regular',
      resourceDensity: { kind: 'fixed', level: 'medium' },
    }, 4);
    const text = asciiBoard(board.squares);
    expect(text).toMatch(/~/);
    expect(text).toMatch(/[1-9]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli/asciiPrint.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/cli/asciiPrint.ts`**

```ts
import type { Square } from '../game/types.js';
import { GRID_WIDTH, GRID_HEIGHT, MAP_ENCODE_ALPHABET } from '../game/constants.js';

export function asciiBoard(squares: Square[]): string {
  const rows: string[] = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    let row = '';
    for (let x = 0; x < GRID_WIDTH; x++) {
      const s = squares[y * GRID_WIDTH + x]!;
      if (s.territoryId === null) row += '~';
      else row += MAP_ENCODE_ALPHABET[s.territoryId]!;
    }
    rows.push(row);
  }
  return rows.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli/asciiPrint.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Implement `src/cli/genMap.ts`**

```ts
#!/usr/bin/env node
import { generateMap } from '../game/mapgen/index.js';
import { encodeMap } from '../game/mapTextCodec.js';
import { asciiBoard } from './asciiPrint.js';
import { Code } from '../game/codes.js';
import type { MapParams } from '../game/types.js';

function parseArgs(argv: string[]): {
  seed: number;
  numPlayers: number;
  params: MapParams;
  format: 'ascii' | 'text';
} {
  let seed = Date.now() & 0xffffffff;
  let numPlayers = 4;
  let format: 'ascii' | 'text' = 'ascii';
  const params: MapParams = {
    waterBoundary: true,
    waterArea: 'small',
    numTerritories: 24,
    islands: 'some',
    shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' },
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = argv[i + 1];
    if (a === '--seed' && next) { seed = Number(next); i++; }
    else if (a === '--players' && next) { numPlayers = Number(next); i++; }
    else if (a === '--territories' && next) { params.numTerritories = Number(next); i++; }
    else if (a === '--islands' && next) { params.islands = next as MapParams['islands']; i++; }
    else if (a === '--shapes' && next) { params.shapes = next as MapParams['shapes']; i++; }
    else if (a === '--water' && next) { params.waterArea = next as MapParams['waterArea']; i++; }
    else if (a === '--no-boundary') { params.waterBoundary = false; }
    else if (a === '--format' && next) { format = next as 'ascii' | 'text'; i++; }
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return { seed, numPlayers, params, format };
}

function printHelp(): void {
  console.log(`Usage: npm run gen-map -- [options]
Options:
  --seed N             RNG seed (default: random)
  --players N          number of players (default 4)
  --territories N      number of territories (default 24)
  --islands MODE       none | some | lots (default some)
  --shapes MODE        regular | irregular (default regular)
  --water SIZE         small | medium | large (default small)
  --no-boundary        disable water boundary ring
  --format MODE        ascii (default) | text (Gettman map alphabet)`);
}

const { seed, numPlayers, params, format } = parseArgs(process.argv.slice(2));
const board = generateMap(seed, params, numPlayers);

console.log(`Seed: ${seed}`);
console.log(`Players: ${numPlayers} | Territories: ${params.numTerritories} | Islands: ${params.islands} | Shapes: ${params.shapes} | Water: ${params.waterArea}${params.waterBoundary ? '' : ' (no boundary)'}`);
console.log('');
if (format === 'text') console.log(encodeMap(board.squares));
else console.log(asciiBoard(board.squares));
console.log('');
console.log('Territory summary:');
const resName: Record<number, string> = {
  [Code.IRON]: 'Iron', [Code.COAL]: 'Coal', [Code.TREE]: 'Tree',
  [Code.GOLD]: 'Gold', [Code.STABLE]: 'Stable',
};
for (const t of board.territories) {
  const res = t.resource !== null ? resName[t.resource] ?? '?' : '-';
  const lakes = t.bordersLakes.size > 0 ? `lakes={${[...t.bordersLakes].join(',')}}` : '';
  console.log(`  T${t.id.toString().padStart(2, ' ')} squares=${t.squares.length.toString().padStart(2, ' ')} resource=${res.padEnd(7)} ${lakes}`);
}
```

- [ ] **Step 6: Smoke-test the CLI**

Run: `npm run gen-map -- --seed 12345`
Expected: prints seed line, params line, 20-line ASCII map, 24-line territory summary. No errors.

- [ ] **Step 7: Commit**

```bash
git add src/cli/genMap.ts src/cli/asciiPrint.ts tests/cli/asciiPrint.test.ts
git commit -m "Add gen-map CLI with ASCII printer and arg parsing"
```

---

## Task 32: README quickstart

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Lords of Conquest — Web Port

A modern, browser-based port of Randy Gettman's 2003 Java applet imitation of the 1986 Electronic Arts strategy game.

## Status

Two artifacts live in this repo:

- **CheerpJ embed** — `index.html` + `loc.jar`. Open `http://localhost:8000/` (after `python3 -m http.server 8000`) to play the original applet running in WebAssembly. Credits to Randy Gettman.
- **TypeScript port** — in progress under `src/`. Currently shipping: map generation. See `docs/superpowers/specs/2026-05-06-clean-room-port-design.md` for the full design and `docs/superpowers/plans/` for active implementation plans.

## Development

```bash
npm install
npm test                # vitest
npm run typecheck       # tsc --noEmit
npm run gen-map -- --seed 12345    # CLI map generator
```

### Map CLI

```
npm run gen-map -- --help
npm run gen-map -- --seed 42 --players 4 --territories 30 --islands some --shapes irregular
npm run gen-map -- --seed 42 --format text     # Gettman text encoding
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add README with quickstart and gen-map CLI examples"
```

---

## Task 33: Run full suite, lock the deliverable

**Files:** none

- [ ] **Step 1: Run full type check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: all tests pass. Should be approx 50 tests across all files.

- [ ] **Step 3: Smoke-test CLI in two formats**

Run: `npm run gen-map -- --seed 12345`
Expected: ASCII map + summary, no errors.

Run: `npm run gen-map -- --seed 12345 --format text`
Expected: 64-char alphabet map + footer.

- [ ] **Step 4: Confirm CheerpJ embed still works**

Open `http://localhost:8000/` in a browser (server already running from earlier).
Expected: applet still loads and is playable.

- [ ] **Step 5: Tag this milestone**

```bash
git tag -a v0.1.0-foundation -m "Plan 1 (Foundation) complete: project scaffolding, RNG, LocProb, map generator, CLI"
```

(Don't push the tag — let the user push manually.)

---

## Self-review notes

- **Spec coverage:** All Plan-1 spec sections covered. Reducer/plans/UI/AI explicitly deferred to Plans 2–4.
- **Unimplemented from the spec, on purpose:** GameState, Plan discriminated union, reducer, force calc, AI, UI, save/load game state. These are Plans 2–4.
- **No placeholders.** Every step is complete code or an exact command.
- **Commit cadence:** one commit per task, ~33 commits total.
- **Type consistency:** `Code`, `ResourceCode`, `Square`, `Territory`, `MapParams`, `Board`, `RngState` are referenced consistently across tasks.
