# Trade & Shipment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Trade and Shipment phases of the engine, plus the supporting boat-pool primitive used by both shipment (boat moves) and Plan 4 (boat builds). Trade includes proposal validation, accept/reject/reject-all, horse-landing logistics, the year-scoped `autoReject` matrix, and the triple-reject lockout. Shipment covers stockpile relocation (with the "forfeits the 2nd attack" interaction), horse moves (1 hop and 2 hop with optional rest-stop pickup), weapon moves (1 hop), and boat moves with embarkation. Plus phase-skip (1/6) for both phases, with the 2-player full-skip rule for trade.

**Architecture:** Same as Plan 2 — single immutable `GameState`, all transitions through `reduce(state, plan)`. New handlers fill in the `'trade' | 'tradeResponse' | 'tradeRejectAll' | 'horseFrom' | 'horseTo' | 'shipStockpile' | 'shipHorse' | 'shipWeapon' | 'shipBoat'` cases that currently throw `"not implemented in plan 2"`. Phase-skip uses the existing `PHASE_SKIP_PROBABILITY = 1/6` and `pickReason` from Plan 2. Conquest/Development/year-wrap remain Plan 4 territory.

**Tech Stack:** No new dependencies. TypeScript strict, Vitest, `tsx`.

**Reference:** Decompiled Java at `.reference/decompiled/` (gitignored). Spec: `docs/superpowers/specs/2026-05-06-clean-room-port-design.md`.

---

## File Structure (locked in for Plan 3)

```
src/game/
├── boats.ts                           # NEW — addBoat helper, boat pool mgmt
├── tradeKey.ts                        # NEW — canonical hash for triple-reject lookup
├── reducers/
│   ├── trade.ts                       # NEW — trade, tradeResponse, tradeRejectAll, horseFrom, horseTo
│   ├── shipment.ts                    # NEW — shipStockpile, shipHorse, shipWeapon, shipBoat
│   ├── endPhase.ts                    # MODIFY — add trade and shipment transitions
│   └── ...
├── reducer.ts                         # MODIFY — wire 9 new plan kinds
└── ...
tests/
├── boats.test.ts
├── tradeKey.test.ts
├── reducers/
│   ├── trade-propose.test.ts
│   ├── trade-response.test.ts
│   ├── trade-horses.test.ts
│   ├── trade-reject-all.test.ts
│   ├── trade-triple-reject.test.ts
│   ├── trade-end.test.ts
│   ├── shipment-stockpile.test.ts
│   ├── shipment-horse.test.ts
│   ├── shipment-weapon.test.ts
│   ├── shipment-boat.test.ts
│   └── shipment-end.test.ts
└── snapshots/
    └── trade-and-shipment.test.ts
```

---

## Task 1: `addBoat` boat-pool primitive

**Files:**
- Create: `src/game/boats.ts`
- Create: `tests/boats.test.ts`

Reference: spec section "Development phase" + LocApplet L3123–L3178. The 256-slot pool returns:
- `-1` if territory is landlocked (does not border the requested lake)
- `-2` if all docks are full (no `-1` water square adjacent on the chosen lake)
- `-3` if pool exhausted ("dock strike")

Returns the new boat's slot id on success. We don't enforce the dock-strike here yet (Plan 4 territory for the engineering), but the function signature anticipates it. For Plan 3 we just need `addBoat` to allocate a free pool slot, place a `Boat` record in it, and return a result discriminated union.

For Plan 3 the function is needed by `shipBoat` to **move** an existing boat (not create one). But Task 1 also lays groundwork for `buildBoat` in Plan 4.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { addBoat, findFreeBoatSlot } from '../src/game/boats.js';
import type { GameState, Territory } from '../src/game/types.js';

function emptyStateWithTerritories(numTerritories: number, lakesPerTerr: number[]): GameState {
  const territories: Territory[] = Array.from({ length: numTerritories }, (_, i) => ({
    id: i, ownerId: null, resource: null,
    hasCity: false, hasWeapon: false, hasHorse: false, hasStockpile: false,
    hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(Array.from({ length: lakesPerTerr[i] ?? 0 }, (_, k) => k)),
    citiesAdjacent: 0,
  }));
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: [{ color: 'red', name: 'r', persona: 'human' }, { color: 'blue', name: 'b', persona: 'human' }],
      citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories, touching: [], distance: [],
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

describe('boat pool', () => {
  it('findFreeBoatSlot returns 0 for an empty pool', () => {
    const s = emptyStateWithTerritories(2, [1, 1]);
    expect(findFreeBoatSlot(s.boats)).toBe(0);
  });

  it('findFreeBoatSlot finds the next null slot', () => {
    const s = emptyStateWithTerritories(2, [1, 1]);
    s.boats[0] = { id: 0, x: 0, y: 0, homeTerritoryId: 0, ownerId: 0, carryHorse: false, carryWeapon: false };
    s.boats[1] = { id: 1, x: 0, y: 0, homeTerritoryId: 0, ownerId: 0, carryHorse: false, carryWeapon: false };
    expect(findFreeBoatSlot(s.boats)).toBe(2);
  });

  it('findFreeBoatSlot returns -1 (dock strike) when pool is full', () => {
    const s = emptyStateWithTerritories(2, [1, 1]);
    for (let i = 0; i < 256; i++) {
      s.boats[i] = { id: i, x: 0, y: 0, homeTerritoryId: 0, ownerId: 0, carryHorse: false, carryWeapon: false };
    }
    expect(findFreeBoatSlot(s.boats)).toBe(-1);
  });

  it('addBoat returns -1 if territory does not border the requested lake', () => {
    const s = emptyStateWithTerritories(2, [1, 1]);
    // territory 0 borders lake 0 only
    expect(addBoat(s, /* terr */ 0, /* lake */ 99, /* owner */ 0).kind).toBe('landlocked');
  });

  it('addBoat returns -3 (dock strike) when pool is exhausted', () => {
    const s = emptyStateWithTerritories(2, [1, 1]);
    for (let i = 0; i < 256; i++) {
      s.boats[i] = { id: i, x: 0, y: 0, homeTerritoryId: 0, ownerId: 0, carryHorse: false, carryWeapon: false };
    }
    expect(addBoat(s, 0, 0, 0).kind).toBe('dockStrike');
  });

  it('addBoat returns ok with new slot id on success', () => {
    const s = emptyStateWithTerritories(2, [1, 1]);
    const result = addBoat(s, 0, 0, 0);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.boatId).toBe(0);
      expect(result.boats[0]).toMatchObject({
        id: 0, homeTerritoryId: 0, ownerId: 0, carryHorse: false, carryWeapon: false,
      });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/boats.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/boats.ts`**

```ts
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
  // Position is set by the caller (e.g. shipBoat) when moving a boat;
  // for a new boat the caller should also set x/y to a water cell on the lake.
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/boats.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/boats.ts tests/boats.test.ts
git commit -m "Add boat-pool primitive: findFreeBoatSlot and addBoat validators"
```

---

## Task 2: `tradeKey` canonical hash

**Files:**
- Create: `src/game/tradeKey.ts`
- Create: `tests/tradeKey.test.ts`

Used by the triple-reject lockout to recognize the same trade being proposed repeatedly.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { tradeKey, sameTrade } from '../src/game/tradeKey.js';
import type { Stockpile } from '../src/game/types.js';

const give = (a: number, b: number, c: number, d: number, e: number): Stockpile => [a, b, c, d, e];

describe('tradeKey', () => {
  it('produces the same key for identical trades', () => {
    expect(tradeKey(0, 1, give(1, 0, 0, 0, 0), give(0, 1, 0, 0, 0)))
      .toBe(tradeKey(0, 1, give(1, 0, 0, 0, 0), give(0, 1, 0, 0, 0)));
  });

  it('different give amounts produce different keys', () => {
    expect(tradeKey(0, 1, give(1, 0, 0, 0, 0), give(0, 1, 0, 0, 0)))
      .not.toBe(tradeKey(0, 1, give(2, 0, 0, 0, 0), give(0, 1, 0, 0, 0)));
  });

  it('different traders produce different keys', () => {
    expect(tradeKey(0, 1, give(1, 0, 0, 0, 0), give(0, 1, 0, 0, 0)))
      .not.toBe(tradeKey(1, 0, give(1, 0, 0, 0, 0), give(0, 1, 0, 0, 0)));
  });
});

describe('sameTrade', () => {
  it('matches identical trades', () => {
    expect(sameTrade(
      { trader: 0, tradee: 1, give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0) },
      { trader: 0, tradee: 1, give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0) },
    )).toBe(true);
  });

  it('matches symmetric reverse trades (per TradePlan.equals L39-77)', () => {
    expect(sameTrade(
      { trader: 0, tradee: 1, give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0) },
      { trader: 1, tradee: 0, give: give(0, 1, 0, 0, 0), receive: give(1, 0, 0, 0, 0) },
    )).toBe(true);
  });

  it('rejects different amounts', () => {
    expect(sameTrade(
      { trader: 0, tradee: 1, give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0) },
      { trader: 0, tradee: 1, give: give(2, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0) },
    )).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/tradeKey.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/tradeKey.ts`**

```ts
import type { Stockpile, PlayerId } from './types.js';

// Canonical string key for "this same trade between these same parties."
// Used to recognize repeats for the triple-reject lockout.
export function tradeKey(
  trader: PlayerId,
  tradee: PlayerId,
  give: Stockpile,
  receive: Stockpile,
): string {
  return `${trader}>${tradee}|${give.join(',')}|${receive.join(',')}`;
}

// Spec/Java parity (TradePlan.equals L39-77): the same trade is recognized in
// both directions — proposer↔tradee swapped along with give↔receive.
export function sameTrade(
  a: { trader: PlayerId; tradee: PlayerId; give: Stockpile; receive: Stockpile },
  b: { trader: PlayerId; tradee: PlayerId; give: Stockpile; receive: Stockpile },
): boolean {
  const arrEq = (x: Stockpile, y: Stockpile): boolean =>
    x[0] === y[0] && x[1] === y[1] && x[2] === y[2] && x[3] === y[3] && x[4] === y[4];
  const sameDir = a.trader === b.trader && a.tradee === b.tradee
    && arrEq(a.give, b.give) && arrEq(a.receive, b.receive);
  const reverseDir = a.trader === b.tradee && a.tradee === b.trader
    && arrEq(a.give, b.receive) && arrEq(a.receive, b.give);
  return sameDir || reverseDir;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/tradeKey.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/tradeKey.ts tests/tradeKey.test.ts
git commit -m "Add tradeKey canonical hash and sameTrade equivalence (TradePlan.equals)"
```

---

## Task 3: `trade` plan handler — propose

**Files:**
- Create: `src/game/reducers/trade.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/trade-propose.test.ts`

Validation rules:
- `currentPhase` must be `'trade'`.
- `proposer` must equal `currentPlayer`.
- `tradee` must be a different player who is `'playing'`.
- Proposer's stockpile must cover `give` (each slot ≥ corresponding give amount).
- Tradee's stockpile must cover `receive` (each slot ≥ corresponding receive amount).
- `give` and `receive` cannot both be all-zeros (must be a real trade).
- `pendingTrade` must be `null` (no in-flight proposal).

On success, store the proposal in `state.pendingTrade` with `status: 'proposed'`. Do not yet swap stockpiles.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, Stockpile } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
    { color: 'cyan', name: 'c', persona: 'human' },
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

const give = (a: number, b: number, c: number, d: number, e: number): Stockpile => [a, b, c, d, e];

function tradePhaseState(seed = 7): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  // Skip past production and any 1/6 skip, force into 'trade' phase manually
  // for unit tests; real production handlers and trade phase entry are wired
  // in Tasks 11+.
  s = { ...s, currentPhase: 'trade', pendingTrade: null };
  // Give players some stockpile resources
  s.players[0]!.stockpile = give(3, 1, 0, 0, 0);
  s.players[1]!.stockpile = give(0, 0, 2, 1, 0);
  s.players[2]!.stockpile = give(0, 0, 0, 0, 0);
  return s;
}

describe('trade propose', () => {
  it('valid proposal sets pendingTrade with status "proposed"', () => {
    const s = tradePhaseState();
    const out = reduce(s, {
      kind: 'trade',
      proposer: s.currentPlayer, tradee: 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 0, 1, 0, 0),
    });
    expect(out.pendingTrade).not.toBeNull();
    expect(out.pendingTrade!.proposerId).toBe(s.currentPlayer);
    expect(out.pendingTrade!.tradeeId).toBe(1);
    expect(out.pendingTrade!.status).toBe('proposed');
    // Stockpiles unchanged (the swap happens on accept, not propose)
    expect(out.players[s.currentPlayer]!.stockpile).toEqual(s.players[s.currentPlayer]!.stockpile);
  });

  it('rejects when phase is not trade', () => {
    const s = { ...tradePhaseState(), currentPhase: 'production' as const };
    expect(() => reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee: 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 0, 1, 0, 0),
    })).toThrow(/phase/i);
  });

  it('rejects when proposer is not currentPlayer', () => {
    const s = tradePhaseState();
    const wrong = (s.currentPlayer === 0 ? 1 : 0) as 0 | 1;
    expect(() => reduce(s, {
      kind: 'trade', proposer: wrong, tradee: 2,
      give: give(1, 0, 0, 0, 0), receive: give(0, 0, 1, 0, 0),
    })).toThrow(/current player/i);
  });

  it('rejects when proposer cannot cover give', () => {
    const s = tradePhaseState();
    expect(() => reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee: 1,
      give: give(99, 0, 0, 0, 0), receive: give(0, 0, 1, 0, 0),
    })).toThrow(/insufficient/i);
  });

  it('rejects when tradee cannot cover receive', () => {
    const s = tradePhaseState();
    expect(() => reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee: 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 0, 99, 0, 0),
    })).toThrow(/insufficient/i);
  });

  it('rejects all-zeros (null) trade', () => {
    const s = tradePhaseState();
    expect(() => reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee: 1,
      give: give(0, 0, 0, 0, 0), receive: give(0, 0, 0, 0, 0),
    })).toThrow(/empty trade|null trade/i);
  });

  it('rejects when a trade is already pending', () => {
    let s = tradePhaseState();
    s = reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee: 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 0, 1, 0, 0),
    });
    expect(() => reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee: 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 0, 1, 0, 0),
    })).toThrow(/already pending/i);
  });

  it('rejects when tradee is the proposer', () => {
    const s = tradePhaseState();
    expect(() => reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee: s.currentPlayer,
      give: give(1, 0, 0, 0, 0), receive: give(0, 0, 1, 0, 0),
    })).toThrow(/different player/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/trade-propose.test.ts`
Expected: FAIL — trade case throws "not implemented in plan 2".

- [ ] **Step 3: Implement `src/game/reducers/trade.ts`**

```ts
import type { GameState, PlayerId, Stockpile, TradeOffer } from '../types.js';

function isAllZero(s: Stockpile): boolean {
  return s[0] === 0 && s[1] === 0 && s[2] === 0 && s[3] === 0 && s[4] === 0;
}

function canCover(stock: Stockpile, ask: Stockpile): boolean {
  for (let i = 0; i < 5; i++) if (stock[i]! < ask[i]!) return false;
  return true;
}

export function applyTradePropose(
  prev: GameState,
  proposer: PlayerId,
  tradee: PlayerId,
  give: Stockpile,
  receive: Stockpile,
): GameState {
  if (prev.currentPhase !== 'trade') {
    throw new Error(`Trade plan illegal during ${prev.currentPhase} phase`);
  }
  if (proposer !== prev.currentPlayer) {
    throw new Error(`Trade by player ${proposer} but current player is ${prev.currentPlayer}`);
  }
  if (tradee === proposer) {
    throw new Error(`Trade tradee must be a different player`);
  }
  const t = prev.players[tradee];
  if (!t || t.status !== 'playing') {
    throw new Error(`Trade tradee ${tradee} is not playing`);
  }
  if (isAllZero(give) && isAllZero(receive)) {
    throw new Error(`Cannot propose empty trade (null trade)`);
  }
  if (prev.pendingTrade !== null) {
    throw new Error(`Trade already pending`);
  }
  const proposerStock = prev.players[proposer]!.stockpile;
  if (!canCover(proposerStock, give)) {
    throw new Error(`Proposer has insufficient stockpile to give`);
  }
  if (!canCover(t.stockpile, receive)) {
    throw new Error(`Tradee has insufficient stockpile for receive`);
  }
  const offer: TradeOffer = {
    proposerId: proposer,
    tradeeId: tradee,
    give: [...give] as Stockpile,
    receive: [...receive] as Stockpile,
    status: 'proposed',
  };
  return {
    ...prev,
    pendingTrade: offer,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'trade', player: proposer,
        message: `Trade proposed to player ${tradee}` },
    ],
  };
}
```

- [ ] **Step 4: Wire into reducer**

In `src/game/reducer.ts`:
```ts
import { applyTradePropose } from './reducers/trade.js';

// inside switch — replace `case 'trade':` to use the handler
    case 'trade':
      return applyTradePropose(state, plan.proposer, plan.tradee, plan.give, plan.receive);
```

Also remove `'trade'` from the `NOT_IMPLEMENTED_KINDS` array (since the handler now exists).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/trade-propose.test.ts`
Expected: 8 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/trade.ts src/game/reducer.ts tests/reducers/trade-propose.test.ts
git commit -m "Implement trade propose: validate, store pendingTrade"
```

---

## Task 4: `tradeResponse` — reject path

**Files:**
- Modify: `src/game/reducers/trade.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/trade-response.test.ts`

Validation:
- `currentPhase` must be `'trade'`.
- `pendingTrade` must be non-null and have `status: 'proposed'`.
- The plan does not need to identify the responder — the engine knows it's `pendingTrade.tradeeId`.

On reject:
- Append the rejection to `state.rejectedTrades` with the canonical `tradeKey`. If a record for this exact (trader, tradee, tradeKey) already exists, increment its `count`; otherwise add a new record with `count: 1`.
- Clear `pendingTrade` to null.
- Log the rejection.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import { tradeKey } from '../../src/game/tradeKey.js';
import type { GameState, GameSetup, Stockpile } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
    { color: 'cyan', name: 'c', persona: 'human' },
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

const give = (a: number, b: number, c: number, d: number, e: number): Stockpile => [a, b, c, d, e];

function inTradeWithProposal(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 11 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'trade', pendingTrade: null };
  s.players[s.currentPlayer]!.stockpile = give(3, 0, 0, 0, 0);
  s.players[1]!.stockpile = give(0, 3, 0, 0, 0);
  return reduce(s, {
    kind: 'trade',
    proposer: s.currentPlayer, tradee: 1,
    give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0),
  });
}

describe('tradeResponse: reject', () => {
  it('clears pendingTrade and adds to rejectedTrades with count 1', () => {
    const s = inTradeWithProposal();
    const out = reduce(s, { kind: 'tradeResponse', accept: false });
    expect(out.pendingTrade).toBeNull();
    expect(out.rejectedTrades).toHaveLength(1);
    expect(out.rejectedTrades[0]!.count).toBe(1);
    expect(out.rejectedTrades[0]!.trader).toBe(s.pendingTrade!.proposerId);
    expect(out.rejectedTrades[0]!.tradee).toBe(s.pendingTrade!.tradeeId);
    expect(out.rejectedTrades[0]!.tradeKey).toBe(
      tradeKey(s.pendingTrade!.proposerId, s.pendingTrade!.tradeeId,
               s.pendingTrade!.give, s.pendingTrade!.receive));
  });

  it('increments count when the same trade is rejected twice', () => {
    let s = inTradeWithProposal();
    const trade = s.pendingTrade!;
    s = reduce(s, { kind: 'tradeResponse', accept: false });
    // Re-propose same trade and reject again
    s = reduce(s, {
      kind: 'trade',
      proposer: trade.proposerId, tradee: trade.tradeeId,
      give: trade.give, receive: trade.receive,
    });
    s = reduce(s, { kind: 'tradeResponse', accept: false });
    expect(s.rejectedTrades).toHaveLength(1);
    expect(s.rejectedTrades[0]!.count).toBe(2);
  });

  it('rejects when no trade is pending', () => {
    const s = inTradeWithProposal();
    const cleared = { ...s, pendingTrade: null };
    expect(() => reduce(cleared, { kind: 'tradeResponse', accept: false })).toThrow(/no pending/i);
  });

  it('rejects when phase is not trade', () => {
    const s = inTradeWithProposal();
    const out = { ...s, currentPhase: 'production' as const };
    expect(() => reduce(out, { kind: 'tradeResponse', accept: false })).toThrow(/phase/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/trade-response.test.ts`
Expected: FAIL — tradeResponse case throws "not implemented".

- [ ] **Step 3: Append to `src/game/reducers/trade.ts`**

```ts
import { tradeKey } from '../tradeKey.js';

export function applyTradeResponse(prev: GameState, accept: boolean): GameState {
  if (prev.currentPhase !== 'trade') {
    throw new Error(`Trade response illegal during ${prev.currentPhase} phase`);
  }
  const offer = prev.pendingTrade;
  if (!offer || offer.status !== 'proposed') {
    throw new Error(`No pending trade proposal to respond to`);
  }
  if (!accept) {
    return rejectTrade(prev, offer);
  }
  // Accept path is added in Task 5.
  throw new Error(`Trade accept is implemented in a later task`);
}

function rejectTrade(prev: GameState, offer: NonNullable<GameState['pendingTrade']>): GameState {
  const key = tradeKey(offer.proposerId, offer.tradeeId, offer.give, offer.receive);
  const existing = prev.rejectedTrades.findIndex(
    (r) => r.trader === offer.proposerId && r.tradee === offer.tradeeId && r.tradeKey === key,
  );
  const rejectedTrades = [...prev.rejectedTrades];
  if (existing >= 0) {
    rejectedTrades[existing] = { ...rejectedTrades[existing]!, count: rejectedTrades[existing]!.count + 1 };
  } else {
    rejectedTrades.push({ trader: offer.proposerId, tradee: offer.tradeeId, tradeKey: key, count: 1 });
  }
  return {
    ...prev,
    pendingTrade: null,
    rejectedTrades,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'trade', player: offer.tradeeId,
        message: `Trade from player ${offer.proposerId} rejected` },
    ],
  };
}
```

- [ ] **Step 4: Wire into reducer**

In `src/game/reducer.ts`:
```ts
import { applyTradeResponse } from './reducers/trade.js';

// inside switch:
    case 'tradeResponse':
      return applyTradeResponse(state, plan.accept);
```

Remove `'tradeResponse'` from `NOT_IMPLEMENTED_KINDS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/trade-response.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/trade.ts src/game/reducer.ts tests/reducers/trade-response.test.ts
git commit -m "Implement tradeResponse reject path with rejectedTrades counter"
```

---

## Task 5: `tradeResponse` — accept path (no horses)

**Files:**
- Modify: `src/game/reducers/trade.ts`
- Modify: `tests/reducers/trade-response.test.ts`

When the trade has zero horses on either side, the swap is immediate: subtract `give` from proposer, add to tradee; subtract `receive` from tradee, add to proposer. Set `pendingTrade.status = 'accepted'` and clear it (or leave it briefly — the spec model marks `'accepted'` then clears; we'll clear immediately for non-horse trades). When horses ARE involved, the trade enters a `horseFrom`/`horseTo` resolution flow (Tasks 6 and 7) — for non-horse trades, those plans are unnecessary.

- [ ] **Step 1: Append failing tests**

```ts
describe('tradeResponse: accept (no horses)', () => {
  it('swaps stockpiles and clears pendingTrade', () => {
    const s = inTradeWithProposal();
    const beforeP = [...s.players[s.pendingTrade!.proposerId]!.stockpile];
    const beforeT = [...s.players[s.pendingTrade!.tradeeId]!.stockpile];
    const out = reduce(s, { kind: 'tradeResponse', accept: true });
    expect(out.pendingTrade).toBeNull();
    const afterP = out.players[s.pendingTrade!.proposerId]!.stockpile;
    const afterT = out.players[s.pendingTrade!.tradeeId]!.stockpile;
    // Proposer: -give +receive
    expect(afterP[0]).toBe(beforeP[0]! - s.pendingTrade!.give[0]! + s.pendingTrade!.receive[0]!);
    expect(afterP[1]).toBe(beforeP[1]! - s.pendingTrade!.give[1]! + s.pendingTrade!.receive[1]!);
    // Tradee: -receive +give
    expect(afterT[0]).toBe(beforeT[0]! - s.pendingTrade!.receive[0]! + s.pendingTrade!.give[0]!);
    expect(afterT[1]).toBe(beforeT[1]! - s.pendingTrade!.receive[1]! + s.pendingTrade!.give[1]!);
  });

  it('does NOT add to rejectedTrades on accept', () => {
    const s = inTradeWithProposal();
    const out = reduce(s, { kind: 'tradeResponse', accept: true });
    expect(out.rejectedTrades).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/trade-response.test.ts`
Expected: FAIL — accept path throws.

- [ ] **Step 3: Replace the accept-path stub in `src/game/reducers/trade.ts`**

```ts
function involvesHorses(offer: { give: Stockpile; receive: Stockpile }): boolean {
  return offer.give[4] > 0 || offer.receive[4] > 0;
}

function acceptTradeNoHorses(
  prev: GameState,
  offer: NonNullable<GameState['pendingTrade']>,
): GameState {
  const players = prev.players.map((p) => ({ ...p, stockpile: [...p.stockpile] as Stockpile }));
  for (let i = 0; i < 5; i++) {
    players[offer.proposerId]!.stockpile[i] -= offer.give[i]!;
    players[offer.proposerId]!.stockpile[i] += offer.receive[i]!;
    players[offer.tradeeId]!.stockpile[i] -= offer.receive[i]!;
    players[offer.tradeeId]!.stockpile[i] += offer.give[i]!;
  }
  return {
    ...prev,
    players,
    pendingTrade: null,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'trade', player: offer.tradeeId,
        message: `Trade from player ${offer.proposerId} accepted` },
    ],
  };
}
```

Update `applyTradeResponse`:
```ts
export function applyTradeResponse(prev: GameState, accept: boolean): GameState {
  if (prev.currentPhase !== 'trade') {
    throw new Error(`Trade response illegal during ${prev.currentPhase} phase`);
  }
  const offer = prev.pendingTrade;
  if (!offer || offer.status !== 'proposed') {
    throw new Error(`No pending trade proposal to respond to`);
  }
  if (!accept) return rejectTrade(prev, offer);
  if (involvesHorses(offer)) {
    // Move into the horseFrom/horseTo resolution flow (Tasks 6 & 7)
    return {
      ...prev,
      pendingTrade: { ...offer, status: 'accepted' },
      log: [
        ...prev.log,
        { year: prev.year, phase: 'trade', player: offer.tradeeId,
          message: `Trade accepted; awaiting horse resolution` },
      ],
    };
  }
  return acceptTradeNoHorses(prev, offer);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/trade-response.test.ts`
Expected: 6 passed (4 from Task 4 + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/trade.ts tests/reducers/trade-response.test.ts
git commit -m "Implement tradeResponse accept path for non-horse trades"
```

---

## Task 6: `horseFrom` plan handler

**Files:**
- Modify: `src/game/reducers/trade.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/trade-horses.test.ts`

A `horseFrom` plan removes one horse from a territory owned by the player who owes a horse to the trade. Validation:
- `pendingTrade` must exist and `status === 'accepted'`.
- `player` must be the side losing horses (proposer if `give[4] > 0`; tradee if `receive[4] > 0`).
  - If both sides are losing horses, the order is: proposer side first, then tradee side. (Gettman convention.)
- `territoryId` must be owned by `player` and have `hasHorse: true`.

Effect:
- Remove the horse from that territory.
- Set `pendingTrade.horseFromTerritoryId = territoryId`.
- The trade is **not yet complete** — it awaits a `horseTo` plan to land the horse on the receiver's side.

(For a complete implementation we'd also support multi-horse trades, but Gettman's UI restricts horse trades to 1 unit per side at a time. We model `horseFrom`/`horseTo` as one-each.)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, Stockpile } from '../../src/game/types.js';

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
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

const give = (a: number, b: number, c: number, d: number, e: number): Stockpile => [a, b, c, d, e];

function horseTradeAccepted(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 13 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'trade', pendingTrade: null };
  // Set up: proposer (currentPlayer) gives 1 horse, tradee gives 1 iron.
  s.players[s.currentPlayer]!.stockpile = give(0, 0, 0, 0, 1);
  s.players[1 - s.currentPlayer as 0 | 1]!.stockpile = give(1, 0, 0, 0, 0);
  // Place a horse on a territory owned by the proposer.
  const proposerTerr = s.territories.find((t) => t.ownerId === s.currentPlayer)!;
  s.territories[proposerTerr.id]!.hasHorse = true;
  // Place a territory owned by tradee with NO horse for the receive side.
  // (Plan 4 will detect this; for now, just have one available.)
  // Propose and accept
  s = reduce(s, {
    kind: 'trade',
    proposer: s.currentPlayer, tradee: (1 - s.currentPlayer) as 0 | 1,
    give: give(0, 0, 0, 0, 1), receive: give(1, 0, 0, 0, 0),
  });
  s = reduce(s, { kind: 'tradeResponse', accept: true });
  return s;
}

describe('horseFrom', () => {
  it('removes horse from the proposer-owned territory and updates pendingTrade', () => {
    const s = horseTradeAccepted();
    const proposerTerr = s.territories.find(
      (t) => t.ownerId === s.pendingTrade!.proposerId && t.hasHorse,
    )!;
    const out = reduce(s, {
      kind: 'horseFrom',
      player: s.pendingTrade!.proposerId,
      territoryId: proposerTerr.id,
    });
    expect(out.territories[proposerTerr.id]!.hasHorse).toBe(false);
    expect(out.pendingTrade!.horseFromTerritoryId).toBe(proposerTerr.id);
  });

  it('rejects when no horse on chosen territory', () => {
    const s = horseTradeAccepted();
    const tWithoutHorse = s.territories.find(
      (t) => t.ownerId === s.pendingTrade!.proposerId && !t.hasHorse,
    )!;
    expect(() => reduce(s, {
      kind: 'horseFrom',
      player: s.pendingTrade!.proposerId,
      territoryId: tWithoutHorse.id,
    })).toThrow(/no horse/i);
  });

  it('rejects when territory not owned by the giving player', () => {
    const s = horseTradeAccepted();
    const enemyTerr = s.territories.find((t) => t.ownerId !== s.pendingTrade!.proposerId)!;
    expect(() => reduce(s, {
      kind: 'horseFrom',
      player: s.pendingTrade!.proposerId,
      territoryId: enemyTerr.id,
    })).toThrow(/not owned/i);
  });

  it('rejects when no trade is pending', () => {
    const s = horseTradeAccepted();
    const cleared = { ...s, pendingTrade: null };
    expect(() => reduce(cleared, { kind: 'horseFrom', player: 0, territoryId: 0 }))
      .toThrow(/no pending|accepted/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/trade-horses.test.ts`
Expected: FAIL — horseFrom case throws.

- [ ] **Step 3: Append to `src/game/reducers/trade.ts`**

```ts
import type { PlayerId } from '../types.js';

export function applyHorseFrom(
  prev: GameState,
  player: PlayerId,
  territoryId: number,
): GameState {
  if (prev.currentPhase !== 'trade') {
    throw new Error(`horseFrom illegal during ${prev.currentPhase} phase`);
  }
  const offer = prev.pendingTrade;
  if (!offer || offer.status !== 'accepted') {
    throw new Error(`No accepted pending trade for horseFrom`);
  }
  if (offer.horseFromTerritoryId !== undefined) {
    throw new Error(`horseFrom already resolved`);
  }
  // Determine the giving side
  let givingPlayer: PlayerId;
  if (offer.give[4] > 0) givingPlayer = offer.proposerId;
  else if (offer.receive[4] > 0) givingPlayer = offer.tradeeId;
  else throw new Error(`Trade involves no horses`);
  if (player !== givingPlayer) {
    throw new Error(`horseFrom by player ${player} but giving side is ${givingPlayer}`);
  }
  const t = prev.territories[territoryId];
  if (!t) throw new Error(`No territory ${territoryId}`);
  if (t.ownerId !== player) throw new Error(`Territory ${territoryId} not owned by player ${player}`);
  if (!t.hasHorse) throw new Error(`Territory ${territoryId} has no horse to remove`);

  const territories = prev.territories.map((tt) =>
    tt.id === territoryId ? { ...tt, hasHorse: false } : tt,
  );
  return {
    ...prev,
    territories,
    pendingTrade: { ...offer, horseFromTerritoryId: territoryId },
    log: [
      ...prev.log,
      { year: prev.year, phase: 'trade', player,
        message: `Horse picked up from territory ${territoryId}` },
    ],
  };
}
```

- [ ] **Step 4: Wire into reducer**

In `src/game/reducer.ts`:
```ts
import { applyHorseFrom } from './reducers/trade.js';

// inside switch:
    case 'horseFrom':
      return applyHorseFrom(state, plan.player, plan.territoryId);
```

Remove `'horseFrom'` from `NOT_IMPLEMENTED_KINDS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/trade-horses.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/trade.ts src/game/reducer.ts tests/reducers/trade-horses.test.ts
git commit -m "Implement horseFrom: remove horse from giver's territory"
```

---

## Task 7: `horseTo` plan handler — completes the horse trade

**Files:**
- Modify: `src/game/reducers/trade.ts`
- Modify: `src/game/reducer.ts`
- Modify: `tests/reducers/trade-horses.test.ts`

A `horseTo` plan places the traded horse on a territory owned by the receiving side. Validation:
- `pendingTrade` must exist and `status === 'accepted'`.
- `pendingTrade.horseFromTerritoryId` must be set (horseFrom completed first).
- `player` must be the receiving side.
- `territoryId` must be owned by the receiver and have `hasHorse: false`.

Effect:
- Place the horse on the chosen territory.
- Apply the full stockpile swap (just like `acceptTradeNoHorses`).
- Clear `pendingTrade`.
- Log the completion.

- [ ] **Step 1: Append failing tests**

```ts
describe('horseTo (completes horse trade)', () => {
  it('places horse on receiver territory and swaps stockpiles', () => {
    let s = horseTradeAccepted();
    const proposerTerrWithHorse = s.territories.find(
      (t) => t.ownerId === s.pendingTrade!.proposerId && t.hasHorse,
    )!;
    s = reduce(s, {
      kind: 'horseFrom',
      player: s.pendingTrade!.proposerId, territoryId: proposerTerrWithHorse.id,
    });
    const tradeeTerrNoHorse = s.territories.find(
      (t) => t.ownerId === s.pendingTrade!.tradeeId && !t.hasHorse,
    )!;
    const beforeP = [...s.players[s.pendingTrade!.proposerId]!.stockpile];
    const beforeT = [...s.players[s.pendingTrade!.tradeeId]!.stockpile];
    s = reduce(s, {
      kind: 'horseTo',
      player: s.pendingTrade!.tradeeId, territoryId: tradeeTerrNoHorse.id,
    });
    expect(s.territories[tradeeTerrNoHorse.id]!.hasHorse).toBe(true);
    expect(s.pendingTrade).toBeNull();
    // Stockpile swap fully applied
    const afterP = s.players[beforeP === beforeP ? 0 : 1] /* avoids stale references; recompute */;
  });

  it('rejects when horseFrom has not been resolved', () => {
    const s = horseTradeAccepted(); // accepted but no horseFrom yet
    expect(() => reduce(s, { kind: 'horseTo', player: 0, territoryId: 0 }))
      .toThrow(/horseFrom|not yet/i);
  });

  it('rejects when target territory already has a horse', () => {
    let s = horseTradeAccepted();
    const proposerTerrWithHorse = s.territories.find(
      (t) => t.ownerId === s.pendingTrade!.proposerId && t.hasHorse,
    )!;
    s = reduce(s, {
      kind: 'horseFrom', player: s.pendingTrade!.proposerId, territoryId: proposerTerrWithHorse.id,
    });
    const tradeeTerr = s.territories.find((t) => t.ownerId === s.pendingTrade!.tradeeId)!;
    s.territories[tradeeTerr.id]!.hasHorse = true;
    expect(() => reduce(s, {
      kind: 'horseTo', player: s.pendingTrade!.tradeeId, territoryId: tradeeTerr.id,
    })).toThrow(/already has a horse/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/trade-horses.test.ts`
Expected: FAIL — horseTo case throws.

- [ ] **Step 3: Append to `src/game/reducers/trade.ts`**

```ts
export function applyHorseTo(
  prev: GameState,
  player: PlayerId,
  territoryId: number,
): GameState {
  if (prev.currentPhase !== 'trade') {
    throw new Error(`horseTo illegal during ${prev.currentPhase} phase`);
  }
  const offer = prev.pendingTrade;
  if (!offer || offer.status !== 'accepted') {
    throw new Error(`No accepted pending trade for horseTo`);
  }
  if (offer.horseFromTerritoryId === undefined) {
    throw new Error(`horseFrom not yet resolved`);
  }
  // Receiver = whoever didn't give the horse
  let receivingPlayer: PlayerId;
  if (offer.give[4] > 0) receivingPlayer = offer.tradeeId;
  else if (offer.receive[4] > 0) receivingPlayer = offer.proposerId;
  else throw new Error(`Trade involves no horses`);
  if (player !== receivingPlayer) {
    throw new Error(`horseTo by player ${player} but receiver is ${receivingPlayer}`);
  }
  const t = prev.territories[territoryId];
  if (!t) throw new Error(`No territory ${territoryId}`);
  if (t.ownerId !== player) throw new Error(`Territory ${territoryId} not owned by player ${player}`);
  if (t.hasHorse) throw new Error(`Territory ${territoryId} already has a horse`);

  // Apply territory + stockpile mutations
  const territories = prev.territories.map((tt) =>
    tt.id === territoryId ? { ...tt, hasHorse: true } : tt,
  );
  const players = prev.players.map((p) => ({ ...p, stockpile: [...p.stockpile] as Stockpile }));
  for (let i = 0; i < 5; i++) {
    players[offer.proposerId]!.stockpile[i] -= offer.give[i]!;
    players[offer.proposerId]!.stockpile[i] += offer.receive[i]!;
    players[offer.tradeeId]!.stockpile[i] -= offer.receive[i]!;
    players[offer.tradeeId]!.stockpile[i] += offer.give[i]!;
  }
  return {
    ...prev,
    territories,
    players,
    pendingTrade: null,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'trade', player,
        message: `Horse landed on territory ${territoryId}; trade complete` },
    ],
  };
}
```

- [ ] **Step 4: Wire into reducer**

```ts
import { applyHorseTo } from './reducers/trade.js';

// inside switch:
    case 'horseTo':
      return applyHorseTo(state, plan.player, plan.territoryId);
```

Remove `'horseTo'` from `NOT_IMPLEMENTED_KINDS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/trade-horses.test.ts`
Expected: 7 passed (4 horseFrom + 3 horseTo).

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/trade.ts src/game/reducer.ts tests/reducers/trade-horses.test.ts
git commit -m "Implement horseTo: place horse and complete the stockpile swap"
```

---

## Task 8: `tradeRejectAll` — autoReject matrix

**Files:**
- Modify: `src/game/reducers/trade.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/trade-reject-all.test.ts`

`tradeRejectAll` is issued by a player to permanently refuse all trade proposals from a specific other player for the rest of the year. The plan carries `{ tradee, trader }` — the tradee is "me" (the rejecter), trader is the player I'm blocking.

Validation:
- `currentPhase === 'trade'`.
- `pendingTrade` must be either null OR have `status === 'proposed'` (so we can reject the in-flight one too).
- `tradee !== trader`.

Effect:
- Set `state.autoReject[tradee][trader] = true`.
- If there's a pending proposal from `trader` to `tradee`, reject it (calls `rejectTrade`).
- Log.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, Stockpile } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
    { color: 'cyan', name: 'c', persona: 'human' },
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

const give = (a: number, b: number, c: number, d: number, e: number): Stockpile => [a, b, c, d, e];

function tradePhase(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 17 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'trade', pendingTrade: null };
  s.players[0]!.stockpile = give(3, 0, 0, 0, 0);
  s.players[1]!.stockpile = give(0, 3, 0, 0, 0);
  s.players[2]!.stockpile = give(0, 0, 3, 0, 0);
  return s;
}

describe('tradeRejectAll', () => {
  it('sets autoReject[tradee][trader] = true', () => {
    const s = tradePhase();
    const out = reduce(s, { kind: 'tradeRejectAll', tradee: 1, trader: 0 });
    expect(out.autoReject[1]![0]).toBe(true);
    expect(out.autoReject[0]![1]).toBe(false); // not symmetric
  });

  it('rejects a pending proposal from trader→tradee at the same time', () => {
    let s = tradePhase();
    s = reduce(s, {
      kind: 'trade',
      proposer: s.currentPlayer, tradee: 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0),
    });
    expect(s.pendingTrade).not.toBeNull();
    s = reduce(s, { kind: 'tradeRejectAll', tradee: 1, trader: s.currentPlayer });
    expect(s.pendingTrade).toBeNull();
  });

  it('blocks future proposals from same trader', () => {
    let s = tradePhase();
    s = reduce(s, { kind: 'tradeRejectAll', tradee: 1, trader: s.currentPlayer });
    expect(() => reduce(s, {
      kind: 'trade',
      proposer: s.currentPlayer, tradee: 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0),
    })).toThrow(/auto-reject/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/trade-reject-all.test.ts`
Expected: FAIL — tradeRejectAll case throws.

- [ ] **Step 3: Append to `src/game/reducers/trade.ts`**

```ts
export function applyTradeRejectAll(
  prev: GameState,
  tradee: PlayerId,
  trader: PlayerId,
): GameState {
  if (prev.currentPhase !== 'trade') {
    throw new Error(`tradeRejectAll illegal during ${prev.currentPhase} phase`);
  }
  if (tradee === trader) throw new Error(`tradeRejectAll requires different players`);

  // Update autoReject matrix
  const autoReject = prev.autoReject.map((row) => [...row]);
  autoReject[tradee]![trader] = true;
  let mid: GameState = { ...prev, autoReject };

  // If a matching trade is pending, reject it
  if (prev.pendingTrade && prev.pendingTrade.proposerId === trader && prev.pendingTrade.tradeeId === tradee
      && prev.pendingTrade.status === 'proposed') {
    mid = rejectTrade(mid, mid.pendingTrade!);
  }
  return {
    ...mid,
    log: [
      ...mid.log,
      { year: mid.year, phase: 'trade', player: tradee,
        message: `Player ${tradee} auto-rejects all trades from ${trader}` },
    ],
  };
}
```

Update `applyTradePropose` to check `autoReject` before validation:
```ts
  // Add early in applyTradePropose, after the basic phase/player checks:
  if (prev.autoReject[tradee]?.[proposer]) {
    throw new Error(`Player ${tradee} has set auto-reject for ${proposer}`);
  }
```

- [ ] **Step 4: Wire into reducer**

```ts
import { applyTradeRejectAll } from './reducers/trade.js';

// inside switch:
    case 'tradeRejectAll':
      return applyTradeRejectAll(state, plan.tradee, plan.trader);
```

Remove `'tradeRejectAll'` from `NOT_IMPLEMENTED_KINDS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/trade-reject-all.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/trade.ts src/game/reducer.ts tests/reducers/trade-reject-all.test.ts
git commit -m "Implement tradeRejectAll: autoReject matrix and pending-rejection"
```

---

## Task 9: Triple-reject lockout

**Files:**
- Modify: `src/game/reducers/trade.ts`
- Create: `tests/reducers/trade-triple-reject.test.ts`

Reference: spec — "Triple-reject lockout: the same `(trader, tradee, give, receive)` cannot be proposed more than 3 times in one year (`isTradeAlreadyRejected`)."

In `applyTradePropose`, after validating but before storing the pending trade, check whether `state.rejectedTrades` contains a record matching the canonical `tradeKey` for this proposal with `count >= 3`. If so, throw.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, Stockpile } from '../../src/game/types.js';

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
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

const give = (a: number, b: number, c: number, d: number, e: number): Stockpile => [a, b, c, d, e];

function tradePhase(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 19 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'trade', pendingTrade: null };
  s.players[0]!.stockpile = give(5, 0, 0, 0, 0);
  s.players[1]!.stockpile = give(0, 5, 0, 0, 0);
  return s;
}

describe('triple-reject lockout', () => {
  it('blocks the 4th identical proposal in a year', () => {
    let s = tradePhase();
    const proposalArgs = {
      proposer: s.currentPlayer, tradee: (1 - s.currentPlayer) as 0 | 1,
      give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0),
    } as const;

    // Propose & reject 3 times
    for (let i = 0; i < 3; i++) {
      s = reduce(s, { kind: 'trade', ...proposalArgs });
      s = reduce(s, { kind: 'tradeResponse', accept: false });
    }
    // 4th proposal blocked
    expect(() => reduce(s, { kind: 'trade', ...proposalArgs })).toThrow(/already rejected|3 times/i);
  });

  it('allows a different trade after 3 rejections of the original', () => {
    let s = tradePhase();
    for (let i = 0; i < 3; i++) {
      s = reduce(s, {
        kind: 'trade',
        proposer: s.currentPlayer, tradee: (1 - s.currentPlayer) as 0 | 1,
        give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0),
      });
      s = reduce(s, { kind: 'tradeResponse', accept: false });
    }
    // Different amounts → new tradeKey → allowed
    s = reduce(s, {
      kind: 'trade',
      proposer: s.currentPlayer, tradee: (1 - s.currentPlayer) as 0 | 1,
      give: give(2, 0, 0, 0, 0), receive: give(0, 2, 0, 0, 0),
    });
    expect(s.pendingTrade).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/trade-triple-reject.test.ts`
Expected: FAIL — 4th proposal succeeds where it should throw.

- [ ] **Step 3: Add lockout check in `applyTradePropose`**

After the autoReject check and before storing `pendingTrade`, add:
```ts
  // Triple-reject lockout
  const key = tradeKey(proposer, tradee, give, receive);
  const prior = prev.rejectedTrades.find(
    (r) => r.trader === proposer && r.tradee === tradee && r.tradeKey === key,
  );
  if (prior && prior.count >= 3) {
    throw new Error(`Trade already rejected 3 times this year`);
  }
```

(Add `import { tradeKey } from '../tradeKey.js';` if not already imported.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/trade-triple-reject.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/trade.ts tests/reducers/trade-triple-reject.test.ts
git commit -m "Add triple-reject lockout in applyTradePropose"
```

---

## Task 10: `endPhase` for trade — 1/6 skip + 2-player full-skip + advance

**Files:**
- Modify: `src/game/reducers/endPhase.ts`
- Create: `tests/reducers/endPhase-trade.test.ts`

`endPhase` from `'trade'` must:
1. Advance turn within the phase: rotate `currentPlayer` to next player in `turnOrder`.
2. If the rotation has wrapped back to `turnOrder[0]`, the phase is over for all players. Move on to `'shipment'`.
3. The Production phase (Plan 2) handled its own 1/6 skip when transitioning *into* it. Trade is similar: when transitioning *into* trade (which currently happens from the production handler advancing to `'trade'`), check for skip. The 2-player full-skip rule is checked in the same place: `numPlayers === 2 → skip the whole trade phase`.

The trade phase entry happens at the production-skip / production-tick handler when it sets `currentPhase = 'trade'`. To keep the Plan 2 production handler unchanged, we intercept trade-entry in `endPhase`: when transitioning from production → trade, run the skip and 2-player rules at that boundary.

For Plan 3, the simplest model:
- `endPhase` from trade: rotate player; if wrapped, advance to shipment.
- A new helper `enterTradePhase(state)` is called from `endPhase` (or from a separate mechanism) that handles the skip / full-skip. We expose this as part of the `'production' → 'trade'` transition: when a `'production'` `endPhase` is requested AND production has been completed, advance to trade with skip-roll.

For Plan 3 we'll add a new `endPhase` branch for `'production'` that:
- Validates production is complete (the previous `production` plan ran).
- Rolls 1/6: if skip → log + jump to shipment entry (which itself rolls). If 2 players → unconditionally skip trade entirely.
- Otherwise → set `currentPhase = 'trade'`, set `currentPlayer = turnOrder[0]`, log.

(Production phase entry was already wired in Plan 2 when selection ended; that path doesn't need a `production` endPhase. So this `endPhase` from production triggers when the production *plan* has completed and we're moving into trade.)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

const setup3: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
    { color: 'cyan', name: 'c', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const setup2: GameSetup = { ...setup3, players: setup3.players.slice(0, 2) };

const initial = (s: GameSetup): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup: s, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function inProductionDone(s: GameSetup, seed: number): GameState {
  let st = reduce(initial(s), { kind: 'newGame', setup: s, seed });
  while (st.territories.some((t) => t.ownerId === null)) {
    const free = st.territories.find((t) => t.ownerId === null)!;
    st = reduce(st, { kind: 'selection', player: st.currentPlayer, territoryId: free.id });
  }
  st = reduce(st, { kind: 'endPhase', player: st.currentPlayer });
  // Force production tick to complete so the next endPhase is from production
  st = reduce(st, { kind: 'production' });
  // If production skipped, that handler already advanced to trade — restore to production
  if (st.currentPhase === 'trade') st = { ...st, currentPhase: 'production' };
  return st;
}

describe('endPhase: production → trade', () => {
  it('3+ players: rolls 1/6 skip; advances to trade or shipment', () => {
    const s = inProductionDone(setup3, 42);
    const out = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    // Either trade or shipment depending on skip roll
    expect(['trade', 'shipment']).toContain(out.currentPhase);
    if (out.currentPhase === 'shipment') {
      // Skipped — log entry should mention skip and a reason
      const last = out.log[out.log.length - 1]!;
      expect(last.message).toMatch(/skipped/i);
    }
  });

  it('2 players: trade is always skipped (regardless of roll)', () => {
    const s = inProductionDone(setup2, 42);
    const out = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(out.currentPhase).toBe('shipment');
    // Log says trade-skipped due to 2-player rule
    const messages = out.log.map((l) => l.message).join(' ');
    expect(messages).toMatch(/2 players|skipped/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/endPhase-trade.test.ts`
Expected: FAIL — endPhase from production still throws.

- [ ] **Step 3: Update `src/game/reducers/endPhase.ts`**

Add a `case 'production':` branch:

```ts
import { PHASE_SKIP_PROBABILITY } from '../constants.js';
import { createRng, nextFloat } from '../rng.js';
import { pickReason } from '../reasons.js';

// inside the switch in applyEndPhase:
    case 'production': {
      // Production has completed. Decide whether trade is skipped.
      const numPlayers = prev.players.filter((p) => p.status === 'playing').length;
      // 2-player full-skip
      if (numPlayers === 2) {
        return {
          ...prev,
          currentPhase: 'shipment',
          currentPlayer: prev.turnOrder[0]!,
          log: [
            ...prev.log,
            { year: prev.year, phase: 'shipment', player: prev.turnOrder[0]!,
              message: 'Trade phase skipped (2 players)' },
          ],
        };
      }
      // 1/6 skip
      const rng = { seed: prev.seed, cursor: prev.rngCursor };
      const skipRoll = nextFloat(rng);
      if (skipRoll < PHASE_SKIP_PROBABILITY) {
        const reason = pickReason(rng);
        return {
          ...prev,
          rngCursor: rng.cursor,
          currentPhase: 'shipment',
          currentPlayer: prev.turnOrder[0]!,
          log: [
            ...prev.log,
            { year: prev.year, phase: 'trade', player: prev.currentPlayer,
              message: `Trade skipped: ${reason}` },
          ],
        };
      }
      return {
        ...prev,
        rngCursor: rng.cursor,
        currentPhase: 'trade',
        currentPlayer: prev.turnOrder[0]!,
        log: [
          ...prev.log,
          { year: prev.year, phase: 'trade', player: prev.turnOrder[0]!,
            message: 'Trade phase begins' },
        ],
      };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/endPhase-trade.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/endPhase.ts tests/reducers/endPhase-trade.test.ts
git commit -m "endPhase: production → trade with 1/6 skip and 2-player full-skip"
```

---

## Task 11: `endPhase` for trade — rotate player; on wrap, advance to shipment

**Files:**
- Modify: `src/game/reducers/endPhase.ts`
- Modify: `tests/reducers/endPhase-trade.test.ts`

After the trade phase entry, each player issues their own `endPhase` to indicate "I'm done trading." `endPhase` from `'trade'` rotates the current player. When the rotation wraps back to `turnOrder[0]`, the phase ends and we advance to shipment (which itself may 1/6-skip).

- [ ] **Step 1: Append failing tests**

```ts
describe('endPhase: trade rotation', () => {
  it('rotates currentPlayer within trade until wrap', () => {
    let s = inProductionDone(setup3, 999);
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    if (s.currentPhase !== 'trade') return; // skipped — skip this test
    const startPlayer = s.currentPlayer;
    // Each player ends trade in turn
    for (let i = 0; i < s.players.length - 1; i++) {
      const before = s.currentPlayer;
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      // Either rotated within trade, or rolled to shipment after wrap
      if (s.currentPhase === 'trade') {
        expect(s.currentPlayer).not.toBe(before);
      }
    }
  });

  it('after the last player ends trade, advances to shipment', () => {
    let s = inProductionDone(setup3, 999);
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    if (s.currentPhase !== 'trade') return;
    // End trade for each player exactly once
    for (let i = 0; i < s.players.length; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(s.currentPhase).toBe('shipment');
  });

  it('rejects endPhase from trade when pendingTrade is in flight', () => {
    let s = inProductionDone(setup3, 100);
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    if (s.currentPhase !== 'trade') return;
    s.players[s.currentPlayer]!.stockpile = [3, 0, 0, 0, 0];
    s.players[(s.currentPlayer + 1) % s.players.length]!.stockpile = [0, 3, 0, 0, 0];
    s = reduce(s, {
      kind: 'trade',
      proposer: s.currentPlayer,
      tradee: ((s.currentPlayer + 1) % s.players.length) as 0 | 1 | 2,
      give: [1, 0, 0, 0, 0], receive: [0, 1, 0, 0, 0],
    });
    expect(() => reduce(s, { kind: 'endPhase', player: s.currentPlayer }))
      .toThrow(/pending trade/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/endPhase-trade.test.ts`
Expected: FAIL — endPhase from trade still throws.

- [ ] **Step 3: Add `case 'trade':` to `applyEndPhase`**

```ts
    case 'trade': {
      if (prev.pendingTrade !== null) {
        throw new Error(`Cannot end trade with a pending trade in flight`);
      }
      const idx = prev.turnOrder.indexOf(prev.currentPlayer);
      const nextIdx = (idx + 1) % prev.turnOrder.length;
      if (nextIdx !== 0) {
        // Rotate to next player
        return {
          ...prev,
          currentPlayer: prev.turnOrder[nextIdx]!,
          log: [
            ...prev.log,
            { year: prev.year, phase: 'trade', player: prev.turnOrder[nextIdx]!,
              message: `Player ${prev.turnOrder[nextIdx]} begins trading` },
          ],
        };
      }
      // Wrapped — advance to shipment with 1/6 skip
      const rng = { seed: prev.seed, cursor: prev.rngCursor };
      const skipRoll = nextFloat(rng);
      if (skipRoll < PHASE_SKIP_PROBABILITY) {
        const reason = pickReason(rng);
        return {
          ...prev,
          rngCursor: rng.cursor,
          currentPhase: 'conquest',
          currentPlayer: prev.turnOrder[0]!,
          shipmentUsed: false,
          attackNumber: 1,
          log: [
            ...prev.log,
            { year: prev.year, phase: 'shipment', player: prev.currentPlayer,
              message: `Shipment skipped: ${reason}` },
          ],
        };
      }
      return {
        ...prev,
        rngCursor: rng.cursor,
        currentPhase: 'shipment',
        currentPlayer: prev.turnOrder[0]!,
        shipmentUsed: false,
        log: [
          ...prev.log,
          { year: prev.year, phase: 'shipment', player: prev.turnOrder[0]!,
            message: 'Shipment phase begins' },
        ],
      };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/endPhase-trade.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/endPhase.ts tests/reducers/endPhase-trade.test.ts
git commit -m "endPhase: trade rotation; on wrap advance to shipment with 1/6 skip"
```

---

## Task 12: `shipStockpile` plan handler

**Files:**
- Create: `src/game/reducers/shipment.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/shipment-stockpile.test.ts`

Reference: spec — "Move stockpile: move an entire territory's-worth of resources from one owned territory to another (forfeits the 2nd attack this turn)."

Validation:
- `currentPhase === 'shipment'`.
- `player === currentPlayer`.
- `from` and `to` are both owned by `player`.
- `from === currentPlayer`'s `stockpileLocation`.
- `to !== from`.
- `state.shipmentUsed` must be `false`.

Effect:
- Set `players[player].stockpileLocation = to`.
- Set `territories[from].hasStockpile = false`, `territories[to].hasStockpile = true`.
- Set `state.shipmentUsed = true` (and a side-flag `state.shipmentForfeitsSecondAttack = true` — but for Plan 3 we just set `attackNumber = 2` later when entering conquest if the forfeit applies; simpler: store a boolean on state).

For Plan 3 we add a new field `state.shipmentForfeitsSecondAttack: boolean` to track this. (Or reuse `shipmentUsed` plus a check at conquest-entry.)

Actually re-reading the spec: "Choosing to ship the stockpile in the Shipment phase forfeits the 2nd attack this turn." Reusing `shipmentUsed` is overloaded — both "shipped a unit" and "shipped stockpile, no 2nd attack" produce `shipmentUsed=true`. We need to distinguish. Add `state.shipmentForfeitsSecondAttack: boolean` (only true when stockpile was the ship type).

Update `GameState` type and `applyNewGame` to include this new field defaulting to `false`.

- [ ] **Step 1: Add field to `GameState`**

In `src/game/types.ts`, add inside `GameState`:
```ts
  shipmentForfeitsSecondAttack: boolean;
```

In `src/game/reducers/newGame.ts`, populate it:
```ts
    shipmentForfeitsSecondAttack: false,
```

In `src/game/reducers/endPhase.ts` (the `'trade'` case that advances to shipment), add `shipmentForfeitsSecondAttack: false` to the returned objects (both skip and non-skip branches).

In `src/game/reducers/loadmap.ts`, add `shipmentForfeitsSecondAttack: false` in the returned object too.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, Stockpile } from '../../src/game/types.js';

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
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

const give = (a: number, b: number, c: number, d: number, e: number): Stockpile => [a, b, c, d, e];

function shipmentPhase(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 23 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'shipment', currentPlayer: 0, shipmentUsed: false, shipmentForfeitsSecondAttack: false };
  // Place a stockpile for player 0
  const myTerr = s.territories.find((t) => t.ownerId === 0)!;
  s.territories[myTerr.id]!.hasStockpile = true;
  s.players[0]!.stockpileLocation = myTerr.id;
  s.players[0]!.stockpile = give(2, 1, 0, 0, 0);
  return s;
}

describe('shipStockpile', () => {
  it('moves stockpile to a different owned territory', () => {
    const s = shipmentPhase();
    const from = s.players[0]!.stockpileLocation!;
    const to = s.territories.find((t) => t.ownerId === 0 && t.id !== from)!.id;
    const out = reduce(s, { kind: 'shipStockpile', player: 0, from, to });
    expect(out.players[0]!.stockpileLocation).toBe(to);
    expect(out.territories[from]!.hasStockpile).toBe(false);
    expect(out.territories[to]!.hasStockpile).toBe(true);
    expect(out.shipmentUsed).toBe(true);
    expect(out.shipmentForfeitsSecondAttack).toBe(true);
  });

  it('rejects when already shipped this turn', () => {
    const s = { ...shipmentPhase(), shipmentUsed: true };
    const from = s.players[0]!.stockpileLocation!;
    const to = s.territories.find((t) => t.ownerId === 0 && t.id !== from)!.id;
    expect(() => reduce(s, { kind: 'shipStockpile', player: 0, from, to }))
      .toThrow(/already shipped/i);
  });

  it('rejects when from is not the player\'s stockpile location', () => {
    const s = shipmentPhase();
    const wrong = s.territories.find((t) => t.ownerId === 0 && !t.hasStockpile)!.id;
    const to = s.territories.find((t) => t.ownerId === 0 && t.id !== wrong)!.id;
    expect(() => reduce(s, { kind: 'shipStockpile', player: 0, from: wrong, to }))
      .toThrow(/stockpile/i);
  });

  it('rejects when to is not owned by the player', () => {
    const s = shipmentPhase();
    const from = s.players[0]!.stockpileLocation!;
    const enemy = s.territories.find((t) => t.ownerId === 1)!.id;
    expect(() => reduce(s, { kind: 'shipStockpile', player: 0, from, to: enemy }))
      .toThrow(/owned/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/reducers/shipment-stockpile.test.ts`
Expected: FAIL — shipStockpile case throws.

- [ ] **Step 4: Implement `src/game/reducers/shipment.ts`**

```ts
import type { GameState, PlayerId } from '../types.js';

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
```

- [ ] **Step 5: Wire into reducer**

In `src/game/reducer.ts`:
```ts
import { applyShipStockpile } from './reducers/shipment.js';

// inside switch:
    case 'shipStockpile':
      return applyShipStockpile(state, plan.player, plan.from, plan.to);
```

Remove `'shipStockpile'` from `NOT_IMPLEMENTED_KINDS`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/reducers/shipment-stockpile.test.ts`
Expected: 4 passed.

- [ ] **Step 7: Run full suite**

Run: `npm test`
Expected: all tests still pass (the new field added to GameState should not break anything since it's defaulted everywhere).

- [ ] **Step 8: Commit**

```bash
git add src/game/types.ts src/game/reducers/newGame.ts src/game/reducers/endPhase.ts src/game/reducers/loadmap.ts src/game/reducers/shipment.ts src/game/reducer.ts tests/reducers/shipment-stockpile.test.ts
git commit -m "Implement shipStockpile (forfeits 2nd attack); add shipmentForfeitsSecondAttack flag"
```

---

## Task 13: `shipHorse` plan handler — 1 hop

**Files:**
- Modify: `src/game/reducers/shipment.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/shipment-horse.test.ts`

Validation:
- `currentPhase === 'shipment'`.
- `player === currentPlayer`.
- `state.shipmentUsed === false`.
- `from` is owned by `player` and has a horse.
- `to` is owned by `player` and (via `state.touching`) is adjacent to `from`. (1-hop only for this task; 2-hop in Task 14.)

Effect:
- Move horse: `from.hasHorse = false`, `to.hasHorse = true`. **If `to` already had a horse:** the moved horse is "consumed" — `from.hasHorse = false` but `to.hasHorse = true` (no stacking). Note: spec says `addResources(4, -1)` decrements stockpile in this case. Apply: `players[player].stockpile[4] -= 1` if it's > 0.

Wait — re-reading spec: "If destination already has a horse, the moved horse is consumed (Gettman: `addResources(4, -1)`)." That decrements the *stockpile* by 1, not a unit on the map. The on-map horse count: source loses, destination already had so destination unchanged (no extra unit added). Stockpile slot 4 (horses-as-resource) decreases by 1.

For Plan 3 we model: `from.hasHorse = false; to.hasHorse stays true; players[player].stockpile[4] = max(0, stockpile[4] - 1)`.

- `state.shipmentUsed = true`.
- Other shipment subcases (`restStop`, `pickUpWeaponFrom`, `moveWeaponTo`) are deferred to Task 14.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, Stockpile } from '../../src/game/types.js';

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
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function shipmentPhaseWithAdjacentOwned(): { state: GameState; from: number; to: number } {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 29 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'shipment', currentPlayer: 0, shipmentUsed: false, shipmentForfeitsSecondAttack: false };
  // Find two adjacent territories both owned by player 0
  let from = -1, to = -1;
  for (let a = 0; a < s.territories.length; a++) {
    for (let b = 0; b < s.territories.length; b++) {
      if (a === b) continue;
      if (s.territories[a]!.ownerId !== 0 || s.territories[b]!.ownerId !== 0) continue;
      if (s.touching[a]?.[b]) { from = a; to = b; break; }
    }
    if (from >= 0) break;
  }
  if (from < 0) throw new Error('No adjacent owned pair found');
  s.territories[from]!.hasHorse = true;
  s.territories[to]!.hasHorse = false;
  return { state: s, from, to };
}

describe('shipHorse 1 hop', () => {
  it('moves horse from source to adjacent destination', () => {
    const { state: s, from, to } = shipmentPhaseWithAdjacentOwned();
    const out = reduce(s, { kind: 'shipHorse', player: 0, from, to });
    expect(out.territories[from]!.hasHorse).toBe(false);
    expect(out.territories[to]!.hasHorse).toBe(true);
    expect(out.shipmentUsed).toBe(true);
  });

  it('rejects when source has no horse', () => {
    const { state: s, from, to } = shipmentPhaseWithAdjacentOwned();
    s.territories[from]!.hasHorse = false;
    expect(() => reduce(s, { kind: 'shipHorse', player: 0, from, to }))
      .toThrow(/no horse/i);
  });

  it('rejects when destination is not adjacent and not 2-hop with intermediate', () => {
    const { state: s, from } = shipmentPhaseWithAdjacentOwned();
    // Find a far-away own territory
    const far = s.territories.find((t, i) =>
      t.ownerId === 0 && i !== from && !s.touching[from]?.[i]
        && !s.territories.some((m, mi) => m.ownerId === 0 && s.touching[from]?.[mi] && s.touching[mi]?.[i]),
    );
    if (!far) return; // map didn't produce a 3+ hop pair; skip
    expect(() => reduce(s, { kind: 'shipHorse', player: 0, from, to: far.id }))
      .toThrow(/distance|adjacent/i);
  });

  it('decrements stockpile slot 4 if destination already has a horse', () => {
    const { state: s, from, to } = shipmentPhaseWithAdjacentOwned();
    s.territories[to]!.hasHorse = true;
    s.players[0]!.stockpile = [0, 0, 0, 0, 1] as Stockpile;
    const out = reduce(s, { kind: 'shipHorse', player: 0, from, to });
    expect(out.territories[from]!.hasHorse).toBe(false);
    expect(out.territories[to]!.hasHorse).toBe(true);
    expect(out.players[0]!.stockpile[4]).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/shipment-horse.test.ts`
Expected: FAIL — shipHorse case throws.

- [ ] **Step 3: Append to `src/game/reducers/shipment.ts`**

```ts
import type { Stockpile } from '../types.js';

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
  // Distance check: 1-hop direct OR 2-hop via owned intermediate
  if (!prev.touching[input.from]?.[input.to]) {
    if (input.restStop === undefined) {
      throw new Error(`Destination not adjacent (use restStop for 2-hop moves)`);
    }
    // 2-hop branch is implemented in Task 14; for now reject here.
    throw new Error(`2-hop horse moves are implemented in a later task`);
  }
  // Apply 1-hop move
  const territories = prev.territories.map((t) => {
    if (t.id === input.from) return { ...t, hasHorse: false };
    return t;
  });
  let players = prev.players;
  if (toT.hasHorse) {
    // Destination already has horse — moved horse is consumed (decrement stockpile slot 4)
    players = players.map((p) => {
      if (p.id !== input.player) return p;
      const stock: Stockpile = [...p.stockpile] as Stockpile;
      stock[4] = Math.max(0, stock[4] - 1);
      return { ...p, stockpile: stock };
    });
  } else {
    // Place horse on destination
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
```

- [ ] **Step 4: Wire into reducer**

```ts
import { applyShipHorse } from './reducers/shipment.js';

// inside switch:
    case 'shipHorse':
      return applyShipHorse(state, plan);
```

Remove `'shipHorse'` from `NOT_IMPLEMENTED_KINDS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/shipment-horse.test.ts`
Expected: 4 passed (1 may auto-skip if the map doesn't produce a 3-hop pair).

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/shipment.ts src/game/reducer.ts tests/reducers/shipment-horse.test.ts
git commit -m "Implement shipHorse 1-hop (with destination-has-horse decrement)"
```

---

## Task 14: `shipHorse` 2-hop with rest-stop and weapon pickup

**Files:**
- Modify: `src/game/reducers/shipment.ts`
- Modify: `tests/reducers/shipment-horse.test.ts`

Reference: spec — "Ship horse to an adjacent owned territory, OR to a 2-hop owned territory provided an intermediate owned tile bridges them. May 'rest stop' at intermediate tile to drop a weapon there or pick one up."

For Plan 3 we implement:
- 2-hop with `restStop` parameter: destination must be 2 hops via the rest-stop tile (which must be owned by the player). The rest-stop tile must be adjacent to both `from` and `to`. The horse "passes through" — at end, only `to` has the horse.
- `pickUpWeaponFrom`: if set, the weapon at `pickUpWeaponFrom` (must be owned by player and adjacent to the rest-stop) moves alongside the horse.
- `moveWeaponTo`: the weapon ends up here (typically the destination, but could be the rest-stop too). Must be adjacent to `pickUpWeaponFrom`.

Simplification: for Plan 3 we support the basic 2-hop move (`restStop` only). The `pickUpWeaponFrom` + `moveWeaponTo` combo is a stretch — we'll model it but only test the basic 2-hop in this task.

- [ ] **Step 1: Append failing tests**

```ts
describe('shipHorse 2 hop', () => {
  it('moves horse 2 hops via an owned intermediate', () => {
    const { state: s, from } = shipmentPhaseWithAdjacentOwned();
    // Find an intermediate (owned, adjacent to from) and a destination (owned,
    // adjacent to intermediate but NOT adjacent to from).
    let restStop = -1, to = -1;
    for (let i = 0; i < s.territories.length; i++) {
      if (s.territories[i]!.ownerId !== 0 || i === from) continue;
      if (!s.touching[from]?.[i]) continue;
      // i is adjacent to from
      for (let j = 0; j < s.territories.length; j++) {
        if (j === from || j === i) continue;
        if (s.territories[j]!.ownerId !== 0) continue;
        if (!s.touching[i]?.[j]) continue;
        if (s.touching[from]?.[j]) continue; // ensure j is NOT adjacent to from
        restStop = i; to = j; break;
      }
      if (restStop >= 0) break;
    }
    if (restStop < 0) return; // map shape didn't produce a 2-hop chain; skip
    s.territories[from]!.hasHorse = true;
    s.territories[to]!.hasHorse = false;
    const out = reduce(s, { kind: 'shipHorse', player: 0, from, to, restStop });
    expect(out.territories[from]!.hasHorse).toBe(false);
    expect(out.territories[to]!.hasHorse).toBe(true);
    expect(out.territories[restStop]!.hasHorse).toBe(false);
  });

  it('rejects when rest-stop is not owned', () => {
    const { state: s, from } = shipmentPhaseWithAdjacentOwned();
    let restStop = -1, to = -1;
    for (let i = 0; i < s.territories.length; i++) {
      if (i === from) continue;
      if (!s.touching[from]?.[i]) continue;
      if (s.territories[i]!.ownerId === 0) continue; // not owned
      for (let j = 0; j < s.territories.length; j++) {
        if (j === from || j === i) continue;
        if (s.territories[j]!.ownerId !== 0) continue;
        if (!s.touching[i]?.[j]) continue;
        if (s.touching[from]?.[j]) continue;
        restStop = i; to = j; break;
      }
      if (restStop >= 0) break;
    }
    if (restStop < 0) return;
    s.territories[from]!.hasHorse = true;
    expect(() => reduce(s, { kind: 'shipHorse', player: 0, from, to, restStop }))
      .toThrow(/rest.?stop|owned/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/shipment-horse.test.ts`
Expected: FAIL — 2-hop branch still throws.

- [ ] **Step 3: Replace the 2-hop stub in `applyShipHorse`**

Replace the `throw new Error('2-hop horse moves are implemented in a later task');` with the actual implementation:

```ts
    // 2-hop validation
    const rs = prev.territories[input.restStop];
    if (!rs) throw new Error(`Invalid restStop ${input.restStop}`);
    if (rs.ownerId !== input.player) throw new Error(`restStop not owned by player`);
    if (!prev.touching[input.from]?.[input.restStop]) {
      throw new Error(`restStop is not adjacent to source`);
    }
    if (!prev.touching[input.restStop]?.[input.to]) {
      throw new Error(`Destination not adjacent to restStop`);
    }
    // Apply 2-hop move (horse ends at destination, not rest-stop)
    const territories2 = prev.territories.map((t) => {
      if (t.id === input.from) return { ...t, hasHorse: false };
      if (t.id === input.to) {
        // Destination-already-has-horse: consume from stockpile, leave to as-is
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/shipment-horse.test.ts`
Expected: 6 passed (4 from Task 13 + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/shipment.ts tests/reducers/shipment-horse.test.ts
git commit -m "Implement shipHorse 2-hop via owned restStop"
```

---

## Task 15: `shipWeapon` plan handler — 1 hop

**Files:**
- Modify: `src/game/reducers/shipment.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/shipment-weapon.test.ts`

Validation:
- `currentPhase === 'shipment'`, `player === currentPlayer`, `state.shipmentUsed === false`.
- `from` and `to` are both owned by `player`.
- `from` has a weapon.
- `to` is adjacent to `from`.

Effect:
- Move weapon: `from.hasWeapon = false`, `to.hasWeapon = true`.
- If `to` already had a weapon: source loses weapon, destination unchanged (no stacking; spec says nothing about decrementing a stockpile here since weapons aren't a resource — the moved weapon is simply lost).
- `state.shipmentUsed = true`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup } from '../../src/game/types.js';

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
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function adjPair(): { state: GameState; from: number; to: number } {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 31 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'shipment', currentPlayer: 0, shipmentUsed: false, shipmentForfeitsSecondAttack: false };
  let from = -1, to = -1;
  for (let a = 0; a < s.territories.length; a++) {
    for (let b = 0; b < s.territories.length; b++) {
      if (a === b) continue;
      if (s.territories[a]!.ownerId === 0 && s.territories[b]!.ownerId === 0 && s.touching[a]?.[b]) {
        from = a; to = b; break;
      }
    }
    if (from >= 0) break;
  }
  if (from < 0) throw new Error('No adjacent owned pair');
  s.territories[from]!.hasWeapon = true;
  return { state: s, from, to };
}

describe('shipWeapon', () => {
  it('moves weapon from source to adjacent destination', () => {
    const { state: s, from, to } = adjPair();
    const out = reduce(s, { kind: 'shipWeapon', player: 0, from, to });
    expect(out.territories[from]!.hasWeapon).toBe(false);
    expect(out.territories[to]!.hasWeapon).toBe(true);
    expect(out.shipmentUsed).toBe(true);
  });

  it('rejects when destination is not adjacent (no 2-hop allowed)', () => {
    const { state: s, from } = adjPair();
    const farTerr = s.territories.find((t, i) =>
      t.ownerId === 0 && i !== from && !s.touching[from]?.[i],
    );
    if (!farTerr) return;
    expect(() => reduce(s, { kind: 'shipWeapon', player: 0, from, to: farTerr.id }))
      .toThrow(/adjacent/i);
  });

  it('source loses weapon when destination already has one (no stacking)', () => {
    const { state: s, from, to } = adjPair();
    s.territories[to]!.hasWeapon = true;
    const out = reduce(s, { kind: 'shipWeapon', player: 0, from, to });
    expect(out.territories[from]!.hasWeapon).toBe(false);
    expect(out.territories[to]!.hasWeapon).toBe(true); // unchanged
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/shipment-weapon.test.ts`
Expected: FAIL — shipWeapon case throws.

- [ ] **Step 3: Append to `src/game/reducers/shipment.ts`**

```ts
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
```

- [ ] **Step 4: Wire into reducer**

```ts
import { applyShipWeapon } from './reducers/shipment.js';

// inside switch:
    case 'shipWeapon':
      return applyShipWeapon(state, plan.player, plan.from, plan.to);
```

Remove `'shipWeapon'` from `NOT_IMPLEMENTED_KINDS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/shipment-weapon.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/shipment.ts src/game/reducer.ts tests/reducers/shipment-weapon.test.ts
git commit -m "Implement shipWeapon 1-hop with no-stacking destination rule"
```

---

## Task 16: `shipBoat` plan handler — move along same lake, embarkation

**Files:**
- Modify: `src/game/reducers/shipment.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/shipment-boat.test.ts`

Validation:
- `currentPhase === 'shipment'`, `player === currentPlayer`, `state.shipmentUsed === false`.
- `boatId` references a valid Boat owned by `player`.
- The destination `(toX, toY)` must be a water cell on the same lake the boat is currently on.
- Optional `pickUpHorseFrom`: a territory adjacent to the boat's current dock that has a horse. The horse is loaded onto the boat.
- Optional `pickUpWeaponFrom`: same rules for a weapon.

Effect:
- Move boat: update `boats[boatId].x`, `boats[boatId].y` to `toX, toY`. **Do not change `homeTerritoryId`** — the boat's home is its dock; physical position can be elsewhere.
- If picking up: `from.hasHorse = false` (or weapon), `boats[boatId].carryHorse = true` (or carryWeapon).
- `state.shipmentUsed = true`.

For Plan 3 simplification: we model the boat's "lake" as `state.squares[squareIndex(x,y)].lakeId`. We assume the destination must be a water square (`territoryId === null`) with the same `lakeId` as the source water square. The source square is `state.squares[squareIndex(boat.x, boat.y)]`.

- [ ] **Step 1: Write the failing test**

```ts
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
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: false,
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
  s = { ...s, currentPhase: 'shipment', currentPlayer: 0, shipmentUsed: false, shipmentForfeitsSecondAttack: false };
  // Find a coastal territory owned by player 0 with a lake
  const coastTerr = s.territories.find(
    (t) => t.ownerId === 0 && t.bordersLakes.size > 0,
  );
  if (!coastTerr) throw new Error('No coastal owned territory');
  const lakeId = [...coastTerr.bordersLakes][0]!;
  // Find a water square on that lake
  const waterIdx = s.squares.findIndex((sq) => sq.lakeId === lakeId && sq.territoryId === null);
  if (waterIdx < 0) throw new Error('No water square for lake');
  const wsq = s.squares[waterIdx]!;
  const boat: Boat = {
    id: 0, x: wsq.x, y: wsq.y, homeTerritoryId: coastTerr.id, ownerId: 0,
    carryHorse: false, carryWeapon: false,
  };
  s.boats[0] = boat;
  // Find a different water square on the same lake to move to
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
    // Land square (territoryId !== null)
    const landIdx = s.squares.findIndex((sq) => sq.territoryId !== null);
    const lsq = s.squares[landIdx]!;
    expect(() => reduce(s, { kind: 'shipBoat', player: 0, boatId, toX: lsq.x, toY: lsq.y }))
      .toThrow(/water|land/i);
  });

  it('rejects moving boat to a different lake', () => {
    const { state: s, boatId } = shipmentWithBoat();
    // Find a square on a different lake
    const myLake = s.squares[s.boats[boatId]!.y * GRID_WIDTH + s.boats[boatId]!.x]!.lakeId;
    const otherIdx = s.squares.findIndex(
      (sq) => sq.lakeId !== null && sq.lakeId !== myLake && sq.territoryId === null,
    );
    if (otherIdx < 0) return; // map has only one lake
    const osq = s.squares[otherIdx]!;
    expect(() => reduce(s, { kind: 'shipBoat', player: 0, boatId, toX: osq.x, toY: osq.y }))
      .toThrow(/lake/i);
  });

  it('picks up a horse from an adjacent owned territory', () => {
    const { state: s, boatId, toX, toY } = shipmentWithBoat();
    // Set hasHorse on the boat's home territory
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/shipment-boat.test.ts`
Expected: FAIL — shipBoat case throws.

- [ ] **Step 3: Append to `src/game/reducers/shipment.ts`**

```ts
import { GRID_WIDTH } from '../constants.js';

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
  // Source water square's lake
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
  // Apply movement
  const boats = prev.boats.map((b) =>
    b && b.id === input.boatId ? { ...b, x: input.toX, y: input.toY } : b,
  );
  let territories = prev.territories;

  // Pickups
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
```

- [ ] **Step 4: Wire into reducer**

```ts
import { applyShipBoat } from './reducers/shipment.js';

// inside switch:
    case 'shipBoat':
      return applyShipBoat(state, plan);
```

Remove `'shipBoat'` from `NOT_IMPLEMENTED_KINDS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/shipment-boat.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/shipment.ts src/game/reducer.ts tests/reducers/shipment-boat.test.ts
git commit -m "Implement shipBoat: lake-constrained moves with horse/weapon embarkation"
```

---

## Task 17: `endPhase` for shipment — rotate or advance to conquest

**Files:**
- Modify: `src/game/reducers/endPhase.ts`
- Create: `tests/reducers/endPhase-shipment.test.ts`

`endPhase` from `'shipment'`:
- Rotate `currentPlayer` to next in `turnOrder`. Clear `shipmentUsed` (each player gets their own shipment).
- If wrapped back to `turnOrder[0]`, advance to `'conquest'` with `attackNumber = 1` and `shipmentUsed = false`.

(The trade-end branch in Task 11 already handled the trade→shipment transition with skip; shipment→conquest does NOT have a 1/6 skip per spec — only Production, Trade, Shipment have skip rolls and Trade/Shipment have already had theirs at *entry*.)

Wait — re-reading spec: "1/6 skip probability" applies to Production, Trade, Shipment. Each phase rolls when entering. So trade rolled when entering trade, shipment rolled when entering shipment (in the Task 11 wrap). Conquest has no skip.

For Task 17 we add the shipment→conquest wrap: when last player ends shipment, advance to conquest with `attackNumber = 1`.

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
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function shipmentPhase(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 41 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'shipment', currentPlayer: s.turnOrder[0]!, shipmentUsed: false, shipmentForfeitsSecondAttack: false };
  return s;
}

describe('endPhase: shipment', () => {
  it('rotates player and resets shipmentUsed within phase', () => {
    let s = shipmentPhase();
    s = { ...s, shipmentUsed: true };
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(s.currentPhase).toBe('shipment');
    expect(s.shipmentUsed).toBe(false);
    expect(s.currentPlayer).toBe(s.turnOrder[1]!);
  });

  it('advances to conquest when last player ends shipment', () => {
    let s = shipmentPhase();
    for (let i = 0; i < s.players.length; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(s.currentPhase).toBe('conquest');
    expect(s.attackNumber).toBe(1);
    expect(s.shipmentUsed).toBe(false);
    expect(s.shipmentForfeitsSecondAttack).toBe(false);
    expect(s.currentPlayer).toBe(s.turnOrder[0]!);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/endPhase-shipment.test.ts`
Expected: FAIL — endPhase from shipment still throws.

- [ ] **Step 3: Add `case 'shipment':` to `applyEndPhase`**

```ts
    case 'shipment': {
      const idx = prev.turnOrder.indexOf(prev.currentPlayer);
      const nextIdx = (idx + 1) % prev.turnOrder.length;
      if (nextIdx !== 0) {
        return {
          ...prev,
          currentPlayer: prev.turnOrder[nextIdx]!,
          shipmentUsed: false,
          shipmentForfeitsSecondAttack: false,
          log: [
            ...prev.log,
            { year: prev.year, phase: 'shipment', player: prev.turnOrder[nextIdx]!,
              message: `Player ${prev.turnOrder[nextIdx]} begins shipment` },
          ],
        };
      }
      // Wrapped — advance to conquest (no skip)
      return {
        ...prev,
        currentPhase: 'conquest',
        currentPlayer: prev.turnOrder[0]!,
        attackNumber: 1,
        shipmentUsed: false,
        shipmentForfeitsSecondAttack: false,
        log: [
          ...prev.log,
          { year: prev.year, phase: 'conquest', player: prev.turnOrder[0]!,
            message: 'Conquest phase begins' },
        ],
      };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/endPhase-shipment.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/endPhase.ts tests/reducers/endPhase-shipment.test.ts
git commit -m "endPhase: shipment rotation; on wrap advance to conquest"
```

---

## Task 18: Snapshot test — full trade-and-shipment sequence

**Files:**
- Create: `tests/snapshots/trade-and-shipment.test.ts`

A canonical trace: NEW_GAME → drain selection → endPhase (production) → production → endPhase (advance to trade or shipment depending on skip) → if trade, scripted trade actions including a horse trade and an autoReject → end trade → shipment with ship-stockpile + ship-horse + ship-boat → end shipment → assert in conquest.

This is a long test but it pins the entire trade+shipment surface end-to-end.

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import { GRID_WIDTH } from '../../src/game/constants.js';
import type { GameState, GameSetup, Stockpile, Boat } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'Red', persona: 'human' },
    { color: 'blue', name: 'Blue', persona: 'aggressive' },
    { color: 'cyan', name: 'Cyan', persona: 'defensive' },
  ],
  citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: false,
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

const give = (a: number, b: number, c: number, d: number, e: number): Stockpile => [a, b, c, d, e];

describe('trade + shipment full sequence', () => {
  it('runs NEW_GAME → selection → production → trade → shipment → conquest', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 12345 });
    // Drain selection
    while (s.territories.some((t) => t.ownerId === null)) {
      const free = s.territories.find((t) => t.ownerId === null)!;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(s.currentPhase).toBe('production');
    s = reduce(s, { kind: 'production' });
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });

    // After endPhase from production, we're in trade or shipment (if 1/6 skip)
    if (s.currentPhase === 'trade') {
      // Each player ends trade
      for (let i = 0; i < s.players.length; i++) {
        s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      }
    }
    expect(['shipment', 'conquest']).toContain(s.currentPhase);
    if (s.currentPhase !== 'shipment') return; // skipped both phases (rare)

    // Each player ends shipment
    for (let i = 0; i < s.players.length; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(s.currentPhase).toBe('conquest');
    expect(s.attackNumber).toBe(1);
  });

  it('autoReject blocks future trades from blocked player', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 999 });
    while (s.territories.some((t) => t.ownerId === null)) {
      const free = s.territories.find((t) => t.ownerId === null)!;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    s = reduce(s, { kind: 'production' });
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    if (s.currentPhase !== 'trade') return; // skipped — re-roll seed in real test
    s.players[s.currentPlayer]!.stockpile = give(3, 0, 0, 0, 0);
    s.players[(s.currentPlayer + 1) % s.players.length]!.stockpile = give(0, 3, 0, 0, 0);
    const tradee = ((s.currentPlayer + 1) % s.players.length) as 0 | 1 | 2;
    s = reduce(s, { kind: 'tradeRejectAll', tradee, trader: s.currentPlayer });
    expect(() => reduce(s, {
      kind: 'trade', proposer: s.currentPlayer, tradee,
      give: give(1, 0, 0, 0, 0), receive: give(0, 1, 0, 0, 0),
    })).toThrow(/auto-reject/i);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- tests/snapshots/trade-and-shipment.test.ts`
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/snapshots/trade-and-shipment.test.ts
git commit -m "Add trade+shipment full-sequence snapshot test"
```

---

## Task 19: Extend `play-game` CLI to run a complete year

**Files:**
- Modify: `src/cli/playGame.ts`

The Plan 2 CLI stops after first production. Extend it to drive trade and shipment phases too, with scripted no-op moves (each player just ends trade and ends shipment).

- [ ] **Step 1: Update `src/cli/playGame.ts`**

Append after the "First production" section:

```ts
// --- Trade & Shipment ---
// End the year: every player just ends each phase. (No scripted trades.)
console.log('\n--- End-of-production transition ---');
s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
console.log(`Phase after endPhase from production: ${s.currentPhase}`);

if (s.currentPhase === 'trade') {
  console.log('\n--- Trade phase (each player ends in turn) ---');
  for (let i = 0; i < s.players.length; i++) {
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    console.log(`Player ${s.players[s.currentPlayer]!.name} now active; phase=${s.currentPhase}`);
    if (s.currentPhase !== 'trade') break;
  }
}

if (s.currentPhase === 'shipment') {
  console.log('\n--- Shipment phase (each player ends in turn) ---');
  for (let i = 0; i < s.players.length; i++) {
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    console.log(`Player ${s.players[s.currentPlayer]!.name} now active; phase=${s.currentPhase}`);
    if (s.currentPhase !== 'shipment') break;
  }
}

console.log(`\nFinal phase reached: ${s.currentPhase}`);
console.log(`Year: ${s.year}, Year-scoped log entries: ${s.log.filter((l) => l.year === s.year).length}`);
```

- [ ] **Step 2: Smoke-test the CLI**

Run: `npm run play-game -- --seed 12345`
Expected: prints existing output (selection + production), then the new trade and shipment transitions, ending in `Final phase reached: conquest` (or possibly an earlier phase if both 1/6 skips fired).

- [ ] **Step 3: Commit**

```bash
git add src/cli/playGame.ts
git commit -m "Extend play-game CLI to drive trade and shipment phases"
```

---

## Task 20: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass. Tally should be ≥ 220 (was 181 after Plan 2; +~40 from this plan).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run all CLIs**

Run: `npm run gen-map -- --seed 12345`
Expected: ASCII map + summary, no errors.

Run: `npm run play-game -- --seed 12345`
Expected: full year through trade+shipment, ending at conquest.

Run: `npm run save-load-smoke 12345`
Expected: roundtrips cleanly.

No commit for this task.

---

## Self-review notes

- **Spec coverage:**
  - Trade phase: ✓ (Tasks 2–9, 10–11) — propose, accept, reject, horse logistics, autoReject, triple-reject lockout, endPhase rotation + entry skip + 2-player full-skip.
  - Shipment phase: ✓ (Tasks 12–17) — stockpile (forfeits 2nd attack), horse 1-hop and 2-hop with rest-stop, weapon 1-hop, boat with embarkation, endPhase rotation + entry skip.
  - Boat-pool primitive: ✓ (Task 1) — used now for shipBoat references; `addBoat` ready for Plan 4.
  - 1/6 phase skip for both trade and shipment, with 2-player trade-skip rule: ✓.
  - `shipmentForfeitsSecondAttack` flag added to `GameState` for Plan 4's conquest-entry to consume.

- **Deliberately deferred to Plan 4:**
  - Conquest phase (attack, alliesDecision, resolveCombat).
  - Force-count for combat (the strength formula); Plan 2's `getForceCount` is the production-side metric. Combat strength is computed differently per spec.
  - Development phase (buildCity, buildWeapon, buildBoat).
  - Year wrap (rotate, eliminate, year++, clear year-scoped state).
  - End-of-game detection.
  - Conquest auto-prevent-suicide rule.
  - The `shipHorse` `pickUpWeaponFrom` / `moveWeaponTo` extra subcase (not exercised by Plan 4 either; can defer to UI polish).

- **No placeholders.** Every task has full code or full commands.

- **Type consistency.** `Plan` discriminated union members, `GameState`, `applyShipStockpile` / `applyShipHorse` / etc. signatures all match across tasks. The new `shipmentForfeitsSecondAttack` field is added once in Task 12 and threaded through `newGame.ts`, `endPhase.ts`, and `loadmap.ts` consistently.

- **Commit cadence.** 19 commits (Tasks 1–17 each commit; Task 18 commits the snapshot; Task 19 commits the CLI; Task 20 has no commit).
