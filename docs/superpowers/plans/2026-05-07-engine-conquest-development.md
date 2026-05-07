# Conquest, Development & Year-Wrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the engine — implement Conquest (attack/allies/resolve), Development (buildCity/buildWeapon/buildBoat), and the year-wrap (eliminate, rotate, year++, end-of-game). After this plan, a complete game can be played end-to-end via the engine API; only the AI brain (Plan 5) and UI (Plan 6) remain.

**Architecture:** Same pure-reducer pattern as Plans 1–3. New handlers fill in the `'attack' | 'alliesDecision' | 'resolveCombat' | 'buildCity' | 'buildWeapon' | 'buildBoat'` cases that currently throw `"not implemented in plan 2"`, plus `endPhase` branches for `'conquest'`, `'development'`, and a final transition that triggers year-wrap or game-over. Combat strength uses Plan 1's `LocProb` for Element-of-Chance High; deterministic and tie-coin variants are inlined. The Plan 3 per-player `shipmentForfeitsSecondAttack[]` array is consumed at conquest entry to limit the player to 1 attack instead of 2.

**Tech Stack:** No new dependencies. TypeScript strict, Vitest, `tsx`.

**Reference:** Decompiled Java at `.reference/decompiled/` (gitignored). Spec: `docs/superpowers/specs/2026-05-06-clean-room-port-design.md`.

---

## File Structure (locked in for Plan 4)

```
src/game/
├── combat.ts                           # NEW — strength derivation, ally listing, suicide check
├── checkEndOfGame.ts                   # NEW — citiesToWin + all-territories victory detection
├── reducers/
│   ├── conquest.ts                     # NEW — attack, alliesDecision, resolveCombat
│   ├── development.ts                  # NEW — buildCity, buildWeapon, buildBoat
│   ├── yearWrap.ts                     # NEW — applyYearWrap helper (eliminate, rotate, year++)
│   ├── endPhase.ts                     # MODIFY — add conquest, development, yearwrap branches
│   └── ...
├── reducer.ts                          # MODIFY — wire 6 new plan kinds
└── ...
tests/
├── combat.test.ts
├── checkEndOfGame.test.ts
├── reducers/
│   ├── conquest-attack.test.ts
│   ├── conquest-allies.test.ts
│   ├── conquest-resolve-low.test.ts
│   ├── conquest-resolve-medium.test.ts
│   ├── conquest-resolve-high.test.ts
│   ├── conquest-postattack.test.ts
│   ├── conquest-loss.test.ts
│   ├── conquest-end.test.ts
│   ├── development-city.test.ts
│   ├── development-weapon.test.ts
│   ├── development-boat.test.ts
│   ├── development-end.test.ts
│   ├── yearwrap.test.ts
│   └── endgame.test.ts
└── snapshots/
    └── full-year.test.ts
```

---

## Task 1: `getCombatStrength` — derive attacker / defender base strengths

**Files:**
- Create: `src/game/combat.ts`
- Create: `tests/combat.test.ts`

Reference: spec §"Combat (exact)" + LocApplet L1843–L1864. Combat strengths come from `getForceCount(target)`'s per-player slots:
- `defenderStrength` += `forceCount[defenderId]`
- `attackerStrength` += `forceCount[attackerId]`
- For each *third-party* player `p` (not attacker, not defender) whose decision is `'attacker'`: `attackerStrength += forceCount[p]`
- For each third-party `p` whose decision is `'defender'`: `defenderStrength += forceCount[p]`
- Neutral / unowned-natives contribute to neither

Bring-forces additions are layered on top in Task 4 (handled inside `applyAttack`); this helper computes ONLY the base allies-resolved strengths from a populated `pendingCombat`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { getCombatStrength } from '../src/game/combat.js';
import type { GameState, CombatState, Territory } from '../src/game/types.js';

function stateWithForce(perPlayerForces: Record<number, number>): GameState {
  // Build a minimal state where target territory's getForceCount returns
  // exactly the supplied per-player slot counts. We do this by giving each
  // player one adjacent territory with horse/weapon/city tuned to match.
  // For tests we shortcut by stubbing getForceCount via direct territory data.
  const territories: Territory[] = [
    { id: 0, ownerId: 1, resource: null, hasCity: false, hasWeapon: false,
      hasHorse: false, hasStockpile: false, hasResourceDouble: false,
      squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0 },
  ];
  // Adjacent territories, one per player with force > 0
  let nextId = 1;
  const touching: boolean[][] = [[false]];
  for (const [pStr, force] of Object.entries(perPlayerForces)) {
    const p = Number(pStr);
    // Adjust contribution: 1 base + horse(+1) + city(+2) + weapon(+3)
    // We just tune flags to hit `force` exactly for force in 1..7.
    const t: Territory = {
      id: nextId, ownerId: p as 0 | 1 | 2 | 3 | 4 | 5 | 6, resource: null,
      hasCity: force >= 3, hasWeapon: force >= 4, hasHorse: force === 2 || force === 5 || force === 6 || force === 7,
      hasStockpile: false, hasResourceDouble: false,
      squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
    };
    territories.push(t);
    // Pad touching matrix
    for (const row of touching) row.push(false);
    touching.push(new Array<boolean>(touching[0]!.length).fill(false));
    touching[0]![nextId] = true;
    touching[nextId]![0] = true;
    nextId++;
  }
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: [
        { color: 'red', name: 'r', persona: 'human' },
        { color: 'blue', name: 'b', persona: 'human' },
        { color: 'cyan', name: 'c', persona: 'human' },
      ],
      citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories, touching, distance: [],
    boats: [], players: [
      { id: 0, name: 'r', color: 'red', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
      { id: 1, name: 'b', color: 'blue', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
      { id: 2, name: 'c', color: 'cyan', persona: 'human', status: 'playing', stockpile: [0, 0, 0, 0, 0], stockpileLocation: null },
    ],
    turnOrder: [0, 1, 2], currentPhase: 'conquest', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  };
}

const baseCombat = (overrides: Partial<CombatState>): CombatState => ({
  attackerId: 0, defenderId: 1,
  fromTerritoryId: 0, targetTerritoryId: 0,
  boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
  alliesDecisions: [], alliesPending: new Set<number>(),
  attackerStrength: 0, defenderStrength: 0, resolved: false, attackerWon: false,
  ...overrides,
});

describe('getCombatStrength', () => {
  it('attacker and defender base from getForceCount', () => {
    // P0=attacker (force 1, just base), P1=defender (force 1)
    const s = stateWithForce({ 0: 1, 1: 1 });
    const c = baseCombat({ attackerId: 0, defenderId: 1, targetTerritoryId: 0 });
    const r = getCombatStrength(s, c);
    expect(r.attackerStrength).toBe(1);
    expect(r.defenderStrength).toBe(1);
  });

  it('third-party ally-with-attacker adds to attacker', () => {
    const s = stateWithForce({ 0: 1, 1: 1, 2: 4 });
    const c = baseCombat({
      attackerId: 0, defenderId: 1, targetTerritoryId: 0,
      alliesDecisions: ['neutral', 'neutral', 'attacker'],
    });
    const r = getCombatStrength(s, c);
    expect(r.attackerStrength).toBe(5); // 1 base + 4 from p2
    expect(r.defenderStrength).toBe(1);
  });

  it('third-party ally-with-defender adds to defender', () => {
    const s = stateWithForce({ 0: 1, 1: 1, 2: 3 });
    const c = baseCombat({
      attackerId: 0, defenderId: 1, targetTerritoryId: 0,
      alliesDecisions: ['neutral', 'neutral', 'defender'],
    });
    const r = getCombatStrength(s, c);
    expect(r.attackerStrength).toBe(1);
    expect(r.defenderStrength).toBe(4); // 1 + 3
  });

  it('third-party neutral contributes to neither', () => {
    const s = stateWithForce({ 0: 1, 1: 1, 2: 3 });
    const c = baseCombat({
      attackerId: 0, defenderId: 1, targetTerritoryId: 0,
      alliesDecisions: ['neutral', 'neutral', 'neutral'],
    });
    const r = getCombatStrength(s, c);
    expect(r.attackerStrength).toBe(1);
    expect(r.defenderStrength).toBe(1);
  });

  it('attacker/defender entries in alliesDecisions are ignored', () => {
    const s = stateWithForce({ 0: 1, 1: 1 });
    const c = baseCombat({
      attackerId: 0, defenderId: 1, targetTerritoryId: 0,
      alliesDecisions: ['defender', 'attacker'], // self-ally entries
    });
    const r = getCombatStrength(s, c);
    // attacker self-decision and defender self-decision are ignored
    expect(r.attackerStrength).toBe(1);
    expect(r.defenderStrength).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/combat.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/combat.ts`**

```ts
import type { GameState, CombatState, PlayerId } from './types.js';
import { getForceCount } from './force.js';

export type CombatStrength = { attackerStrength: number; defenderStrength: number };

// Mirrors LocApplet L1843-L1864. Aggregates the per-player slots from
// getForceCount(target) into attackerStrength and defenderStrength using
// the allies decisions in pendingCombat. The attacker and defender slots
// always count for their own side; third-party players contribute per
// their alliesDecisions[i] choice.
export function getCombatStrength(state: GameState, c: CombatState): CombatStrength {
  const fc = getForceCount(state, c.targetTerritoryId);
  let attackerStrength = fc.perPlayer[c.attackerId] ?? 0;
  let defenderStrength = c.defenderId !== null ? (fc.perPlayer[c.defenderId] ?? 0) : 0;
  for (let p = 0; p < state.players.length; p++) {
    if (p === c.attackerId) continue;
    if (c.defenderId !== null && p === c.defenderId) continue;
    const decision = c.alliesDecisions[p];
    const force = fc.perPlayer[p] ?? 0;
    if (decision === 'attacker') attackerStrength += force;
    else if (decision === 'defender') defenderStrength += force;
    // 'neutral' or undefined: no contribution
  }
  return { attackerStrength, defenderStrength };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/combat.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/combat.ts tests/combat.test.ts
git commit -m "Add getCombatStrength: derive attacker/defender strengths with allies"
```

---

## Task 2: `listAllyCandidates` — players who must respond before combat resolves

**Files:**
- Modify: `src/game/combat.ts`
- Create: `tests/combat-allies.test.ts`

Reference: spec §"Conquest phase" + LocApplet L1838–L1864. An ally candidate is any player who is **not** the attacker, **not** the defender, **playing**, and has a force-count > 0 on the target tile (i.e. they have an adjacent or central-tile owned tile contributing to `getForceCount`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { listAllyCandidates } from '../src/game/combat.js';
import type { GameState, Territory } from '../src/game/types.js';

function makeState(
  players: number,
  ownersByTerritory: Array<number | null>,
): GameState {
  const territories: Territory[] = ownersByTerritory.map((own, id) => ({
    id, ownerId: own as 0 | 1 | 2 | 3 | 4 | 5 | 6 | null,
    resource: null, hasCity: false, hasWeapon: false, hasHorse: false,
    hasStockpile: false, hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
  }));
  // All-touching for simplicity (every territory adjacent to every other)
  const n = territories.length;
  const touching: boolean[][] = Array.from(
    { length: n }, (_, i) => Array.from({ length: n }, (_, j) => i !== j));
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: Array.from({ length: players }, (_, i) => ({
        color: (['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const)[i]!,
        name: `p${i}`, persona: 'human',
      })),
      citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: n,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories, touching, distance: [],
    boats: [], players: Array.from({ length: players }, (_, i) => ({
      id: i as 0 | 1 | 2 | 3 | 4 | 5 | 6, name: `p${i}`,
      color: (['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const)[i]!,
      persona: 'human', status: 'playing',
      stockpile: [0, 0, 0, 0, 0], stockpileLocation: null,
    })),
    turnOrder: Array.from({ length: players }, (_, i) => i as 0 | 1 | 2 | 3 | 4 | 5 | 6),
    currentPhase: 'conquest', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  };
}

describe('listAllyCandidates', () => {
  it('finds third-party players with adjacent forces', () => {
    // 4 territories: target=0(p1), p2 owns 1, p3 owns 2, p0=attacker owns 3
    const s = makeState(4, [1, 2, 3, 0]);
    const allies = listAllyCandidates(s, 0, 1, 0);
    expect(allies).toEqual(new Set([2, 3]));
  });

  it('excludes attacker and defender even if they have force', () => {
    const s = makeState(3, [1, 0, 2]);
    // attacker=0 also borders target via terr 1; defender=1 is target itself
    const allies = listAllyCandidates(s, 0, 1, 0);
    expect(allies).toEqual(new Set([2]));
  });

  it('excludes eliminated players', () => {
    const s = makeState(3, [1, 0, 2]);
    s.players[2]!.status = 'eliminated';
    const allies = listAllyCandidates(s, 0, 1, 0);
    expect(allies).toEqual(new Set());
  });

  it('handles unowned target (defenderId null)', () => {
    const s = makeState(3, [null, 0, 2]);
    const allies = listAllyCandidates(s, 0, null, 0);
    expect(allies).toEqual(new Set([2]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/combat-allies.test.ts`
Expected: FAIL — `listAllyCandidates` not exported.

- [ ] **Step 3: Append to `src/game/combat.ts`**

```ts
// Mirrors the third-party loop in LocApplet L1843-L1864 — every non-attacker,
// non-defender player with any force on the target tile is an ally candidate
// and must respond before resolveCombat can run.
export function listAllyCandidates(
  state: GameState,
  attackerId: PlayerId,
  defenderId: PlayerId | null,
  targetTerritoryId: number,
): Set<PlayerId> {
  const fc = getForceCount(state, targetTerritoryId);
  const out = new Set<PlayerId>();
  for (let p = 0; p < state.players.length; p++) {
    if (p === attackerId) continue;
    if (defenderId !== null && p === defenderId) continue;
    if (state.players[p]!.status !== 'playing') continue;
    if ((fc.perPlayer[p] ?? 0) > 0) out.add(p as PlayerId);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/combat-allies.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/combat.ts tests/combat-allies.test.ts
git commit -m "Add listAllyCandidates: identify players who must decide before combat"
```

---

## Task 3: `isAutoPreventSuicide` — Element-of-Chance Low/Medium guard

**Files:**
- Modify: `src/game/combat.ts`

Reference: spec §"Conquest phase" — at Element of Chance Low or Medium, if `attackerStrength + 6 < defenderStrength`, the attack is auto-blocked. (At High, attackers can still try a low-probability attack.)

- [ ] **Step 1: Append failing tests to `tests/combat.test.ts`**

```ts
import { isAutoPreventSuicide } from '../src/game/combat.js';

describe('isAutoPreventSuicide', () => {
  it('blocks at Low when attacker + 6 < defender', () => {
    expect(isAutoPreventSuicide('low', 1, 8)).toBe(true);
    expect(isAutoPreventSuicide('low', 2, 8)).toBe(false); // 2+6=8 not < 8
  });

  it('blocks at Medium when attacker + 6 < defender', () => {
    expect(isAutoPreventSuicide('medium', 1, 8)).toBe(true);
    expect(isAutoPreventSuicide('medium', 3, 8)).toBe(false);
  });

  it('never blocks at High', () => {
    expect(isAutoPreventSuicide('high', 1, 999)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/combat.test.ts`
Expected: FAIL — `isAutoPreventSuicide` not exported.

- [ ] **Step 3: Append to `src/game/combat.ts`**

```ts
import type { ElementOfChance } from './types.js';

// Mirrors LocApplet's auto-suicide-prevent in attack-button gating. Spec:
// "at Element of Chance Low or Medium, if attackerStrength + 6 < defenderStrength,
// the Attack control is disabled with a 'LOSE!' indicator."
export function isAutoPreventSuicide(
  chance: ElementOfChance,
  attackerStrength: number,
  defenderStrength: number,
): boolean {
  if (chance === 'high') return false;
  return attackerStrength + 6 < defenderStrength;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/combat.test.ts`
Expected: 8 passed (5 strength + 3 suicide).

- [ ] **Step 5: Commit**

```bash
git add src/game/combat.ts tests/combat.test.ts
git commit -m "Add isAutoPreventSuicide guard for Element-of-Chance Low/Medium"
```

---

## Task 4: `applyAttack` — initiate combat, populate `pendingCombat`

**Files:**
- Create: `src/game/reducers/conquest.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/conquest-attack.test.ts`

Reference: spec §"Conquest phase" + LocApplet L1838–L1922.

Validation:
- `currentPhase === 'conquest'`.
- `player === currentPlayer`.
- `player`'s status is `'playing'`.
- `pendingCombat === null` (no in-flight combat).
- `fromTerritoryId` is owned by `player`.
- `targetTerritoryId !== fromTerritoryId`.
- `targetTerritoryId` is adjacent to `fromTerritoryId` (`state.touching[from][target] === true`).
- If `boatId` provided: boat exists, owned by player, docked at a territory adjacent to target on a lake the target territory borders.
- If `horseFromTerritoryId` provided: territory owned by player, has horse, within 2 hops of target via owned-tile chain.
- If `weaponFromTerritoryId` provided: territory owned by player, has weapon, within 1 hop of target.
- After auto-suicide check: if `isAutoPreventSuicide` returns true → throw.

Effect:
- Remove brought horse from source (set `hasHorse: false`).
- Remove brought weapon from source (set `hasWeapon: false`).
- Boats stay in place pre-resolution (committed to combat — they re-flag/destroy on outcome).
- Compute base strengths via `getCombatStrength` (no allies yet, so allies decisions empty).
- Add bring-forces bonuses to attacker:
  - Boat committed (and not already adjacent contribution): `+2`.
  - Horse from non-touching source: `+1`.
  - Weapon from non-touching source: `+3`.
- Identify ally candidates via `listAllyCandidates`.
- Populate `pendingCombat` with `alliesPending: Set` and `alliesDecisions: Array(numPlayers).fill('neutral')` (neutral default until decisions roll in).
- Note: `bringHorse/Weapon` from a *touching* source contributes nothing extra — those are already counted in `getForceCount`'s adjacency loop.

For Plan 4 simplification, define "horse within 2 hops via owned-tile chain" and "weapon within 1 hop" exactly as spec.

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
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function conquestPhaseAdjacentEnemies(): {
  state: GameState; from: number; target: number;
} {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 47 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  // Force into conquest phase with player 0
  s = { ...s, currentPhase: 'conquest', currentPlayer: 0,
    attackNumber: 1, pendingCombat: null };
  // Find an owned tile adjacent to an enemy tile
  let from = -1, target = -1;
  for (let a = 0; a < s.territories.length; a++) {
    if (s.territories[a]!.ownerId !== 0) continue;
    for (let b = 0; b < s.territories.length; b++) {
      if (a === b) continue;
      if (s.territories[b]!.ownerId === 0) continue;
      if (s.touching[a]?.[b]) { from = a; target = b; break; }
    }
    if (from >= 0) break;
  }
  if (from < 0) throw new Error('No adjacent enemy pair');
  return { state: s, from, target };
}

describe('applyAttack', () => {
  it('populates pendingCombat with strengths and ally candidates', () => {
    const { state: s, from, target } = conquestPhaseAdjacentEnemies();
    const out = reduce(s, {
      kind: 'attack', player: 0, fromTerritoryId: from,
      targetTerritoryId: target,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    });
    expect(out.pendingCombat).not.toBeNull();
    expect(out.pendingCombat!.attackerId).toBe(0);
    expect(out.pendingCombat!.targetTerritoryId).toBe(target);
    expect(out.pendingCombat!.attackerStrength).toBeGreaterThan(0);
    expect(out.pendingCombat!.defenderStrength).toBeGreaterThan(0);
  });

  it('rejects when phase is not conquest', () => {
    const { state: s, from, target } = conquestPhaseAdjacentEnemies();
    const wrong = { ...s, currentPhase: 'production' as const };
    expect(() => reduce(wrong, {
      kind: 'attack', player: 0, fromTerritoryId: from, targetTerritoryId: target,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    })).toThrow(/phase/i);
  });

  it('rejects when from is not owned by player', () => {
    const { state: s, target } = conquestPhaseAdjacentEnemies();
    const enemyOwned = s.territories.find((t) => t.ownerId === 1)!;
    expect(() => reduce(s, {
      kind: 'attack', player: 0, fromTerritoryId: enemyOwned.id, targetTerritoryId: target,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    })).toThrow(/not owned/i);
  });

  it('rejects when target not adjacent to from', () => {
    const { state: s, from } = conquestPhaseAdjacentEnemies();
    const far = s.territories.find((t, i) =>
      i !== from && !s.touching[from]?.[i] && t.ownerId !== 0,
    );
    if (!far) return;
    expect(() => reduce(s, {
      kind: 'attack', player: 0, fromTerritoryId: from, targetTerritoryId: far.id,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    })).toThrow(/adjacent/i);
  });

  it('rejects when pendingCombat is non-null', () => {
    const { state: s, from, target } = conquestPhaseAdjacentEnemies();
    const out = reduce(s, {
      kind: 'attack', player: 0, fromTerritoryId: from, targetTerritoryId: target,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    });
    expect(() => reduce(out, {
      kind: 'attack', player: 0, fromTerritoryId: from, targetTerritoryId: target,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    })).toThrow(/already pending|in.flight/i);
  });

  it('removes brought horse from source territory', () => {
    const { state: s, from, target } = conquestPhaseAdjacentEnemies();
    // Set a horse on a non-touching owned territory within 2 hops
    let horseSource = -1;
    for (let i = 0; i < s.territories.length; i++) {
      if (i === from || i === target) continue;
      if (s.territories[i]!.ownerId !== 0) continue;
      if (s.touching[i]?.[target]) continue; // skip already-adjacent (those count via getForceCount)
      // Check 2-hop reachable via owned chain to target
      for (let m = 0; m < s.territories.length; m++) {
        if (m === i || m === target) continue;
        if (s.territories[m]!.ownerId !== 0) continue;
        if (s.touching[i]?.[m] && s.touching[m]?.[target]) {
          horseSource = i; break;
        }
      }
      if (horseSource >= 0) break;
    }
    if (horseSource < 0) return; // shape didn't produce a 2-hop owned chain
    s.territories[horseSource]!.hasHorse = true;
    const out = reduce(s, {
      kind: 'attack', player: 0, fromTerritoryId: from, targetTerritoryId: target,
      boatId: null, horseFromTerritoryId: horseSource, weaponFromTerritoryId: null,
    });
    expect(out.territories[horseSource]!.hasHorse).toBe(false);
    expect(out.pendingCombat!.horseFromTerritoryId).toBe(horseSource);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/conquest-attack.test.ts`
Expected: FAIL — attack case throws "not implemented in plan 2".

- [ ] **Step 3: Implement `src/game/reducers/conquest.ts`**

```ts
import type { GameState, PlayerId, Territory } from '../types.js';
import { getCombatStrength, listAllyCandidates, isAutoPreventSuicide } from '../combat.js';

export type AttackInput = {
  player: PlayerId;
  fromTerritoryId: number;
  targetTerritoryId: number;
  boatId: number | null;
  horseFromTerritoryId: number | null;
  weaponFromTerritoryId: number | null;
};

function isOwnedChainOneHop(
  state: GameState, src: number, dst: number, ownerId: PlayerId,
): boolean {
  return src !== dst && (state.touching[src]?.[dst] === true) && state.territories[src]?.ownerId === ownerId;
}

function isOwnedChainTwoHops(
  state: GameState, src: number, dst: number, ownerId: PlayerId,
): boolean {
  if (state.territories[src]?.ownerId !== ownerId) return false;
  if (src === dst) return false;
  if (state.touching[src]?.[dst]) return true;
  for (let m = 0; m < state.territories.length; m++) {
    if (m === src || m === dst) continue;
    if (state.territories[m]?.ownerId !== ownerId) continue;
    if (state.touching[src]?.[m] && state.touching[m]?.[dst]) return true;
  }
  return false;
}

export function applyAttack(prev: GameState, input: AttackInput): GameState {
  if (prev.currentPhase !== 'conquest') {
    throw new Error(`attack illegal during ${prev.currentPhase} phase`);
  }
  if (input.player !== prev.currentPlayer) {
    throw new Error(`attack by player ${input.player} but current is ${prev.currentPlayer}`);
  }
  if (prev.players[input.player]!.status !== 'playing') {
    throw new Error(`attack by non-playing player`);
  }
  if (prev.pendingCombat !== null) {
    throw new Error(`combat already pending in flight`);
  }
  const fromT = prev.territories[input.fromTerritoryId];
  const targetT = prev.territories[input.targetTerritoryId];
  if (!fromT || !targetT) throw new Error(`Invalid territory id`);
  if (fromT.ownerId !== input.player) throw new Error(`from territory not owned by player`);
  if (input.fromTerritoryId === input.targetTerritoryId) {
    throw new Error(`Cannot attack own territory`);
  }
  if (!prev.touching[input.fromTerritoryId]?.[input.targetTerritoryId]) {
    throw new Error(`Target not adjacent to from`);
  }
  if (targetT.ownerId === input.player) {
    throw new Error(`Cannot attack own territory`);
  }

  // Validate brought horse (within 2 hops via owned chain to target)
  if (input.horseFromTerritoryId !== null) {
    const hs = prev.territories[input.horseFromTerritoryId];
    if (!hs) throw new Error(`Invalid horseFromTerritoryId`);
    if (hs.ownerId !== input.player) throw new Error(`Horse source not owned`);
    if (!hs.hasHorse) throw new Error(`Horse source has no horse`);
    if (!isOwnedChainTwoHops(prev, input.horseFromTerritoryId, input.targetTerritoryId, input.player)) {
      throw new Error(`Horse source not within 2 hops via owned chain`);
    }
  }
  // Validate brought weapon (within 1 hop owned)
  if (input.weaponFromTerritoryId !== null) {
    const ws = prev.territories[input.weaponFromTerritoryId];
    if (!ws) throw new Error(`Invalid weaponFromTerritoryId`);
    if (ws.ownerId !== input.player) throw new Error(`Weapon source not owned`);
    if (!ws.hasWeapon) throw new Error(`Weapon source has no weapon`);
    if (!isOwnedChainOneHop(prev, input.weaponFromTerritoryId, input.targetTerritoryId, input.player)) {
      throw new Error(`Weapon source not adjacent to target`);
    }
  }
  // Validate brought boat (docked at adjacent territory on a lake target borders)
  if (input.boatId !== null) {
    const b = prev.boats[input.boatId];
    if (!b) throw new Error(`Invalid boatId`);
    if (b.ownerId !== input.player) throw new Error(`Boat not owned by player`);
    const dock = prev.territories[b.homeTerritoryId];
    if (!dock) throw new Error(`Boat dock invalid`);
    if (!prev.touching[b.homeTerritoryId]?.[input.targetTerritoryId]) {
      throw new Error(`Boat dock not adjacent to target`);
    }
    let lakeMatch = false;
    for (const lk of dock.bordersLakes) {
      if (targetT.bordersLakes.has(lk)) { lakeMatch = true; break; }
    }
    if (!lakeMatch) throw new Error(`Boat lake does not border target`);
  }

  // Remove brought horse / weapon from sources (boats stay until resolution)
  let territories: Territory[] = prev.territories;
  if (input.horseFromTerritoryId !== null) {
    territories = territories.map((t) =>
      t.id === input.horseFromTerritoryId ? { ...t, hasHorse: false } : t);
  }
  if (input.weaponFromTerritoryId !== null) {
    territories = territories.map((t) =>
      t.id === input.weaponFromTerritoryId ? { ...t, hasWeapon: false } : t);
  }

  // Initial pendingCombat with empty allies decisions (neutral defaults)
  const numPlayers = prev.players.length;
  const allies = listAllyCandidates(prev,
    input.player,
    targetT.ownerId,
    input.targetTerritoryId);

  const partial: GameState['pendingCombat'] = {
    attackerId: input.player,
    defenderId: targetT.ownerId,
    fromTerritoryId: input.fromTerritoryId,
    targetTerritoryId: input.targetTerritoryId,
    boatId: input.boatId,
    horseFromTerritoryId: input.horseFromTerritoryId,
    weaponFromTerritoryId: input.weaponFromTerritoryId,
    alliesDecisions: new Array<'attacker' | 'neutral' | 'defender'>(numPlayers).fill('neutral'),
    alliesPending: allies,
    attackerStrength: 0,
    defenderStrength: 0,
    resolved: false,
    attackerWon: false,
  };
  // Compute base strengths (allies all neutral by default until decisions arrive)
  const midState: GameState = { ...prev, territories, pendingCombat: partial };
  const { attackerStrength, defenderStrength } = getCombatStrength(midState, partial);
  // Bring-forces additions (only for non-touching sources)
  let attBonus = 0;
  if (input.boatId !== null) attBonus += 2;
  if (input.horseFromTerritoryId !== null) {
    const adjAlready = prev.touching[input.horseFromTerritoryId]?.[input.targetTerritoryId];
    if (!adjAlready) attBonus += 1;
  }
  if (input.weaponFromTerritoryId !== null) {
    const adjAlready = prev.touching[input.weaponFromTerritoryId]?.[input.targetTerritoryId];
    if (!adjAlready) attBonus += 3;
  }
  const finalAttackerStrength = attackerStrength + attBonus;
  // Auto-prevent-suicide check
  if (isAutoPreventSuicide(prev.setup.elementOfChance, finalAttackerStrength, defenderStrength)) {
    throw new Error(`Attack auto-prevented (suicide check at ${prev.setup.elementOfChance} chance)`);
  }
  return {
    ...midState,
    pendingCombat: { ...partial, attackerStrength: finalAttackerStrength, defenderStrength },
    log: [
      ...prev.log,
      { year: prev.year, phase: 'conquest', player: input.player,
        message: `Attack on territory ${input.targetTerritoryId} (att=${finalAttackerStrength}, def=${defenderStrength})` },
    ],
  };
}
```

- [ ] **Step 4: Wire into reducer**

In `src/game/reducer.ts`:
```ts
import { applyAttack } from './reducers/conquest.js';

// inside switch:
    case 'attack':
      return applyAttack(state, plan);
```

Remove `'attack'` from `NOT_IMPLEMENTED_KINDS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/conquest-attack.test.ts`
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/conquest.ts src/game/reducer.ts tests/reducers/conquest-attack.test.ts
git commit -m "Implement applyAttack: validate, remove brought units, populate pendingCombat"
```

---

## Task 5: `applyAlliesDecision` — collect ally choices

**Files:**
- Modify: `src/game/reducers/conquest.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/conquest-allies.test.ts`

Validation:
- `currentPhase === 'conquest'`.
- `pendingCombat !== null` and `resolved === false`.
- `player` is in `pendingCombat.alliesPending`.

Effect:
- Set `alliesDecisions[player] = choice`.
- Remove `player` from `alliesPending`.
- Recompute strengths via `getCombatStrength`, add the bring-forces bonus delta (the same delta computed in Task 4 — but bonuses don't change with allies, so we recompute from the original `attackerStrength` minus old base then add new base).

Simpler approach: store the base strengths (no allies) AND the bring-forces bonus separately on `pendingCombat`. But that bloats the type. Cleaner: derive everything fresh each time `applyAlliesDecision` is called.

For Plan 4: redo the full calculation at every decision arrival — strengths = base via `getCombatStrength` (with current alliesDecisions) + bring-forces bonuses (recomputed from `pendingCombat.boatId/horseFromTerritoryId/weaponFromTerritoryId` adjacency).

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
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup: setup3, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function attackWithAllies(): { state: GameState; allyId: number } {
  let s = reduce(initial(), { kind: 'newGame', setup: setup3, seed: 53 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'conquest', currentPlayer: 0,
    attackNumber: 1, pendingCombat: null };
  // Find a target where 3rd party (player 2) has force adjacent
  let from = -1, target = -1, allyId = -1;
  outer: for (let a = 0; a < s.territories.length; a++) {
    if (s.territories[a]!.ownerId !== 0) continue;
    for (let b = 0; b < s.territories.length; b++) {
      if (a === b) continue;
      if (s.territories[b]!.ownerId !== 1) continue;
      if (!s.touching[a]?.[b]) continue;
      // Check player 2 has adjacent or central tile to target
      for (let c = 0; c < s.territories.length; c++) {
        if (c === b) continue;
        if (s.territories[c]!.ownerId !== 2) continue;
        if (s.touching[c]?.[b]) { from = a; target = b; allyId = 2; break outer; }
      }
    }
  }
  if (from < 0) throw new Error('No tri-party config');
  s = reduce(s, {
    kind: 'attack', player: 0, fromTerritoryId: from, targetTerritoryId: target,
    boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
  });
  return { state: s, allyId };
}

describe('applyAlliesDecision', () => {
  it('collects ally choice and updates alliesPending', () => {
    const { state: s, allyId } = attackWithAllies();
    expect(s.pendingCombat!.alliesPending.has(allyId as 0 | 1 | 2)).toBe(true);
    const out = reduce(s, { kind: 'alliesDecision', player: allyId as 0 | 1 | 2, choice: 'attacker' });
    expect(out.pendingCombat!.alliesPending.has(allyId as 0 | 1 | 2)).toBe(false);
    expect(out.pendingCombat!.alliesDecisions[allyId]).toBe('attacker');
    // attackerStrength should grow when ally goes with attacker
    expect(out.pendingCombat!.attackerStrength).toBeGreaterThanOrEqual(s.pendingCombat!.attackerStrength);
  });

  it('rejects when player is not an ally candidate', () => {
    const { state: s } = attackWithAllies();
    expect(() => reduce(s, { kind: 'alliesDecision', player: 0, choice: 'attacker' }))
      .toThrow(/not.*ally|not.*pending/i);
  });

  it('rejects when no combat is pending', () => {
    const { state: s, allyId } = attackWithAllies();
    const cleared = { ...s, pendingCombat: null };
    expect(() => reduce(cleared, { kind: 'alliesDecision', player: allyId as 0 | 1 | 2, choice: 'neutral' }))
      .toThrow(/no.*combat/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/conquest-allies.test.ts`
Expected: FAIL — alliesDecision throws "not implemented".

- [ ] **Step 3: Append to `src/game/reducers/conquest.ts`**

```ts
function bringForcesBonus(prev: GameState, c: GameState['pendingCombat']): number {
  if (c === null) return 0;
  let b = 0;
  if (c.boatId !== null) b += 2;
  if (c.horseFromTerritoryId !== null
      && !prev.touching[c.horseFromTerritoryId]?.[c.targetTerritoryId]) b += 1;
  if (c.weaponFromTerritoryId !== null
      && !prev.touching[c.weaponFromTerritoryId]?.[c.targetTerritoryId]) b += 3;
  return b;
}

export function applyAlliesDecision(
  prev: GameState,
  player: PlayerId,
  choice: 'attacker' | 'neutral' | 'defender',
): GameState {
  if (prev.currentPhase !== 'conquest') {
    throw new Error(`alliesDecision illegal during ${prev.currentPhase} phase`);
  }
  const c = prev.pendingCombat;
  if (!c || c.resolved) {
    throw new Error(`No active combat for alliesDecision`);
  }
  if (!c.alliesPending.has(player)) {
    throw new Error(`Player ${player} is not a pending ally`);
  }
  const newDecisions = [...c.alliesDecisions];
  newDecisions[player] = choice;
  const newPending = new Set(c.alliesPending);
  newPending.delete(player);
  const updated: typeof c = { ...c, alliesDecisions: newDecisions, alliesPending: newPending };
  const { attackerStrength, defenderStrength } = getCombatStrength(prev, updated);
  const total = attackerStrength + bringForcesBonus(prev, updated);
  return {
    ...prev,
    pendingCombat: { ...updated, attackerStrength: total, defenderStrength },
    log: [
      ...prev.log,
      { year: prev.year, phase: 'conquest', player,
        message: `Allies decision: ${choice}` },
    ],
  };
}
```

- [ ] **Step 4: Wire into reducer**

```ts
import { applyAlliesDecision } from './reducers/conquest.js';

// inside switch:
    case 'alliesDecision':
      return applyAlliesDecision(state, plan.player, plan.choice);
```

Remove `'alliesDecision'` from `NOT_IMPLEMENTED_KINDS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/conquest-allies.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/conquest.ts src/game/reducer.ts tests/reducers/conquest-allies.test.ts
git commit -m "Implement applyAlliesDecision: collect choice, recompute strengths"
```

---

## Task 6: `applyResolveCombat` — Element of Chance Low (deterministic)

**Files:**
- Modify: `src/game/reducers/conquest.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/conquest-resolve-low.test.ts`

Reference: spec §"Resolution" — at Low, attacker wins iff `attackerStrength >= defenderStrength` (tie → attacker).

Validation:
- `currentPhase === 'conquest'`.
- `pendingCombat !== null` and `resolved === false`.
- `pendingCombat.alliesPending.size === 0` (all allies have decided).

Effect:
- For Element of Chance Low: set `attackerWon = (attackerStrength >= defenderStrength)`, `resolved = true`.
- This task does NOT yet apply post-attack effects (territory transfer, etc.) — that's Tasks 9–13. We just compute the outcome flag.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, CombatState } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'low', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function withCombat(att: number, def: number): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 59 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'conquest', currentPlayer: 0, attackNumber: 1 };
  const target = s.territories.find((t) => t.ownerId === 1)!.id;
  const from = s.territories.find((t) => t.ownerId === 0
    && s.touching[t.id]?.[target])!.id;
  const c: CombatState = {
    attackerId: 0, defenderId: 1,
    fromTerritoryId: from, targetTerritoryId: target,
    boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    alliesDecisions: ['neutral', 'neutral'],
    alliesPending: new Set<number>(),
    attackerStrength: att, defenderStrength: def,
    resolved: false, attackerWon: false,
  };
  return { ...s, pendingCombat: c };
}

describe('applyResolveCombat (Low)', () => {
  it('attacker wins when attackerStrength >= defenderStrength', () => {
    const s = withCombat(5, 3);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.resolved).toBe(true);
    expect(out.pendingCombat!.attackerWon).toBe(true);
  });

  it('tie goes to attacker at Low', () => {
    const s = withCombat(4, 4);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(true);
  });

  it('attacker loses when strictly less', () => {
    const s = withCombat(3, 5);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(false);
  });

  it('rejects when allies are still pending', () => {
    const s = withCombat(5, 3);
    s.pendingCombat!.alliesPending.add(1);
    expect(() => reduce(s, { kind: 'resolveCombat' })).toThrow(/allies/i);
  });

  it('rejects when no combat is pending', () => {
    const s = withCombat(5, 3);
    const cleared = { ...s, pendingCombat: null };
    expect(() => reduce(cleared, { kind: 'resolveCombat' })).toThrow(/no.*combat/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/conquest-resolve-low.test.ts`
Expected: FAIL — resolveCombat throws "not implemented".

- [ ] **Step 3: Append to `src/game/reducers/conquest.ts`**

```ts
import { nextFloat } from '../rng.js';
import { probSuccess } from '../locProb.js';

export function applyResolveCombat(prev: GameState): GameState {
  if (prev.currentPhase !== 'conquest') {
    throw new Error(`resolveCombat illegal during ${prev.currentPhase} phase`);
  }
  const c = prev.pendingCombat;
  if (!c || c.resolved) throw new Error(`No active combat to resolve`);
  if (c.alliesPending.size > 0) {
    throw new Error(`Cannot resolve: ${c.alliesPending.size} allies still pending`);
  }
  const chance = prev.setup.elementOfChance;
  let attackerWon: boolean;
  let nextRngCursor = prev.rngCursor;
  if (chance === 'low') {
    attackerWon = c.attackerStrength >= c.defenderStrength;
  } else if (chance === 'medium') {
    if (c.attackerStrength > c.defenderStrength) attackerWon = true;
    else if (c.attackerStrength < c.defenderStrength) attackerWon = false;
    else {
      // Coin flip on tie
      const rng = { seed: prev.seed, cursor: prev.rngCursor };
      attackerWon = nextFloat(rng) < 0.5;
      nextRngCursor = rng.cursor;
    }
  } else {
    // High: probabilistic decrement-until-zero loop
    const rng = { seed: prev.seed, cursor: prev.rngCursor };
    let att = c.attackerStrength;
    let def = c.defenderStrength;
    while (att > 0 && def > 0) {
      if (nextFloat(rng) < 0.5) att--;
      else def--;
    }
    attackerWon = def === 0;
    nextRngCursor = rng.cursor;
  }
  const probability = chance === 'high'
    ? probSuccess(c.attackerStrength, c.defenderStrength)
    : null;
  const probMsg = probability !== null
    ? ` (P(att-win)=${probability.toFixed(3)})`
    : '';
  return {
    ...prev,
    rngCursor: nextRngCursor,
    pendingCombat: { ...c, resolved: true, attackerWon },
    log: [
      ...prev.log,
      { year: prev.year, phase: 'conquest', player: c.attackerId,
        message: `Combat resolved: ${attackerWon ? 'attacker won' : 'attacker lost'}${probMsg}` },
    ],
  };
}
```

- [ ] **Step 4: Wire into reducer**

```ts
import { applyResolveCombat } from './reducers/conquest.js';

// inside switch:
    case 'resolveCombat':
      return applyResolveCombat(state);
```

Remove `'resolveCombat'` from `NOT_IMPLEMENTED_KINDS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/conquest-resolve-low.test.ts`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/conquest.ts src/game/reducer.ts tests/reducers/conquest-resolve-low.test.ts
git commit -m "Implement applyResolveCombat (Low): deterministic, ties to attacker"
```

---

## Task 7: `applyResolveCombat` — Element of Chance Medium (tie → coin)

**Files:**
- Create: `tests/reducers/conquest-resolve-medium.test.ts`

The Medium branch is already implemented in Task 6. Add tests to verify it.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, CombatState } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'medium', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function withCombat(att: number, def: number, seed = 67): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'conquest', currentPlayer: 0, attackNumber: 1 };
  const target = s.territories.find((t) => t.ownerId === 1)!.id;
  const from = s.territories.find((t) => t.ownerId === 0
    && s.touching[t.id]?.[target])!.id;
  const c: CombatState = {
    attackerId: 0, defenderId: 1,
    fromTerritoryId: from, targetTerritoryId: target,
    boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    alliesDecisions: ['neutral', 'neutral'],
    alliesPending: new Set<number>(),
    attackerStrength: att, defenderStrength: def,
    resolved: false, attackerWon: false,
  };
  return { ...s, pendingCombat: c };
}

describe('applyResolveCombat (Medium)', () => {
  it('attacker wins when strictly greater', () => {
    const s = withCombat(5, 3);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(true);
  });

  it('attacker loses when strictly less', () => {
    const s = withCombat(3, 5);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(false);
  });

  it('tie goes by seeded coin flip', () => {
    // Run two ties with different seeds — outcomes should be deterministic-per-seed
    const s1 = withCombat(4, 4, /* seed */ 100);
    const out1 = reduce(s1, { kind: 'resolveCombat' });
    const s2 = withCombat(4, 4, /* seed */ 100);
    const out2 = reduce(s2, { kind: 'resolveCombat' });
    expect(out1.pendingCombat!.attackerWon).toBe(out2.pendingCombat!.attackerWon);
    // rngCursor advanced by 1
    expect(out1.rngCursor).toBe(s1.rngCursor + 1);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/reducers/conquest-resolve-medium.test.ts`
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/reducers/conquest-resolve-medium.test.ts
git commit -m "Add Medium-chance combat resolution tests (deterministic-per-seed)"
```

---

## Task 8: `applyResolveCombat` — Element of Chance High (probabilistic)

**Files:**
- Create: `tests/reducers/conquest-resolve-high.test.ts`

The High branch is already implemented in Task 6 (decrement-until-zero loop). This task adds tests that verify the probabilistic resolution against `LocProb.probSuccess`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import { probSuccess } from '../../src/game/locProb.js';
import type { GameState, GameSetup, CombatState } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function withCombat(att: number, def: number, seed: number): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'conquest', currentPlayer: 0, attackNumber: 1 };
  const target = s.territories.find((t) => t.ownerId === 1)!.id;
  const from = s.territories.find((t) => t.ownerId === 0
    && s.touching[t.id]?.[target])!.id;
  const c: CombatState = {
    attackerId: 0, defenderId: 1,
    fromTerritoryId: from, targetTerritoryId: target,
    boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    alliesDecisions: ['neutral', 'neutral'],
    alliesPending: new Set<number>(),
    attackerStrength: att, defenderStrength: def,
    resolved: false, attackerWon: false,
  };
  return { ...s, pendingCombat: c };
}

describe('applyResolveCombat (High)', () => {
  it('always wins when defender starts at 0', () => {
    const s = withCombat(5, 0, 42);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(true);
  });

  it('never wins when attacker starts at 0', () => {
    const s = withCombat(0, 5, 42);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(false);
  });

  it('Monte-Carlo win-rate over many seeds approximates probSuccess', () => {
    const att = 5, def = 5;
    const trials = 400;
    let wins = 0;
    for (let seed = 0; seed < trials; seed++) {
      const s = withCombat(att, def, seed * 31 + 1);
      const out = reduce(s, { kind: 'resolveCombat' });
      if (out.pendingCombat!.attackerWon) wins++;
    }
    const empirical = wins / trials;
    const expected = probSuccess(att, def);
    // Within 8% (loose tolerance for 400 trials with std~2.5%)
    expect(Math.abs(empirical - expected)).toBeLessThan(0.08);
  });

  it('rngCursor advances by exactly the number of coin flips taken', () => {
    const s = withCombat(3, 3, 99);
    const out = reduce(s, { kind: 'resolveCombat' });
    // The high branch flips until one side hits 0; min flips=3, max=5 for 3v3
    const flipsTaken = out.rngCursor - s.rngCursor;
    expect(flipsTaken).toBeGreaterThanOrEqual(3);
    expect(flipsTaken).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/reducers/conquest-resolve-high.test.ts`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/reducers/conquest-resolve-high.test.ts
git commit -m "Add High-chance combat resolution tests (Monte-Carlo vs probSuccess)"
```

---

## Task 9: Post-attack effects — territory ownership transfer

**Files:**
- Modify: `src/game/reducers/conquest.ts`
- Create: `tests/reducers/conquest-postattack.test.ts`

After resolveCombat marks `attackerWon = true`, the engine must apply post-attack effects in a single follow-up step. We extend `applyResolveCombat` to perform all post-attack transfers when `attackerWon`.

This task adds: territory owner becomes attacker.

- [ ] **Step 1: Write the failing test** (`tests/reducers/conquest-postattack.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, CombatState } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'low', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function combatReady(att: number, def: number): { state: GameState; from: number; target: number } {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 73 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'conquest', currentPlayer: 0, attackNumber: 1 };
  const target = s.territories.find((t) => t.ownerId === 1)!.id;
  const from = s.territories.find((t) => t.ownerId === 0
    && s.touching[t.id]?.[target])!.id;
  const c: CombatState = {
    attackerId: 0, defenderId: 1,
    fromTerritoryId: from, targetTerritoryId: target,
    boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    alliesDecisions: ['neutral', 'neutral'],
    alliesPending: new Set<number>(),
    attackerStrength: att, defenderStrength: def,
    resolved: false, attackerWon: false,
  };
  return { state: { ...s, pendingCombat: c }, from, target };
}

describe('post-attack: territory transfer', () => {
  it('attacker takes target on win', () => {
    const { state: s, target } = combatReady(5, 3);
    expect(s.territories[target]!.ownerId).toBe(1);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(true);
    expect(out.territories[target]!.ownerId).toBe(0);
  });

  it('target unchanged on loss', () => {
    const { state: s, target } = combatReady(2, 8);
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(false);
    expect(out.territories[target]!.ownerId).toBe(1);
  });

  it('unowned target (defenderId null) becomes attacker on win', () => {
    const { state: s, target } = combatReady(5, 0);
    s.pendingCombat!.defenderId = null;
    s.territories[target]!.ownerId = null;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.territories[target]!.ownerId).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/conquest-postattack.test.ts`
Expected: FAIL — territory ownership doesn't change yet.

- [ ] **Step 3: Refactor `applyResolveCombat` to apply post-attack effects on win**

Update `applyResolveCombat` in `src/game/reducers/conquest.ts` to call a new `applyPostAttackWin` helper after determining outcome:

```ts
// At the end of applyResolveCombat, just before the return:
if (attackerWon) {
  const intermediate: GameState = {
    ...prev,
    rngCursor: nextRngCursor,
    pendingCombat: { ...c, resolved: true, attackerWon },
  };
  return applyPostAttackWin(intermediate, c);
}
return {
  ...prev,
  rngCursor: nextRngCursor,
  pendingCombat: { ...c, resolved: true, attackerWon },
  log: [
    ...prev.log,
    { year: prev.year, phase: 'conquest', player: c.attackerId,
      message: `Combat resolved: attacker lost${probMsg}` },
  ],
};
```

(The win-side log entry will be appended in `applyPostAttackWin`. The lose-side log entry stays here.)

Add the helper:

```ts
function applyPostAttackWin(state: GameState, c: NonNullable<GameState['pendingCombat']>): GameState {
  // Step 1 (Task 9): territory ownership transfer
  const territories = state.territories.map((t) =>
    t.id === c.targetTerritoryId ? { ...t, ownerId: state.pendingCombat!.attackerId } : t);
  return {
    ...state,
    territories,
    log: [
      ...state.log,
      { year: state.year, phase: 'conquest', player: c.attackerId,
        message: `Territory ${c.targetTerritoryId} captured` },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/conquest-postattack.test.ts`
Expected: 3 passed. Also re-run resolve-low/medium/high tests — they should still pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/conquest.ts tests/reducers/conquest-postattack.test.ts
git commit -m "Post-attack: territory ownership transfer on attacker win"
```

---

## Task 10: Post-attack — boat re-flag

**Files:**
- Modify: `src/game/reducers/conquest.ts`
- Modify: `tests/reducers/conquest-postattack.test.ts`

Reference: spec §"Post-attack effects" + LocApplet L2093–L2100. All boats whose `homeTerritoryId === target` re-flag to attacker ownership.

- [ ] **Step 1: Append failing tests to `conquest-postattack.test.ts`**

```ts
describe('post-attack: boat re-flag', () => {
  it('all boats docked at target switch to attacker', () => {
    const { state: s, target } = combatReady(5, 3);
    // Place a boat docked at the target, owned by defender
    s.boats[0] = {
      id: 0, x: -1, y: -1, homeTerritoryId: target, ownerId: 1,
      carryHorse: false, carryWeapon: false,
    };
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.boats[0]!.ownerId).toBe(0);
    expect(out.boats[0]!.homeTerritoryId).toBe(target); // home unchanged
  });

  it('boats elsewhere are not affected', () => {
    const { state: s, target } = combatReady(5, 3);
    const otherTerr = s.territories.find((t) => t.id !== target && t.ownerId === 1)!.id;
    s.boats[0] = {
      id: 0, x: -1, y: -1, homeTerritoryId: otherTerr, ownerId: 1,
      carryHorse: false, carryWeapon: false,
    };
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.boats[0]!.ownerId).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/conquest-postattack.test.ts`
Expected: FAIL — boat re-flag not yet wired.

- [ ] **Step 3: Extend `applyPostAttackWin`**

Replace its body with:

```ts
function applyPostAttackWin(state: GameState, c: NonNullable<GameState['pendingCombat']>): GameState {
  const attackerId = c.attackerId;
  // Step 1: territory transfer
  let territories = state.territories.map((t) =>
    t.id === c.targetTerritoryId ? { ...t, ownerId: attackerId } : t);
  // Step 2: boat re-flag (any boat homed at target)
  const boats = state.boats.map((b) =>
    b && b.homeTerritoryId === c.targetTerritoryId ? { ...b, ownerId: attackerId } : b);
  return {
    ...state,
    territories,
    boats,
    log: [
      ...state.log,
      { year: state.year, phase: 'conquest', player: attackerId,
        message: `Territory ${c.targetTerritoryId} captured` },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/conquest-postattack.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/conquest.ts tests/reducers/conquest-postattack.test.ts
git commit -m "Post-attack: re-flag boats homed at captured territory"
```

---

## Task 11: Post-attack — defender horse / weapon transfer

**Files:**
- Modify: `src/game/reducers/conquest.ts`
- Modify: `tests/reducers/conquest-postattack.test.ts`

Reference: spec §"Post-attack effects" — "Defender's horse (if any) is removed; if attacker did **not** bring a horse and the target had one, attacker gains +1 in stockpile slot 4". Weapon: same pattern but slot 4 is NOT incremented (weapons aren't a stockpile resource); the weapon flag transfers to the attacker if attacker didn't bring one.

LocApplet L2062–L2073:
- If `target.hasHorse` and attacker did NOT bring a horse: `attacker.stockpile[4] += 1`. Either way, `target.hasHorse` is preserved (the horse continues at target under attacker ownership).
  - Actually re-reading L2062–L2070: `addResources(4, -1)` is called on the *defender* (var10_44 = old owner) to remove the horse from their stockpile slot. Then if attacker didn't bring a horse, `addResources(4, 1)` on the attacker. The on-territory horse stays.
- If attacker DID bring a horse (`oldHLoc > -1`) and target didn't have one: `target.hasHorse = true` (the brought horse lands).
- Weapon: similar. Brought weapon lands if target didn't have one.

For Plan 4:
- On win:
  - If `c.horseFromTerritoryId === null` AND `target.hasHorse`: `attacker.stockpile[4] += 1`.
  - If `target.hasHorse` AND `defender !== null`: `defender.stockpile[4] = max(0, stockpile[4] - 1)`.
  - If `c.horseFromTerritoryId !== null` AND `!target.hasHorse`: `target.hasHorse = true`.
  - Weapon: if brought and target didn't have one, `target.hasWeapon = true`.
  - If `target.hasWeapon` (defender had one) and attacker didn't bring: weapon stays on target (now attacker-owned). No stockpile transfer.

- [ ] **Step 1: Append failing tests**

```ts
describe('post-attack: horse and weapon transfer', () => {
  it('defender loses 1 from stockpile[4] when target had a horse', () => {
    const { state: s, target } = combatReady(5, 3);
    s.territories[target]!.hasHorse = true;
    s.players[1]!.stockpile[4] = 2;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.players[1]!.stockpile[4]).toBe(1);
  });

  it('attacker gains +1 in stockpile[4] when not bringing horse and target had one', () => {
    const { state: s, target } = combatReady(5, 3);
    s.territories[target]!.hasHorse = true;
    const before = s.players[0]!.stockpile[4];
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.players[0]!.stockpile[4]).toBe(before + 1);
  });

  it('attacker does NOT gain stockpile[4] when bringing own horse', () => {
    const { state: s, from, target } = combatReady(5, 3);
    s.pendingCombat!.horseFromTerritoryId = from; // pretend brought
    s.territories[target]!.hasHorse = true;
    const before = s.players[0]!.stockpile[4];
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.players[0]!.stockpile[4]).toBe(before);
  });

  it('brought horse lands on captured tile if target had none', () => {
    const { state: s, from, target } = combatReady(5, 3);
    s.territories[target]!.hasHorse = false;
    s.pendingCombat!.horseFromTerritoryId = from;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.territories[target]!.hasHorse).toBe(true);
  });

  it('brought weapon lands on captured tile if target had none', () => {
    const { state: s, from, target } = combatReady(5, 3);
    s.territories[target]!.hasWeapon = false;
    s.pendingCombat!.weaponFromTerritoryId = from;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.territories[target]!.hasWeapon).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/conquest-postattack.test.ts`
Expected: FAIL — horse/weapon transfer not yet wired.

- [ ] **Step 3: Extend `applyPostAttackWin`**

Replace `applyPostAttackWin` with:

```ts
function applyPostAttackWin(state: GameState, c: NonNullable<GameState['pendingCombat']>): GameState {
  const attackerId = c.attackerId;
  const defenderId = c.defenderId;
  const targetT = state.territories[c.targetTerritoryId]!;
  const hadHorse = targetT.hasHorse;
  const hadWeapon = targetT.hasWeapon;

  // Step 1: territory transfer
  let territories = state.territories.map((t) => {
    if (t.id !== c.targetTerritoryId) return t;
    let next = { ...t, ownerId: attackerId };
    // Brought horse lands if target didn't have one
    if (c.horseFromTerritoryId !== null && !hadHorse) next = { ...next, hasHorse: true };
    // Brought weapon lands if target didn't have one
    if (c.weaponFromTerritoryId !== null && !hadWeapon) next = { ...next, hasWeapon: true };
    return next;
  });
  // Step 2: boat re-flag
  const boats = state.boats.map((b) =>
    b && b.homeTerritoryId === c.targetTerritoryId ? { ...b, ownerId: attackerId } : b);
  // Step 3: horse stockpile transfer
  let players = state.players;
  if (hadHorse) {
    players = players.map((p) => {
      if (defenderId !== null && p.id === defenderId) {
        const stock: typeof p.stockpile = [...p.stockpile] as typeof p.stockpile;
        stock[4] = Math.max(0, stock[4] - 1);
        return { ...p, stockpile: stock };
      }
      if (p.id === attackerId && c.horseFromTerritoryId === null) {
        const stock: typeof p.stockpile = [...p.stockpile] as typeof p.stockpile;
        stock[4] = stock[4] + 1;
        return { ...p, stockpile: stock };
      }
      return p;
    });
  }
  return {
    ...state,
    territories,
    boats,
    players,
    log: [
      ...state.log,
      { year: state.year, phase: 'conquest', player: attackerId,
        message: `Territory ${c.targetTerritoryId} captured` },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/conquest-postattack.test.ts`
Expected: 10 passed (5 from prior + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/conquest.ts tests/reducers/conquest-postattack.test.ts
git commit -m "Post-attack: horse/weapon transfer (stockpile slot 4) and brought-unit landing"
```

---

## Task 12: Post-attack — stockpile transfer (slots 0–3)

**Files:**
- Modify: `src/game/reducers/conquest.ts`
- Modify: `tests/reducers/conquest-postattack.test.ts`

Reference: spec §"Post-attack effects" + LocApplet L2083–L2092 — "If target held the defender's stockpile, all stockpile slots 0–3 transfer to attacker, defender's slots 0–3 zero out, `stockpileLocation[defender] = null`, STOCKPILE icon removed from target. Slot 4 (horses) is **not** swept."

- [ ] **Step 1: Append failing test**

```ts
describe('post-attack: stockpile transfer', () => {
  it('captures defender stockpile slots 0-3 when target held the stockpile', () => {
    const { state: s, target } = combatReady(5, 3);
    s.territories[target]!.hasStockpile = true;
    s.players[1]!.stockpileLocation = target;
    s.players[1]!.stockpile = [3, 2, 1, 4, 7];
    s.players[0]!.stockpile = [1, 1, 1, 1, 0];
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.players[0]!.stockpile.slice(0, 4)).toEqual([4, 3, 2, 5]);
    expect(out.players[1]!.stockpile.slice(0, 4)).toEqual([0, 0, 0, 0]);
    // Slot 4 NOT swept on either side from this branch
    expect(out.players[1]!.stockpile[4]).toBe(7);
    // Stockpile flag and location cleared on defender
    expect(out.territories[target]!.hasStockpile).toBe(false);
    expect(out.players[1]!.stockpileLocation).toBeNull();
  });

  it('does nothing if target did not hold the stockpile', () => {
    const { state: s, target } = combatReady(5, 3);
    s.territories[target]!.hasStockpile = false;
    s.players[1]!.stockpile = [3, 2, 1, 4, 0];
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.players[1]!.stockpile).toEqual([3, 2, 1, 4, 0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/conquest-postattack.test.ts`
Expected: FAIL — stockpile transfer not yet wired.

- [ ] **Step 3: Extend `applyPostAttackWin` with stockpile transfer**

Add to `applyPostAttackWin` after the horse-stockpile transfer block:

```ts
  // Step 4: stockpile transfer (slots 0-3 only) when target held the defender's stockpile
  if (targetT.hasStockpile && defenderId !== null) {
    territories = territories.map((t) =>
      t.id === c.targetTerritoryId ? { ...t, hasStockpile: false } : t);
    players = players.map((p) => {
      if (p.id === defenderId) {
        const stock: typeof p.stockpile = [...p.stockpile] as typeof p.stockpile;
        // Capture for attacker (handled below); zero out 0-3 here
        const captured = [stock[0], stock[1], stock[2], stock[3]];
        stock[0] = 0; stock[1] = 0; stock[2] = 0; stock[3] = 0;
        // Stash on a closure for the attacker map below
        (p as { _captured?: number[] })._captured = captured;
        return { ...p, stockpile: stock, stockpileLocation: null };
      }
      return p;
    });
    const captured = (players[defenderId] as { _captured?: number[] })._captured;
    if (captured) {
      players = players.map((p) => {
        if (p.id === attackerId) {
          const stock: typeof p.stockpile = [...p.stockpile] as typeof p.stockpile;
          for (let i = 0; i < 4; i++) stock[i] += captured[i] ?? 0;
          return { ...p, stockpile: stock };
        }
        return p;
      });
    }
    // Strip the temporary _captured property
    players = players.map((p) => {
      const { _captured: _x, ...clean } = p as Record<string, unknown>;
      return clean as typeof p;
    });
  }
```

(The `_captured` trick avoids a separate state pass. Alternative: compute captured upfront, then run a single map.)

Actually let's clean this up with a simpler approach. Replace the whole step with:

```ts
  // Step 4: stockpile transfer (slots 0-3 only) when target held the defender's stockpile
  if (targetT.hasStockpile && defenderId !== null) {
    const defStock = state.players[defenderId]!.stockpile;
    const captured: [number, number, number, number] = [defStock[0], defStock[1], defStock[2], defStock[3]];
    territories = territories.map((t) =>
      t.id === c.targetTerritoryId ? { ...t, hasStockpile: false } : t);
    players = players.map((p) => {
      if (p.id === defenderId) {
        const stock: typeof p.stockpile = [0, 0, 0, 0, p.stockpile[4]];
        return { ...p, stockpile: stock, stockpileLocation: null };
      }
      if (p.id === attackerId) {
        const stock: typeof p.stockpile = [...p.stockpile] as typeof p.stockpile;
        for (let i = 0; i < 4; i++) stock[i] = stock[i] + captured[i]!;
        return { ...p, stockpile: stock };
      }
      return p;
    });
  }
```

(Use this cleaner form instead of the `_captured` hack.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/conquest-postattack.test.ts`
Expected: 12 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/conquest.ts tests/reducers/conquest-postattack.test.ts
git commit -m "Post-attack: stockpile slots 0-3 transfer to attacker when target held stockpile"
```

---

## Task 13: Post-attack — re-run city activation sweep

**Files:**
- Modify: `src/game/reducers/conquest.ts`
- Modify: `tests/reducers/conquest-postattack.test.ts`

Reference: spec — "Run the city-activation sweep on every territory to recompute `hasResourceDouble`." Plan 2 already provides `recomputeResourceDoubles(state)` in `src/game/activation.ts`.

- [ ] **Step 1: Append failing test**

```ts
describe('post-attack: city activation sweep', () => {
  it('newly captured territory loses doubles when defender city de-activated', () => {
    const { state: s, target } = combatReady(5, 3);
    // Defender had an adjacent city activating target's resource
    const adjOwned = s.territories.find((t) =>
      t.id !== target && t.ownerId === 1 && s.touching[t.id]?.[target])!;
    s.territories[adjOwned.id]!.hasCity = true;
    s.territories[target]!.resource = 0; // Iron
    s.territories[target]!.hasResourceDouble = true; // assume previously activated
    const out = reduce(s, { kind: 'resolveCombat' });
    // After capture, target's resource is no longer activated by adj city
    // (the city is still defender-owned, but target is now attacker-owned).
    expect(out.territories[target]!.hasResourceDouble).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/conquest-postattack.test.ts`
Expected: FAIL — `hasResourceDouble` still true.

- [ ] **Step 3: Extend `applyPostAttackWin` with activation sweep**

At the end of `applyPostAttackWin`, before the return, add:

```ts
  // Step 5: re-run city activation sweep
  const swept = recomputeResourceDoubles({
    ...state, territories, boats, players,
  });
  return {
    ...swept,
    log: [
      ...state.log,
      { year: state.year, phase: 'conquest', player: attackerId,
        message: `Territory ${c.targetTerritoryId} captured` },
    ],
  };
```

(Update the import at the top of `conquest.ts` to include `recomputeResourceDoubles`:)
```ts
import { recomputeResourceDoubles } from '../activation.js';
```

Remove the old return statement and the duplicate log append.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/conquest-postattack.test.ts`
Expected: 13 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/conquest.ts tests/reducers/conquest-postattack.test.ts
git commit -m "Post-attack: re-run city activation sweep"
```

---

## Task 14: Post-attack on loss — destroy brought boat, decrement horse stockpile

**Files:**
- Modify: `src/game/reducers/conquest.ts`
- Create: `tests/reducers/conquest-loss.test.ts`

Reference: LocApplet L1993–L2003 + spec §"On attacker loss" — brought units (horse, weapon, boat-cargo) are destroyed.

For Plan 4:
- If `boatId !== null`: set `boats[boatId] = null` (boat destroyed).
- If `horseFromTerritoryId !== null`: `attacker.stockpile[4] = max(0, stockpile[4] - 1)`.
- Brought weapon: just gone (already removed at attack-init time; no further effect on loss).
- Target territory unchanged.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/game/reducer.js';
import type { GameState, GameSetup, CombatState } from '../../src/game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'r', persona: 'human' },
    { color: 'blue', name: 'b', persona: 'human' },
  ],
  citiesToWin: 3, elementOfChance: 'low', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function lossSetup(): { state: GameState; from: number; target: number } {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 79 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'conquest', currentPlayer: 0, attackNumber: 1 };
  const target = s.territories.find((t) => t.ownerId === 1)!.id;
  const from = s.territories.find((t) => t.ownerId === 0
    && s.touching[t.id]?.[target])!.id;
  // Heavy defender, weak attacker — guaranteed loss at Low chance
  const c: CombatState = {
    attackerId: 0, defenderId: 1,
    fromTerritoryId: from, targetTerritoryId: target,
    boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
    alliesDecisions: ['neutral', 'neutral'],
    alliesPending: new Set<number>(),
    attackerStrength: 1, defenderStrength: 10,
    resolved: false, attackerWon: false,
  };
  return { state: { ...s, pendingCombat: c }, from, target };
}

describe('post-attack: loss cleanup', () => {
  it('destroys committed boat on loss', () => {
    const { state: s, target } = lossSetup();
    s.boats[5] = {
      id: 5, x: 10, y: 10, homeTerritoryId: target, ownerId: 0,
      carryHorse: false, carryWeapon: false,
    };
    s.pendingCombat!.boatId = 5;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.pendingCombat!.attackerWon).toBe(false);
    expect(out.boats[5]).toBeNull();
  });

  it('decrements stockpile slot 4 when brought horse and lost', () => {
    const { state: s, from } = lossSetup();
    s.players[0]!.stockpile[4] = 2;
    s.pendingCombat!.horseFromTerritoryId = from;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.players[0]!.stockpile[4]).toBe(1);
  });

  it('target territory unchanged on loss', () => {
    const { state: s, target } = lossSetup();
    const before = s.territories[target]!.ownerId;
    const out = reduce(s, { kind: 'resolveCombat' });
    expect(out.territories[target]!.ownerId).toBe(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/conquest-loss.test.ts`
Expected: FAIL — boat not destroyed on loss.

- [ ] **Step 3: Add `applyPostAttackLoss` and route to it**

In `src/game/reducers/conquest.ts`, in `applyResolveCombat`, replace the loss-side return with a call:

```ts
// In applyResolveCombat at the end (replacing the existing loss-side return):
if (attackerWon) {
  const intermediate: GameState = {
    ...prev, rngCursor: nextRngCursor,
    pendingCombat: { ...c, resolved: true, attackerWon },
  };
  return applyPostAttackWin(intermediate, c);
}
const intermediateLoss: GameState = {
  ...prev, rngCursor: nextRngCursor,
  pendingCombat: { ...c, resolved: true, attackerWon },
};
return applyPostAttackLoss(intermediateLoss, c, probMsg);
```

Add the helper:

```ts
function applyPostAttackLoss(
  state: GameState,
  c: NonNullable<GameState['pendingCombat']>,
  probMsg: string,
): GameState {
  let boats = state.boats;
  if (c.boatId !== null) {
    boats = state.boats.map((b, i) => i === c.boatId ? null : b);
  }
  let players = state.players;
  if (c.horseFromTerritoryId !== null) {
    players = players.map((p) => {
      if (p.id !== c.attackerId) return p;
      const stock: typeof p.stockpile = [...p.stockpile] as typeof p.stockpile;
      stock[4] = Math.max(0, stock[4] - 1);
      return { ...p, stockpile: stock };
    });
  }
  return {
    ...state,
    boats,
    players,
    log: [
      ...state.log,
      { year: state.year, phase: 'conquest', player: c.attackerId,
        message: `Combat resolved: attacker lost${probMsg}` },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/conquest-loss.test.ts`
Expected: 3 passed. Re-run resolve-low/medium/high — still pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/conquest.ts tests/reducers/conquest-loss.test.ts
git commit -m "Post-attack on loss: destroy brought boat, decrement horse stockpile"
```

---

## Task 15: `endPhase` from conquest — rotate attacks; honour 2nd-attack forfeit

**Files:**
- Modify: `src/game/reducers/endPhase.ts`
- Create: `tests/reducers/conquest-end.test.ts`

Each `endPhase` from `'conquest'` advances the player's `attackNumber` (1 → 2) UNLESS:
- `pendingCombat !== null` (illegal — must resolve first), OR
- The player chose to ship-stockpile this turn (`shipmentForfeitsSecondAttack[player] === true`) — they only get attack #1, then the engine rotates to next player, OR
- `attackNumber === 2` already — rotate to next player.

When the last player ends conquest, advance to `'development'`. (No skip-roll for development entry per spec.)

Also: clear `pendingCombat` to null at the start of each new attack/turn (after resolution it stays as resolved state until endPhase clears it).

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
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function conquestStart(forfeit?: PlayerId): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 83 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  const ff = [false, false, false];
  if (forfeit !== undefined) ff[forfeit] = true;
  s = { ...s, currentPhase: 'conquest', currentPlayer: s.turnOrder[0]!,
    attackNumber: 1, pendingCombat: null,
    shipmentForfeitsSecondAttack: ff };
  return s;
}

type PlayerId = 0 | 1 | 2;

describe('endPhase: conquest rotation', () => {
  it('endPhase from conquest with attackNumber=1 advances to attack #2', () => {
    const s = conquestStart();
    const out = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(out.currentPhase).toBe('conquest');
    expect(out.attackNumber).toBe(2);
    expect(out.currentPlayer).toBe(s.currentPlayer);
  });

  it('endPhase from attack #2 rotates to next player and resets attackNumber', () => {
    let s = conquestStart();
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer }); // → attack 2
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer }); // → next player
    expect(s.attackNumber).toBe(1);
    expect(s.currentPlayer).toBe(s.turnOrder[1]!);
  });

  it('shipmentForfeitsSecondAttack[player]=true skips attack #2', () => {
    const s = conquestStart(s_forfeit(0));
    const out = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(out.attackNumber).toBe(1); // reset for next player
    expect(out.currentPlayer).toBe(s.turnOrder[1]!);
  });

  function s_forfeit(p: PlayerId): PlayerId { return p; }

  it('after last player ends, advances to development', () => {
    let s = conquestStart();
    // 3 players × 2 attacks = 6 endPhase calls
    for (let i = 0; i < 6; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(s.currentPhase).toBe('development');
    expect(s.currentPlayer).toBe(s.turnOrder[0]!);
  });

  it('rejects endPhase when combat is pending', () => {
    const s = conquestStart();
    s.pendingCombat = {
      attackerId: 0, defenderId: 1,
      fromTerritoryId: 0, targetTerritoryId: 1,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
      alliesDecisions: [], alliesPending: new Set([2]),
      attackerStrength: 1, defenderStrength: 1,
      resolved: false, attackerWon: false,
    };
    expect(() => reduce(s, { kind: 'endPhase', player: s.currentPlayer }))
      .toThrow(/pending|combat/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/conquest-end.test.ts`
Expected: FAIL — endPhase from conquest still throws "not implemented".

- [ ] **Step 3: Add `case 'conquest':` to `applyEndPhase`**

In `src/game/reducers/endPhase.ts`:

```ts
    case 'conquest': {
      if (prev.pendingCombat && !prev.pendingCombat.resolved) {
        throw new Error(`Cannot end conquest with pending combat in flight`);
      }
      const player = prev.currentPlayer;
      const forfeit = prev.shipmentForfeitsSecondAttack[player] === true;
      // Player has another attack this turn?
      if (prev.attackNumber === 1 && !forfeit) {
        return {
          ...prev,
          attackNumber: 2,
          pendingCombat: null,
          log: [
            ...prev.log,
            { year: prev.year, phase: 'conquest', player,
              message: `Player ${player} begins attack #2` },
          ],
        };
      }
      // Rotate to next player
      const idx = prev.turnOrder.indexOf(player);
      const nextIdx = (idx + 1) % prev.turnOrder.length;
      if (nextIdx !== 0) {
        return {
          ...prev,
          currentPlayer: prev.turnOrder[nextIdx]!,
          attackNumber: 1,
          pendingCombat: null,
          log: [
            ...prev.log,
            { year: prev.year, phase: 'conquest', player: prev.turnOrder[nextIdx]!,
              message: `Player ${prev.turnOrder[nextIdx]} begins conquest` },
          ],
        };
      }
      // Wrapped — advance to development
      return {
        ...prev,
        currentPhase: 'development',
        currentPlayer: prev.turnOrder[0]!,
        attackNumber: 1,
        pendingCombat: null,
        log: [
          ...prev.log,
          { year: prev.year, phase: 'development', player: prev.turnOrder[0]!,
            message: 'Development phase begins' },
        ],
      };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/conquest-end.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/endPhase.ts tests/reducers/conquest-end.test.ts
git commit -m "endPhase: conquest rotation; honour shipmentForfeitsSecondAttack; advance to development on wrap"
```

---

## Task 16: `applyBuildCity`

**Files:**
- Create: `src/game/reducers/development.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/development-city.test.ts`

Reference: spec §"Development phase" — City costs 1 iron + 1 coal + 1 tree + 1 gold (resource path) OR 4 gold (gold-alternative path). Max 1 per territory. Activates adjacent friendly resources via `recomputeResourceDoubles`.

Validation:
- `currentPhase === 'development'`.
- `player === currentPlayer`.
- `territoryId` owned by `player`.
- `!hasCity` already.
- Resource path: `stockpile[0] >= 1 && stockpile[1] >= 1 && stockpile[2] >= 1 && stockpile[3] >= 1`.
- Gold path: `stockpile[3] >= 4`.

Effect:
- Decrement stockpile.
- Set `hasCity = true` on territory.
- Run `recomputeResourceDoubles` to activate adjacent friendly resources.

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
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function developmentPhase(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 89 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'development', currentPlayer: 0 };
  return s;
}

describe('applyBuildCity', () => {
  it('builds city paying 1 of each iron/coal/tree/gold', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasCity)!;
    s.players[0]!.stockpile = [1, 1, 1, 1, 0] as Stockpile;
    const out = reduce(s, {
      kind: 'buildCity', player: 0, territoryId: own.id, payInGold: false,
    });
    expect(out.territories[own.id]!.hasCity).toBe(true);
    expect(out.players[0]!.stockpile).toEqual([0, 0, 0, 0, 0]);
  });

  it('builds city with gold alternative (4 gold)', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasCity)!;
    s.players[0]!.stockpile = [0, 0, 0, 4, 0] as Stockpile;
    const out = reduce(s, {
      kind: 'buildCity', player: 0, territoryId: own.id, payInGold: true,
    });
    expect(out.territories[own.id]!.hasCity).toBe(true);
    expect(out.players[0]!.stockpile).toEqual([0, 0, 0, 0, 0]);
  });

  it('rejects when stockpile insufficient (resource path)', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasCity)!;
    s.players[0]!.stockpile = [1, 0, 1, 1, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildCity', player: 0, territoryId: own.id, payInGold: false,
    })).toThrow(/insufficient/i);
  });

  it('rejects when stockpile insufficient (gold path)', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasCity)!;
    s.players[0]!.stockpile = [0, 0, 0, 3, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildCity', player: 0, territoryId: own.id, payInGold: true,
    })).toThrow(/insufficient/i);
  });

  it('rejects when territory already has a city', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0)!;
    s.territories[own.id]!.hasCity = true;
    s.players[0]!.stockpile = [1, 1, 1, 1, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildCity', player: 0, territoryId: own.id, payInGold: false,
    })).toThrow(/already has a city/i);
  });

  it('rejects when territory not owned', () => {
    const s = developmentPhase();
    const enemy = s.territories.find((t) => t.ownerId === 1)!;
    s.players[0]!.stockpile = [1, 1, 1, 1, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildCity', player: 0, territoryId: enemy.id, payInGold: false,
    })).toThrow(/not owned/i);
  });

  it('city activates adjacent friendly resource', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasCity)!;
    // Find an adjacent friendly territory with a non-stable resource
    const adjFriendly = s.territories.find((t) =>
      t.id !== own.id && t.ownerId === 0 && s.touching[own.id]?.[t.id]
        && t.resource !== null && t.resource !== 4);
    if (!adjFriendly) return;
    s.players[0]!.stockpile = [1, 1, 1, 1, 0] as Stockpile;
    const out = reduce(s, {
      kind: 'buildCity', player: 0, territoryId: own.id, payInGold: false,
    });
    expect(out.territories[adjFriendly.id]!.hasResourceDouble).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/development-city.test.ts`
Expected: FAIL — buildCity throws "not implemented".

- [ ] **Step 3: Implement `src/game/reducers/development.ts`**

```ts
import type { GameState, PlayerId, Stockpile } from '../types.js';
import { recomputeResourceDoubles } from '../activation.js';

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
```

- [ ] **Step 4: Wire into reducer**

```ts
import { applyBuildCity } from './reducers/development.js';

// inside switch:
    case 'buildCity':
      return applyBuildCity(state, plan.player, plan.territoryId, plan.payInGold);
```

Remove `'buildCity'` from `NOT_IMPLEMENTED_KINDS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/development-city.test.ts`
Expected: 7 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/development.ts src/game/reducer.ts tests/reducers/development-city.test.ts
git commit -m "Implement applyBuildCity (resource and gold paths) with activation sweep"
```

---

## Task 17: `applyBuildWeapon`

**Files:**
- Modify: `src/game/reducers/development.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/development-weapon.test.ts`

Weapon costs 1 iron + 1 coal (resource path) or 2 gold (gold-alt). Max 1 per territory.

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
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function developmentPhase(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 97 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'development', currentPlayer: 0 };
  return s;
}

describe('applyBuildWeapon', () => {
  it('builds weapon paying 1 iron + 1 coal', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasWeapon)!;
    s.players[0]!.stockpile = [1, 1, 0, 0, 0] as Stockpile;
    const out = reduce(s, {
      kind: 'buildWeapon', player: 0, territoryId: own.id, payInGold: false,
    });
    expect(out.territories[own.id]!.hasWeapon).toBe(true);
    expect(out.players[0]!.stockpile).toEqual([0, 0, 0, 0, 0]);
  });

  it('builds weapon with 2 gold alternative', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasWeapon)!;
    s.players[0]!.stockpile = [0, 0, 0, 2, 0] as Stockpile;
    const out = reduce(s, {
      kind: 'buildWeapon', player: 0, territoryId: own.id, payInGold: true,
    });
    expect(out.territories[own.id]!.hasWeapon).toBe(true);
  });

  it('rejects when territory already has a weapon', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0)!;
    s.territories[own.id]!.hasWeapon = true;
    s.players[0]!.stockpile = [1, 1, 0, 0, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildWeapon', player: 0, territoryId: own.id, payInGold: false,
    })).toThrow(/already has a weapon/i);
  });

  it('rejects when stockpile insufficient', () => {
    const s = developmentPhase();
    const own = s.territories.find((t) => t.ownerId === 0 && !t.hasWeapon)!;
    s.players[0]!.stockpile = [1, 0, 0, 0, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildWeapon', player: 0, territoryId: own.id, payInGold: false,
    })).toThrow(/insufficient/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/development-weapon.test.ts`
Expected: FAIL — buildWeapon throws.

- [ ] **Step 3: Append to `src/game/reducers/development.ts`**

```ts
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
```

- [ ] **Step 4: Wire into reducer**

```ts
import { applyBuildWeapon } from './reducers/development.js';

// inside switch:
    case 'buildWeapon':
      return applyBuildWeapon(state, plan.player, plan.territoryId, plan.payInGold);
```

Remove `'buildWeapon'` from `NOT_IMPLEMENTED_KINDS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/development-weapon.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/development.ts src/game/reducer.ts tests/reducers/development-weapon.test.ts
git commit -m "Implement applyBuildWeapon (resource and gold paths)"
```

---

## Task 18: `applyBuildBoat`

**Files:**
- Modify: `src/game/reducers/development.ts`
- Modify: `src/game/reducer.ts`
- Create: `tests/reducers/development-boat.test.ts`

Boat costs 3 trees (resource path) or 3 gold (gold-alt). Coastal territory only. Multiple boats allowed per territory. Uses Plan 3's `addBoat(state, territoryId, lakeId, ownerId)`.

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
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function developmentPhase(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 101 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'development', currentPlayer: 0 };
  return s;
}

describe('applyBuildBoat', () => {
  it('builds boat at coastal territory paying 3 trees', () => {
    const s = developmentPhase();
    const coastal = s.territories.find((t) =>
      t.ownerId === 0 && t.bordersLakes.size > 0);
    if (!coastal) return;
    const lakeId = [...coastal.bordersLakes][0]!;
    s.players[0]!.stockpile = [0, 0, 3, 0, 0] as Stockpile;
    const out = reduce(s, {
      kind: 'buildBoat', player: 0, territoryId: coastal.id,
      lakeId, payInGold: false,
    });
    expect(out.players[0]!.stockpile[2]).toBe(0);
    const newBoat = out.boats.find((b) => b !== null && b.homeTerritoryId === coastal.id);
    expect(newBoat).toBeDefined();
    expect(newBoat!.ownerId).toBe(0);
  });

  it('builds boat with 3 gold alternative', () => {
    const s = developmentPhase();
    const coastal = s.territories.find((t) =>
      t.ownerId === 0 && t.bordersLakes.size > 0);
    if (!coastal) return;
    const lakeId = [...coastal.bordersLakes][0]!;
    s.players[0]!.stockpile = [0, 0, 0, 3, 0] as Stockpile;
    const out = reduce(s, {
      kind: 'buildBoat', player: 0, territoryId: coastal.id,
      lakeId, payInGold: true,
    });
    expect(out.players[0]!.stockpile[3]).toBe(0);
  });

  it('rejects on landlocked territory', () => {
    const s = developmentPhase();
    const inland = s.territories.find((t) =>
      t.ownerId === 0 && t.bordersLakes.size === 0);
    if (!inland) return;
    s.players[0]!.stockpile = [0, 0, 3, 0, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildBoat', player: 0, territoryId: inland.id,
      lakeId: 0, payInGold: false,
    })).toThrow(/landlocked/i);
  });

  it('rejects when stockpile insufficient', () => {
    const s = developmentPhase();
    const coastal = s.territories.find((t) =>
      t.ownerId === 0 && t.bordersLakes.size > 0);
    if (!coastal) return;
    const lakeId = [...coastal.bordersLakes][0]!;
    s.players[0]!.stockpile = [0, 0, 2, 0, 0] as Stockpile;
    expect(() => reduce(s, {
      kind: 'buildBoat', player: 0, territoryId: coastal.id,
      lakeId, payInGold: false,
    })).toThrow(/insufficient/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/development-boat.test.ts`
Expected: FAIL — buildBoat throws.

- [ ] **Step 3: Append to `src/game/reducers/development.ts`**

```ts
import { addBoat } from '../boats.js';

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
  // result.kind === 'ok'
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
```

- [ ] **Step 4: Wire into reducer**

```ts
import { applyBuildBoat } from './reducers/development.js';

// inside switch:
    case 'buildBoat':
      return applyBuildBoat(state, plan.player, plan.territoryId, plan.lakeId, plan.payInGold);
```

Remove `'buildBoat'` from `NOT_IMPLEMENTED_KINDS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reducers/development-boat.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/game/reducers/development.ts src/game/reducer.ts tests/reducers/development-boat.test.ts
git commit -m "Implement applyBuildBoat (3 tree or 3 gold) using addBoat primitive"
```

---

## Task 19: `endPhase` from development — rotate

**Files:**
- Modify: `src/game/reducers/endPhase.ts`
- Create: `tests/reducers/development-end.test.ts`

`endPhase` from `'development'`:
- Rotate to next player. Reset `attackNumber: 1` and `shipmentUsed: false` for the new player.
- On wrap (back to `turnOrder[0]`): trigger year wrap (Task 22 will handle game-over check + rotation + elimination + year++). For Task 19, we just identify the wrap and transition to a placeholder `'production'` for next year.

For Task 19, we'll implement the rotation + a temporary "advance to production with year++" behaviour, then Task 22 inserts the proper year-wrap logic.

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
  citiesToWin: 8, elementOfChance: 'high', randomizePlayerOrder: false, // 8 = unreachable, prevents game-over
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function developmentPhase(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 103 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'development', currentPlayer: s.turnOrder[0]! };
  return s;
}

describe('endPhase: development rotation', () => {
  it('rotates to next player within development', () => {
    let s = developmentPhase();
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(s.currentPhase).toBe('development');
    expect(s.currentPlayer).toBe(s.turnOrder[1]!);
  });

  it('after last player ends, wraps to year + 1 production', () => {
    let s = developmentPhase();
    const startYear = s.year;
    for (let i = 0; i < s.players.length; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(s.currentPhase).toBe('production');
    expect(s.year).toBe(startYear + 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/development-end.test.ts`
Expected: FAIL — endPhase from development still throws.

- [ ] **Step 3: Add `case 'development':` to `applyEndPhase` (provisional)**

In `src/game/reducers/endPhase.ts`:

```ts
    case 'development': {
      const idx = prev.turnOrder.indexOf(prev.currentPlayer);
      const nextIdx = (idx + 1) % prev.turnOrder.length;
      if (nextIdx !== 0) {
        return {
          ...prev,
          currentPlayer: prev.turnOrder[nextIdx]!,
          attackNumber: 1,
          shipmentUsed: false,
          log: [
            ...prev.log,
            { year: prev.year, phase: 'development', player: prev.turnOrder[nextIdx]!,
              message: `Player ${prev.turnOrder[nextIdx]} begins development` },
          ],
        };
      }
      // Wrapped — provisional year wrap; Task 22 replaces this with checkEndOfGame + applyYearWrap
      return {
        ...prev,
        currentPhase: 'production',
        currentPlayer: prev.turnOrder[0]!,
        year: prev.year + 1,
        attackNumber: 1,
        shipmentUsed: false,
        log: [
          ...prev.log,
          { year: prev.year + 1, phase: 'production', player: prev.turnOrder[0]!,
            message: 'Year wrap; new year begins' },
        ],
      };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/development-end.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/endPhase.ts tests/reducers/development-end.test.ts
git commit -m "endPhase: development rotation; provisional year wrap (Task 22 replaces)"
```

---

## Task 20: `checkEndOfGame` helper

**Files:**
- Create: `src/game/checkEndOfGame.ts`
- Create: `tests/checkEndOfGame.test.ts`

Reference: spec §"Year wrap-up" + LocApplet L3033–L3074. Returns `winnerId | null`:
- If a player has the most cities AND that count >= `citiesToWin`: that player wins.
- Tie at top: no winner from cities.
- If no city-based winner: if a single player owns ALL territories → they win.
- Otherwise: no winner.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { checkEndOfGame } from '../src/game/checkEndOfGame.js';
import type { GameState, GameSetup, Territory } from '../src/game/types.js';

function stateWith(territoryOwners: Array<number | null>, cities: number[]): GameState {
  const territories: Territory[] = territoryOwners.map((own, id) => ({
    id, ownerId: own as 0 | 1 | 2 | 3 | 4 | 5 | 6 | null,
    resource: null, hasCity: false, hasWeapon: false, hasHorse: false,
    hasStockpile: false, hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
  }));
  // Distribute cities[i] cities to player i (place on first matching owned territories)
  for (let p = 0; p < cities.length; p++) {
    let placed = 0;
    for (const t of territories) {
      if (t.ownerId !== p) continue;
      if (placed >= cities[p]!) break;
      t.hasCity = true;
      placed++;
    }
  }
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: cities.map((_, i) => ({
        color: (['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const)[i]!,
        name: `p${i}`, persona: 'human',
      })),
      citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: territories.length,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories, touching: [], distance: [],
    boats: [], players: cities.map((_, i) => ({
      id: i as 0 | 1 | 2 | 3 | 4 | 5 | 6, name: `p${i}`,
      color: (['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const)[i]!,
      persona: 'human', status: 'playing',
      stockpile: [0, 0, 0, 0, 0], stockpileLocation: null,
    })),
    turnOrder: cities.map((_, i) => i as 0 | 1 | 2 | 3 | 4 | 5 | 6),
    currentPhase: 'development', currentPlayer: 0,
    year: 1, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [], autoReject: [], log: [],
  };
}

describe('checkEndOfGame', () => {
  it('returns null when no player meets citiesToWin', () => {
    const s = stateWith([0, 0, 1, 1, 2], [2, 1, 0]);
    expect(checkEndOfGame(s)).toBeNull();
  });

  it('returns winner when one player has citiesToWin and is unique max', () => {
    // citiesToWin = 5; place 5 cities on player 0 territories
    const owners = [0, 0, 0, 0, 0, 1, 1];
    const s = stateWith(owners, [5, 1, 0]);
    expect(checkEndOfGame(s)).toBe(0);
  });

  it('returns null when tied at top (even if both reach citiesToWin)', () => {
    const owners = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1];
    const s = stateWith(owners, [5, 5, 0]);
    expect(checkEndOfGame(s)).toBeNull();
  });

  it('returns winner when one player owns all territories', () => {
    const owners = [0, 0, 0, 0, 0];
    const s = stateWith(owners, [0, 0, 0]);
    expect(checkEndOfGame(s)).toBe(0);
  });

  it('returns null when not all territories owned by same player and no city-winner', () => {
    const owners = [0, 0, 1, 1];
    const s = stateWith(owners, [1, 1]);
    expect(checkEndOfGame(s)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/checkEndOfGame.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/checkEndOfGame.ts`**

```ts
import type { GameState, PlayerId } from './types.js';

// Mirrors LocApplet.checkEndOfGame L3033-L3074. Returns winner's PlayerId, or null.
// Rules (in order):
//  1. Per-player count cities. If unique player has the most cities AND that count
//     >= citiesToWin, they win.
//  2. Otherwise (no city-winner), if all territories belong to the same player,
//     they win.
//  3. Otherwise, no winner.
export function checkEndOfGame(state: GameState): PlayerId | null {
  const cities: number[] = new Array<number>(state.players.length).fill(0);
  for (const t of state.territories) {
    if (t.ownerId !== null && t.hasCity) cities[t.ownerId] = (cities[t.ownerId] ?? 0) + 1;
  }
  let winner: PlayerId | null = null;
  let maxCount = state.setup.citiesToWin - 1;
  for (let p = 0; p < cities.length; p++) {
    const c = cities[p]!;
    if (c > maxCount) { winner = p as PlayerId; maxCount = c; }
    else if (c === maxCount) { winner = null; }
  }
  if (winner !== null) return winner;
  // Fallback: all territories owned by same player
  const firstOwner = state.territories[0]?.ownerId;
  if (firstOwner === null || firstOwner === undefined) return null;
  for (const t of state.territories) {
    if (t.ownerId !== firstOwner) return null;
  }
  return firstOwner;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/checkEndOfGame.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/checkEndOfGame.ts tests/checkEndOfGame.test.ts
git commit -m "Add checkEndOfGame: cities majority + all-territories victory detection"
```

---

## Task 21: `applyYearWrap` helper — eliminate, rotate, year++, clear year-scoped state

**Files:**
- Create: `src/game/reducers/yearWrap.ts`
- Create: `tests/reducers/yearwrap.test.ts`

Reference: spec §"Year wrap-up" + LocApplet L2975–L3010.

Sequence:
1. Rotate `turnOrder` by 1: last player goes first (`[a, b, c] → [c, a, b]`).
2. Eliminate any player with `terrCount === 0`: set `players[id].status = 'eliminated'`, splice from `turnOrder`.
3. `year++`.
4. Clear: `autoReject` (rebuild as N×N false), `rejectedTrades = []`, `shipmentForfeitsSecondAttack = [false × N]`.
5. `currentPhase = 'production'`, `currentPlayer = turnOrder[0]`, `attackNumber = 1`, `shipmentUsed = false`, `pendingCombat = null`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { applyYearWrap } from '../../src/game/reducers/yearWrap.js';
import type { GameState, GameSetup, Territory } from '../../src/game/types.js';

function makeState(turnOrder: number[], terrOwners: Array<number | null>): GameState {
  const territories: Territory[] = terrOwners.map((own, id) => ({
    id, ownerId: own as 0 | 1 | 2 | 3 | 4 | 5 | 6 | null,
    resource: null, hasCity: false, hasWeapon: false, hasHorse: false,
    hasStockpile: false, hasResourceDouble: false,
    squares: [], bordersLakes: new Set<number>(), citiesAdjacent: 0,
  }));
  const N = turnOrder.length;
  return {
    schemaVersion: 1, seed: 0, rngCursor: 0,
    setup: {
      players: turnOrder.map((_, i) => ({
        color: (['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const)[i]!,
        name: `p${i}`, persona: 'human',
      })),
      citiesToWin: 5, elementOfChance: 'high', randomizePlayerOrder: false,
      map: { waterBoundary: true, waterArea: 'small', numTerritories: territories.length,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' } },
    },
    squares: [], territories, touching: [], distance: [],
    boats: [], players: turnOrder.map((_, i) => ({
      id: i as 0 | 1 | 2 | 3 | 4 | 5 | 6, name: `p${i}`,
      color: (['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const)[i]!,
      persona: 'human', status: 'playing',
      stockpile: [0, 0, 0, 0, 0], stockpileLocation: null,
    })),
    turnOrder: turnOrder as Array<0 | 1 | 2 | 3 | 4 | 5 | 6>,
    currentPhase: 'development', currentPlayer: turnOrder[0]! as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    year: 1, attackNumber: 1, shipmentUsed: false,
    shipmentForfeitsSecondAttack: [true, false, true],
    pendingTrade: null, pendingCombat: null,
    rejectedTrades: [{ trader: 0, tradee: 1, tradeKey: 'k', count: 2 }],
    autoReject: [[false, true, false], [true, false, false], [false, false, false]],
    log: [],
  };
}

describe('applyYearWrap', () => {
  it('rotates turnOrder by 1 (last → first)', () => {
    const s = makeState([0, 1, 2], [0, 1, 2, 0, 1, 2]);
    const out = applyYearWrap(s);
    expect(out.turnOrder).toEqual([2, 0, 1]);
    expect(out.currentPlayer).toBe(2);
  });

  it('eliminates players with no territories', () => {
    const s = makeState([0, 1, 2], [0, 0, 0, 1, 1]); // player 2 has no territories
    const out = applyYearWrap(s);
    expect(out.players[2]!.status).toBe('eliminated');
    expect(out.turnOrder).not.toContain(2);
  });

  it('increments year', () => {
    const s = makeState([0, 1, 2], [0, 1, 2]);
    const out = applyYearWrap(s);
    expect(out.year).toBe(s.year + 1);
  });

  it('clears year-scoped state', () => {
    const s = makeState([0, 1, 2], [0, 1, 2]);
    const out = applyYearWrap(s);
    expect(out.rejectedTrades).toEqual([]);
    expect(out.autoReject).toEqual([[false, false, false], [false, false, false], [false, false, false]]);
    expect(out.shipmentForfeitsSecondAttack).toEqual([false, false, false]);
  });

  it('transitions to production phase, attackNumber 1, no pending combat', () => {
    const s = makeState([0, 1, 2], [0, 1, 2]);
    const out = applyYearWrap(s);
    expect(out.currentPhase).toBe('production');
    expect(out.attackNumber).toBe(1);
    expect(out.shipmentUsed).toBe(false);
    expect(out.pendingCombat).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/yearwrap.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/reducers/yearWrap.ts`**

```ts
import type { GameState, PlayerId } from '../types.js';

export function applyYearWrap(prev: GameState): GameState {
  // 1. Rotate turnOrder by 1 (last player goes first)
  const t = prev.turnOrder;
  const rotated: PlayerId[] = t.length > 0 ? [t[t.length - 1]!, ...t.slice(0, -1)] : [];

  // 2. Compute terrCount per player; eliminate zero-territory players
  const terrCount = new Map<PlayerId, number>();
  for (const tt of prev.territories) {
    if (tt.ownerId !== null) terrCount.set(tt.ownerId, (terrCount.get(tt.ownerId) ?? 0) + 1);
  }
  const surviving = rotated.filter((p) => (terrCount.get(p) ?? 0) > 0);
  const players = prev.players.map((p) =>
    (terrCount.get(p.id) ?? 0) === 0 ? { ...p, status: 'eliminated' as const } : p);

  const N = prev.players.length;
  // 3. year++
  // 4. Clear year-scoped state
  const autoReject: boolean[][] = Array.from(
    { length: N }, () => new Array<boolean>(N).fill(false));
  const shipmentForfeitsSecondAttack = new Array<boolean>(N).fill(false);

  return {
    ...prev,
    players,
    turnOrder: surviving,
    currentPhase: 'production',
    currentPlayer: surviving[0]!,
    year: prev.year + 1,
    attackNumber: 1,
    shipmentUsed: false,
    shipmentForfeitsSecondAttack,
    pendingTrade: null,
    pendingCombat: null,
    rejectedTrades: [],
    autoReject,
    log: [
      ...prev.log,
      { year: prev.year + 1, phase: 'production', player: surviving[0]!,
        message: `Year ${prev.year + 1} begins` },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/yearwrap.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/yearWrap.ts tests/reducers/yearwrap.test.ts
git commit -m "Add applyYearWrap: rotate, eliminate, year++, clear year-scoped state"
```

---

## Task 22: Wire `endPhase` from development to year-wrap with end-of-game

**Files:**
- Modify: `src/game/reducers/endPhase.ts`
- Create: `tests/reducers/endgame.test.ts`

Replace the provisional year-wrap branch in `case 'development':` with:
1. Run `checkEndOfGame`. If winner, transition to `gameOver` phase.
2. Otherwise, call `applyYearWrap`.

- [ ] **Step 1: Write the failing test** (`tests/reducers/endgame.test.ts`):

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
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

function devEndState(): GameState {
  let s = reduce(initial(), { kind: 'newGame', setup, seed: 107 });
  while (s.territories.some((t) => t.ownerId === null)) {
    const free = s.territories.find((t) => t.ownerId === null)!;
    s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
  }
  s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  s = { ...s, currentPhase: 'development', currentPlayer: s.turnOrder[0]! };
  return s;
}

describe('endPhase: development → year wrap or game-over', () => {
  it('triggers gameOver when winner exists at year wrap', () => {
    let s = devEndState();
    // Place 3 cities on player 0 territories
    let placed = 0;
    s.territories.forEach((t) => {
      if (t.ownerId === 0 && placed < 3) { t.hasCity = true; placed++; }
    });
    for (let i = 0; i < s.players.length; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(s.currentPhase).toBe('gameOver');
    // Winner is player 0
    const lastLog = s.log[s.log.length - 1]!;
    expect(lastLog.message).toMatch(/won|winner/i);
  });

  it('runs year wrap when no winner', () => {
    let s = devEndState();
    const startYear = s.year;
    for (let i = 0; i < s.players.length; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(s.currentPhase).toBe('production');
    expect(s.year).toBe(startYear + 1);
    // turnOrder should rotate (last → first)
    // (start was [0,1,2] reversed by selection → [2,1,0]; after wrap → [0,2,1])
    expect(s.turnOrder[0]).not.toBe(2);
  });

  it('eliminates a player with zero territories', () => {
    let s = devEndState();
    // Reassign every territory away from player 2
    s.territories.forEach((t) => {
      if (t.ownerId === 2) t.ownerId = 0;
    });
    for (let i = 0; i < s.players.length; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    expect(s.players[2]!.status).toBe('eliminated');
    expect(s.turnOrder).not.toContain(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reducers/endgame.test.ts`
Expected: FAIL — provisional wrap doesn't run game-over check.

- [ ] **Step 3: Replace `case 'development':` wrap branch**

In `src/game/reducers/endPhase.ts`, replace the Task 19 provisional wrap branch with:

```ts
import { checkEndOfGame } from '../checkEndOfGame.js';
import { applyYearWrap } from './yearWrap.js';

// Inside case 'development': in the wrap branch (nextIdx === 0), replace the provisional return with:
      const winner = checkEndOfGame(prev);
      if (winner !== null) {
        return {
          ...prev,
          currentPhase: 'gameOver',
          log: [
            ...prev.log,
            { year: prev.year, phase: 'gameOver', player: winner,
              message: `Player ${winner} won the game (year ${prev.year})` },
          ],
        };
      }
      return applyYearWrap(prev);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reducers/endgame.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducers/endPhase.ts tests/reducers/endgame.test.ts
git commit -m "endPhase: development wrap runs checkEndOfGame and applyYearWrap"
```

---

## Task 23: Snapshot test — full year sequence

**Files:**
- Create: `tests/snapshots/full-year.test.ts`

Walk through one complete year: NEW_GAME → selection → production → trade → shipment → conquest → development → year wrap (or game-over). Assert state is in production phase of year 2 (or gameOver).

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
  ],
  citiesToWin: 8, elementOfChance: 'high', randomizePlayerOrder: false, // 8 = unreachable
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24,
    islands: 'some', shapes: 'regular',
    resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

describe('full-year snapshot', () => {
  it('walks through one complete year ending in production of year 2', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 12345 });
    while (s.territories.some((t) => t.ownerId === null)) {
      const free = s.territories.find((t) => t.ownerId === null)!;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    expect(s.currentPhase).toBe('production');
    s = reduce(s, { kind: 'production' });
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });

    // Drain trade if entered
    if (s.currentPhase === 'trade') {
      for (let i = 0; i < s.players.length; i++) {
        s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      }
    }
    // Drain shipment if entered
    if (s.currentPhase === 'shipment') {
      for (let i = 0; i < s.players.length; i++) {
        s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      }
    }
    // Drain conquest (each player up to 2 attacks)
    expect(s.currentPhase).toBe('conquest');
    for (let i = 0; i < s.players.length * 2; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      if (s.currentPhase !== 'conquest') break;
    }
    expect(s.currentPhase).toBe('development');
    // Drain development
    for (let i = 0; i < s.players.length; i++) {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    }
    // Year 2 production OR gameOver
    expect(['production', 'gameOver']).toContain(s.currentPhase);
    if (s.currentPhase === 'production') {
      expect(s.year).toBe(2);
    }
  });

  it('runs 3 years with no actions and reaches year 4 production', () => {
    let s = reduce(initial(), { kind: 'newGame', setup, seed: 9999 });
    while (s.territories.some((t) => t.ownerId === null)) {
      const free = s.territories.find((t) => t.ownerId === null)!;
      s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
    }
    s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
    for (let yr = 0; yr < 3; yr++) {
      // production tick
      s = reduce(s, { kind: 'production' });
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      // trade phase
      if (s.currentPhase === 'trade') {
        for (let i = 0; i < s.players.length; i++) {
          s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
        }
      }
      // shipment phase
      if (s.currentPhase === 'shipment') {
        for (let i = 0; i < s.players.length; i++) {
          s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
        }
      }
      // conquest (2 attacks × N players)
      while (s.currentPhase === 'conquest') {
        s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      }
      // development
      while (s.currentPhase === 'development') {
        s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      }
    }
    // Should now be in production of year 4 (or gameOver — citiesToWin=8 means unlikely)
    expect(['production', 'gameOver']).toContain(s.currentPhase);
    if (s.currentPhase === 'production') expect(s.year).toBe(4);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- tests/snapshots/full-year.test.ts`
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/snapshots/full-year.test.ts
git commit -m "Add full-year snapshot test (production through year wrap)"
```

---

## Task 24: Extend `play-game` CLI to drive multi-year simulation

**Files:**
- Modify: `src/cli/playGame.ts`

Replace the final part of the CLI (after the existing trade/shipment driving) with a loop that runs through conquest, development, and year wraps. Drive 3 years with no scripted actions (just endPhase to drain phases) and print a year-by-year summary.

- [ ] **Step 1: Update `src/cli/playGame.ts`**

Replace the closing section (currently ending with `console.log(\`\\nFinal phase reached: ...\`)` and the year-scoped log entries) with:

```ts
// --- Drive multi-year simulation ---
const TARGET_YEAR = 3;
console.log(`\n--- Driving simulation to year ${TARGET_YEAR + 1} ---`);

while (s.year <= TARGET_YEAR && s.currentPhase !== 'gameOver') {
  const yearAtStart = s.year;
  const phaseAtStart = s.currentPhase;
  switch (s.currentPhase) {
    case 'production': {
      s = reduce(s, { kind: 'production' });
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      break;
    }
    case 'trade':
    case 'shipment':
    case 'conquest':
    case 'development': {
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
      break;
    }
    default:
      // setup / selection / gameOver
      s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });
  }
  if (s.year !== yearAtStart) {
    console.log(`  year ${yearAtStart} → ${s.year}; phase ${phaseAtStart} → ${s.currentPhase}`);
  }
}

console.log(`\nFinal phase reached: ${s.currentPhase} (year ${s.year})`);
console.log(`Total log entries: ${s.log.length}`);
```

- [ ] **Step 2: Smoke-test the CLI**

Run: `npm run play-game -- --seed 12345`
Expected: prints existing output (selection + production + trade + shipment), then year transitions through year 1 → 2 → 3 → 4, ending at production of year 4 OR gameOver.

- [ ] **Step 3: Commit**

```bash
git add src/cli/playGame.ts
git commit -m "Extend play-game CLI to drive multi-year simulation"
```

---

## Task 25: Final verification

**Files:** none.

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass. Tally should be ≥ 290 (was 248 after Plan 3; +~50 from this plan).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run all CLIs**

```bash
npm run gen-map -- --seed 12345
npm run play-game -- --seed 12345
npm run save-load-smoke 12345
```

Expected: all complete without error. play-game drives ≥ 3 years.

No commit for this task.

---

## Self-review notes

- **Spec coverage:**
  - Conquest phase: ✓ (Tasks 4–14) — attack with bring-forces, allies, resolve at all 3 chance levels, post-attack effects (territory + boats + items + stockpile + activation), loss cleanup, auto-prevent-suicide.
  - Development phase: ✓ (Tasks 16–18) — buildCity (+ activation sweep), buildWeapon, buildBoat (uses Plan 3's addBoat).
  - Year wrap: ✓ (Tasks 21–22) — eliminate, rotate, year++, clear year-scoped state, transition to production.
  - End-of-game: ✓ (Task 20) — citiesToWin majority + all-territories check.
  - 2nd-attack forfeit (Plan 3 carryover): ✓ (Task 15) — `shipmentForfeitsSecondAttack[player]` consumed at conquest endPhase to skip attack #2.
  - Combat strength formula: ✓ (Tasks 1, 2) — uses Plan 2's `getForceCount` correctly.
  - Bring-forces additions: ✓ (Task 4) — boat +2, non-touching horse +1, non-touching weapon +3.

- **Deliberately deferred to Plan 5+:**
  - AI brain (`getStockpilePoints`, `getTradeUtility`, `getConquestUtility`, `getShipmentUtility`, `decideAlliesAction`, persona short-circuits).
  - UI (Plan 6).
  - "Conquest auto-prevent-suicide for AI" — the rule applies but Plan 4 only enforces the engine validation; AI plan-generation in Plan 5 will check it before proposing attacks.
  - Conquest-phase between-attacks moveStockpile (per LocApplet.java L2103). Plan 3 placed shipStockpile in Shipment with the forfeit flag, which approximates the rule. Plan 5/6 may add the explicit conquest-phase variant for UI completeness.
  - "Brought weapon must be within 1 hop" — Plan 4 enforces adjacency. The Java's L6646 distance check could allow up to 1-hop owned-chain (matches "adjacent owned"); current implementation matches that.

- **No placeholders.** Every task has full code or full commands.

- **Type consistency.** All Plan 4 functions match the discriminated-union shapes defined in Plan 2's `plans.ts`. The new `applyPostAttackWin` and `applyPostAttackLoss` are private to `conquest.ts`. `applyYearWrap` lives in its own file and is invoked from `endPhase.ts`. `checkEndOfGame` is in its own file.

- **Commit cadence.** 24 commits (Tasks 1–24 each commit; Task 25 is verification only).
