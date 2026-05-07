# AI Brain Design — Plan 5

**Status:** Approved (2026-05-07). Ready for implementation plan.

**Goal:** Verbatim TypeScript port of `LocAI.java`'s structurally-encoded persona AI, exposed as pure functions in `src/game/ai/`. After Plan 5, the engine is fully self-driving — a CLI run with all-AI players plays a complete game from setup to game-over.

**Non-goals:** UI animation pacing (`AI_THINK_PAUSE_MS`); novel AI strategies (we faithfully port LocAI's behavior); persistence-format changes.

**Reference:** `LocAI.java` (gitignored at `.reference/decompiled/`) and the AI sections of the engine spec (`docs/superpowers/specs/2026-05-06-clean-room-port-design.md` §AI lines 586–645 and §Appendix lines 817–911).

## Architecture

All AI is **pure**: each function takes `(GameState, ...args)` and returns a `Plan` (or a primitive). RNG-free — AI decisions are deterministic given input state. The engine is unchanged; the AI is a sibling module.

```
src/game/ai/
├── decideAction.ts         # top-level switch on currentPhase → calls per-phase fn
├── runAITurn.ts            # driver loop: while currentPlayer is AI, decideAction → reduce
├── personas.ts             # persona short-circuit predicates
├── selection.ts            # decideSelectionAction (LocAI L2800–L2925)
├── trade.ts                # getProposedTradePlan (L801–L1014), decideTradeAction (L1016–L1038)
├── shipment.ts             # decideShipmentAction (L2386–L2533)
├── conquest.ts             # decideConquestAction (L1701–L1990), decideAlliesAction (L1530–L1615)
├── development.ts          # decideDevelopmentAction (L172–L624)
├── scoring/
│   ├── stockpilePoints.ts  # getStockpilePoints (L1274–L1308)
│   ├── tradeUtility.ts     # getTradeUtility (L1310–L1528)
│   ├── conquestUtility.ts  # getConquestUtility (L1992–L2384)
│   ├── shipmentUtility.ts  # getShipmentUtility (L2535–L2726)
│   ├── developmentUtility.ts  # getDevelopmentUtility (L631–L799)
│   └── horseMoveUtility.ts # getHorseMoveUtility, getTerrNoHorseToRemove, getTerrNoHorseToPlace (L1040–L1272)
├── bfPossible.ts           # getBFPossible (L109–L170)
├── powerRating.ts          # getPowerRatingForPl (L1617–L1699)
└── index.ts                # public exports: decideAction, runAITurn, decideTradeAction, decideAlliesAction
```

**Public API (from `src/game/ai/index.ts`):**

```ts
// Top-level dispatch. Returns the plan the AI wants the engine to apply now.
export function decideAction(state: GameState, player: PlayerId): Plan;

// Driver loop: applies AI plans repeatedly until current player becomes human
// or the game ends. Auto-resolves AI tradees (pendingTrade) and AI allies
// (pendingCombat.alliesPending) along the way.
export function runAITurn(state: GameState): GameState;

// Engine-direct entry points the engine emits when waiting on an answer.
export function decideTradeAction(state: GameState, player: PlayerId, offer: TradeOffer): boolean;
export function decideAlliesAction(state: GameState, player: PlayerId, combat: CombatState):
  'attacker' | 'neutral' | 'defender';
```

`decideAction` switches on `state.currentPhase`:

| Phase | Function | Plan kinds it can emit |
|---|---|---|
| `selection` | `decideSelectionAction` | `selection` |
| `production` | (no AI choice — emits `production` directly) | `production` |
| `trade` | `getProposedTradePlan` | `trade` or `endPhase` |
| `shipment` | `decideShipmentAction` | `shipStockpile` / `shipHorse` / `shipWeapon` / `shipBoat` / `endPhase` |
| `conquest` | `decideConquestAction` | `attack` or `endPhase` |
| `development` | `decideDevelopmentAction` | `buildCity` / `buildWeapon` / `buildBoat` / `endPhase` |
| `gameOver` / `setup` | (caller error — `runAITurn` exits before reaching here) | — |

## Persona short-circuits

Read `state.players[player].persona`. Behavior in each phase:

| Persona | Selection | Trade | Shipment | Conquest | Development | `decideTradeAction` | `decideAlliesAction` |
|---|---|---|---|---|---|---|---|
| `passive` | normal scoring | `endPhase` | `endPhase` | `endPhase` | `endPhase` | always `false` | always `'neutral'` |
| `defensive` | normal scoring | normal scoring | normal scoring | gated: only attack if `att > def` strictly OR city-block scenario | normal scoring | normal scoring | normal scoring |
| `aggressive` | normal scoring | normal scoring | normal scoring | normal scoring (attack on `att >= def` and positive utility) | normal scoring + 2 fallback heuristics (try-build-boat, try-build-weapon) | normal scoring | normal scoring |
| `human` | — | — | — | — | — | — | — |

`human` is never invoked: `runAITurn` exits when current player is human, and the engine doesn't emit pendingTrade / pendingCombat to AI for a human player.

The "city-block scenario" (defensive only) per LocAI L1822–L1825: defender is the leader, has `citiesToWin - 1` cities, and the target territory has the city that would put them over.

## Per-phase methods

### `decideSelectionAction` (LocAI L2800–L2925)

Score every unowned territory with:

```
score = ptResource[r]                          if r != null
      + ptFirstOfType                          if r is the first of its type the player would own
      + ptIronAndCoal                          if owning r would balance iron/coal
      + ptOneOfEach                            if r is the minimum among owned counts
      + ptTouchTerr × (number of touching territories the player owns)
      + ptTouchTerrWResource × (number of touching territories with resources)
      + ptTouchOwnTerr × ...
      + ptTouchOwnTerrWResource × ...
      + ptTerrVulnerable × (force-count vulnerability factor)
```

Pick max-score territory. Emit `{ kind: 'selection', player, territoryId }`.

The LocAI stockpile-locate sub-action is **folded into selection scoring** rather than introducing a separate phase — the same factors (force advantage, enemy boat potential, distance-2 horse rush, +3 safe-spot bonus) are added to selection scores when the engine prompts for the player's first owned territory (see Plan 2 selection logic).

### `getProposedTradePlan` (LocAI L801–L1014)

Compute own `BFPossible` (cached for this `decideAction` call) and `getPowerRatingForPl(state, self)`. For each opponent `o`:

1. Compute fairness `f` = `getPowerRatingForPl(state, self) / getPowerRatingForPl(state, o)` (clamped per LocAI logic).
2. Enumerate iron/coal-balancing trades: my surplus iron ↔ their surplus coal (and vice versa), capped at slot maxima.
3. Enumerate generic offers up to 3-vs-3: every combination of `(my-give, their-give)` where `give[i] ∈ {0,1,2,3}` and `sum(give) ≤ 3` per side. Approx 3000 candidates per opponent (5 slots × 4 quantities).
4. For each candidate, compute `getTradeUtility(state, plan, f, BFPossible)` from MY perspective. Skip if `< 0`.
5. Predict opponent acceptance: compute `getTradeUtility` from their perspective with their fairness; accept if `> 0`.
6. Pick the candidate that maximizes my utility AND would be accepted.

If no candidate passes, return `{ kind: 'endPhase', player }`. Otherwise emit `{ kind: 'trade', proposer, tradee: o, give, receive }`.

### `decideTradeAction(state, player, offer)` (LocAI L1016–L1038)

Compute `f` (fairness from `player`'s perspective vs. proposer). Return `getTradeUtility(state, offer-as-receiver, f, BFPossible) > 0`.

### `decideShipmentAction` (LocAI L2386–L2533)

Enumerate moves:
- **Stockpile relocation:** for each owned territory `t` with `t.id !== player.stockpileLocation`, candidate `{ kind: 'shipStockpile', from: stockpileLocation, to: t.id }`.
- **Horse 1-hop:** for each `(from, to)` where `from.hasHorse && to ∈ touching(from) && to.ownerId === player`, candidate `shipHorse`.
- **Horse 2-hop:** for each owned `restStop` adjacent to both `from` and `to` (both owned), candidate `shipHorse` with `restStop`.
- **Weapon 1-hop:** symmetric to horse 1-hop.
- **Boat:** for each owned boat, candidate water destinations on the same lake; with optional `pickUpHorseFrom` / `pickUpWeaponFrom` from adjacent owned territories.

Score each via `getShipmentUtility`. Pick max if `> 0`; else emit `endPhase`.

### `decideConquestAction` (LocAI L1701–L1990)

1. Build `alliesMatrix[targetTerr][opponent]` = predicted `decideAlliesAction` for each potential target. Recursive call into `decideAlliesAction` for each non-attacker non-defender.
2. For each potential attack target (adjacent enemy/unowned tile, plus boat-reachable tiles), enumerate attack plans:
   - Plain (no brought units).
   - With each adjacent owned horse (within 2 hops via owned chain).
   - With each adjacent owned weapon.
   - Combinations: horse + weapon, boat + horse, boat + weapon, boat + horse + weapon.
3. For each plan, compute `getConquestUtility(state, plan, BFPossible, alliesMatrix)`. The utility folds in the win/loss expected-value via Element of Chance (closed-form for High via `LocProb.probSuccess`).
4. Apply persona gate:
   - `aggressive`: pick max-utility plan if `> 0`; else `endPhase`.
   - `defensive`: pick max-utility plan only if `att > def` strictly OR city-block scenario; else `endPhase`.
5. Skip auto-suicide-prevented attacks (engine would reject; AI pre-filters via `isAutoPreventSuicide` from `combat.ts`).

### `decideAlliesAction(state, player, combat)` (LocAI L1530–L1615)

Branch:
- If defender is unowned (natives): always `'neutral'`.
- If the attack would block a city-win (attacker's win pushes them to `citiesToWin`): help defender (`'defender'`).
- Else: power-rating delta with `ptRatingsBoundary = 50` thresholds:
  - If attacker's power-rating > defender's by ≥ 50: `'defender'` (cut down the leader).
  - If defender's power-rating > attacker's by ≥ 50: `'attacker'`.
  - Else: `'neutral'`.

### `decideDevelopmentAction` (LocAI L172–L624)

Budget loop (max 100 iterations to avoid runaway):

For each owned territory, evaluate 4 candidate plan bundles:
- just-weapons
- city + weapons
- boat + weapons
- boat + city + weapons

(Each bundle is a sequence of build plans for that territory — e.g. "build city, build weapon" if both fit the budget.)

Score each via `getDevelopmentUtility`. Pick max-utility bundle across all (territory, bundle) combinations where the player can afford the next build (resource OR gold path).

Aggressive fallback: if no positive-utility plan was found AND the player has resources for any boat or weapon build, emit that build (try boat first, then weapon).

If still no plan, emit `endPhase`.

## Scoring helpers

All scoring functions are pure, take `BFPossible` as input where needed, and reference constants from `src/game/aiConstants.ts` (already populated in Plan 1).

| Helper | Returns | LocAI source |
|---|---|---|
| `getBFPossible(state, player)` | `number[][]` shape `[numTerr][7]` — max enemy battle force reachable to each terr per opponent | L109–L170 |
| `getPowerRatingForPl(state, player, attackPlan?)` | `number` | L1617–L1699 |
| `getStockpilePoints(state, player, stockpile, BFPossible)` | `number` | L1274–L1308 |
| `getDevelopmentUtility(state, planBundle, BFPossible)` | `number` | L631–L799 |
| `getTradeUtility(state, plan, fairness, BFPossible)` | `number` (includes kingmaker bonus and horse-trade penalty) | L1310–L1528 |
| `getConquestUtility(state, plan, BFPossible, alliesMatrix)` | `number` | L1992–L2384 |
| `getShipmentUtility(state, plan, BFPossible)` | `number` | L2535–L2726 |
| `getHorseMoveUtility`, `getTerrNoHorseToRemove`, `getTerrNoHorseToPlace` | `number` | L1040–L1272 |

**Constants** (already in `src/game/aiConstants.ts`):

```
ptCity = 8                ptOppWinCity = -10000
ptStockpile = 15          ptRatingsBoundary = 50
ptCanBuildCity = 8        ptCanBuildWeapon = 3        ptCanBuildBoat = 2
ptResource = [7, 7, 7, 9, 7]  // by ResourceCode 0..4
ptOneOfEach = 2           ptIronAndCoal = 2           ptFirstOfType = 3
ptTouchTerr = 1           ptTouchTerrWResource = 2
ptTouchOwnTerr = 1        ptTouchOwnTerrWResource = 2
ptTerrVulnerable = -5
ptFCAdvOwnTerr = 1        ptFCAdvOppTerr = 1          ptFCAdvStockpile = 1
ptFCDisOwnTerr = -5       ptFCDisOppTerr = -3         ptFCDisStockpile = -5
ptVulnerableHorse = -2    ptVulnerableWeapon = -6
ptVulnerableBoat = -4     ptVulnerableCity = -8
ptGroupHorseWeapon = 1    ptGroupBoatHW = 1
ptOwnForceCount = 1       ptOppForceCount = -1
ptOppBoatPotential = -6   ptExistingHorses = 1        ptOppCity = -8
```

## Driver loop

`runAITurn(state)` resolves any pending engine state first (AI tradees and AI allies), then runs `decideAction` → `reduce` until current player is human or game ends.

```ts
export function runAITurn(state: GameState): GameState {
  let s = state;
  let iter = 0;
  const MAX_ITER = 1000;
  while (iter++ < MAX_ITER) {
    if (s.currentPhase === 'gameOver') return s;

    // Pending trade: auto-respond if tradee is AI.
    if (s.pendingTrade && s.pendingTrade.status === 'proposed') {
      const tradee = s.pendingTrade.tradeeId;
      if (s.players[tradee].persona === 'human') return s;
      const accept = decideTradeAction(s, tradee, s.pendingTrade);
      s = reduce(s, { kind: 'tradeResponse', accept });
      continue;
    }

    // Pending combat allies: auto-decide for each AI ally.
    if (s.pendingCombat && !s.pendingCombat.resolved) {
      const pendingNonHuman = [...s.pendingCombat.alliesPending]
        .find((p) => s.players[p].persona !== 'human');
      if (pendingNonHuman !== undefined) {
        const choice = decideAlliesAction(s, pendingNonHuman, s.pendingCombat);
        s = reduce(s, { kind: 'alliesDecision', player: pendingNonHuman, choice });
        continue;
      }
      if (s.pendingCombat.alliesPending.size === 0) {
        s = reduce(s, { kind: 'resolveCombat' });
        continue;
      }
      return s; // human ally still pending
    }

    // Normal turn: skip if current player is human.
    if (s.players[s.currentPlayer].persona === 'human') return s;

    // Production has no AI choice — emit it directly.
    if (s.currentPhase === 'production') {
      s = reduce(s, { kind: 'production' });
      continue;
    }

    const plan = decideAction(s, s.currentPlayer);
    s = reduce(s, plan);
  }
  throw new Error('runAITurn exceeded MAX_ITER — likely a no-progress bug');
}
```

**Why pending state first:** AI tradees and AI allies must respond before turn flow continues. If the active player is human and they emit `attack`, the loop wakes up to handle AI allies, then exits if the human is still active or all combat is resolved.

**Production exception:** when `currentPhase === 'production'` for an AI player, `runAITurn` emits `{ kind: 'production' }` directly. This is not in `decideAction`'s switch — it's handled in the loop because production is engine-driven and the AI has no input.

## Testing

Three layers, all in `tests/ai/`:

### Unit tests per scoring helper

Each scoring function gets its own test file with hand-crafted minimal `GameState` fixtures and known expected values from the LocAI cited line range. Approx 40–60 unit tests covering:
- `getStockpilePoints` for each of the 4 build paths (city, weapons, boats, horses) and each persona
- `getTradeUtility` for kingmaker bonus, horse penalty, fairness factor
- `getConquestUtility` for each Element of Chance and force-balance branch
- `getShipmentUtility` for each move kind
- `getDevelopmentUtility` for the 4 bundle types
- `getBFPossible` for trivial 2-territory and 4-territory boards
- `getPowerRatingForPl` for known stockpile+territory configurations

### Persona-branch invariants

`tests/ai/personas.test.ts`: for each persona, fix a state and assert `decideAction` outcomes:
- `passive`: returns `endPhase` for trade/shipment/conquest/development; `decideTradeAction` returns `false`; `decideAlliesAction` returns `'neutral'`.
- `aggressive` vs. `defensive` divergence: in `att > def` state both attack; in `att == def` state aggressive attacks but defensive ends phase.
- `aggressive` Dev fallback: state with no positive-utility build but boat-buildable resources → emits `buildBoat`.

### Self-play smoke

`tests/ai/self-play.test.ts`: 7 AI players (mix of personas), 5 known seeds, run `runAITurn` repeatedly until game-over OR year-30 cap. Assertions:
- No exceptions across all 5 seeds.
- Game reaches `'gameOver'` within 30 years for at least 3/5 seeds.
- RNG cursor advances monotonically (no decrement).
- Eliminated players never re-enter `turnOrder`.
- All 5 seeds' games are deterministic (run twice with same seed → identical final state).

## CLI extension

`src/cli/playGame.ts` currently runs 3 years with no AI actions. Plan 5 replaces the simulation loop body with `runAITurn(state)`. With all-AI player setup:

```
Year 1: production → trade → shipment → conquest → development
  (Red attacks T7 from T3, succeeds; Blue builds city on T12; ...)
Year 2: ...
...
Game over: Blue wins (year 7) with 5 cities.
```

Print year-by-year city counts, attack outcomes (won/lost), eliminations, and the winner.

No new CLI is needed — `play-game --seed N` becomes a self-play simulator. `save-load-smoke` is unchanged (AI doesn't add state fields).

## Risk callouts

- **Trade enumeration size:** `getProposedTradePlan` evaluates ~3000 candidates per opponent (5 slots × 4 quantities × 5 slots × 4 quantities). With 7 players that's ~18000 evaluations per AI's trade turn. Each `getTradeUtility` is constant-time. If self-play smoke shows this is slow, add memoization in a follow-up; not in scope for Plan 5.
- **Cross-AI lookahead acyclicity:** `getProposedTradePlan` predicts opponent acceptance via `getTradeUtility` (a scoring fn), not by recursively calling `getProposedTradePlan`. `decideConquestAction` predicts allies via `decideAlliesAction` (which doesn't call back into `decideConquestAction`). Call graph is acyclic — no recursion guards needed.
- **Persona-branch test flakiness:** behavioral invariants depend on specific seeds producing specific maps. If a seed change makes a fixture not produce the expected configuration, tests degrade silently. Each persona invariant test should `expect(<fixture>).toBeDefined()` rather than `if (!fixture) return;`.

## Out of scope (deferred to Plan 6 or later)

- AI animation pacing (`AI_THINK_PAUSE_MS = 1000`). The AI itself is synchronous; UI inserts the pause.
- Trade-proposal dialogue ordering for the UI's trade panel — headless AI iterates non-self players in `turnOrder`.
- Selection AI for the "place initial stockpile" sub-step that the original UI surfaces — folded into `decideSelectionAction`'s scoring.
- Performance optimization for the trade enumeration — only address if self-play smoke shows a problem.

## Plan 5 task summary

~50 tasks across 7 categories:

1. **AI infrastructure** (3 tasks): `personas.ts`, `decideAction.ts` skeleton, `runAITurn.ts` driver with pending-state handling.
2. **Foundational helpers** (4 tasks): `getBFPossible`, `getPowerRatingForPl`, `getStockpilePoints`, plus shared utilities.
3. **Selection + Development** (~10 tasks): selection scoring + diversity bonuses, `decideSelectionAction`, `getDevelopmentUtility`, `decideDevelopmentAction` with aggressive fallbacks.
4. **Trade** (~10 tasks): `getTradeUtility` with kingmaker + horse penalty, `getProposedTradePlan` enumeration, `decideTradeAction`.
5. **Shipment** (~6 tasks): `getShipmentUtility`, horse-move helpers, `decideShipmentAction` enumeration.
6. **Conquest + Allies** (~10 tasks): `getConquestUtility` with EoC weighting, `decideAlliesAction` branching, `decideConquestAction` with persona gate and allies matrix.
7. **Integration + tests + CLI** (~7 tasks): persona-invariant tests, self-play smoke, `play-game` CLI rewrite, final verification.
