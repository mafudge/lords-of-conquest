import { describe, it, expect } from 'vitest';
import { scoreSelectionCandidate, decideSelectionAction } from '../../src/game/ai/selection.js';
import { decideAction } from '../../src/game/ai/decideAction.js';
import type { Plan } from '../../src/game/plans.js';
import { seededState } from './_fixtures.js';

describe('scoreSelectionCandidate', () => {
  it('scores higher for territories with high-value resources', () => {
    const s = seededState({ seed: 42, playerCount: 2 });
    const wiped = { ...s, territories: s.territories.map((t) =>
      ({ ...t, ownerId: null })) };
    const gold = wiped.territories.find((t) => t.resource === 3);
    const tree = wiped.territories.find((t) => t.resource === 2);
    if (!gold || !tree) return;
    const goldScore = scoreSelectionCandidate(wiped, 0, gold.id);
    const treeScore = scoreSelectionCandidate(wiped, 0, tree.id);
    expect(goldScore).toBeGreaterThan(treeScore);
  });

  it('returns 0 for unresourced territory under a passive persona', () => {
    const s = seededState({ seed: 42, playerCount: 2, personas: ['passive', 'passive'] });
    const wiped = { ...s, territories: s.territories.map((t) =>
      ({ ...t, ownerId: null })) };
    const noResource = wiped.territories.find((t) => t.resource === null);
    if (!noResource) return;
    const score = scoreSelectionCandidate(wiped, 0, noResource.id);
    // Passive persona skips both resource scoring and touch-terr scoring.
    // Vulnerability and ptTouchOwnTerr also evaluate to 0 in this wiped state.
    expect(score).toBe(0);
  });

  it('rewards adjacency to player-owned territories', () => {
    const s = seededState({ seed: 42, playerCount: 2 });
    const wiped = { ...s, territories: s.territories.map((t) =>
      ({ ...t, ownerId: null })) };
    let A = -1, B = -1;
    for (let a = 0; a < wiped.territories.length; a++) {
      for (let b = 0; b < wiped.territories.length; b++) {
        if (a !== b && wiped.touching[a]?.[b]) { A = a; B = b; break; }
      }
      if (A >= 0) break;
    }
    if (A < 0) return;
    const ownedA = { ...wiped, territories: wiped.territories.map((t) =>
      t.id === A ? { ...t, ownerId: 0 as 0 | 1 } : t) };
    const isolated = scoreSelectionCandidate(wiped, 0, B);
    const adjacent = scoreSelectionCandidate(ownedA, 0, B);
    expect(adjacent).toBeGreaterThan(isolated);
  });
});

describe('decideSelectionAction', () => {
  it('returns a selection Plan for the highest-scoring unowned territory', () => {
    let s = seededState({ seed: 42, playerCount: 2 });
    s = { ...s, currentPhase: 'selection', currentPlayer: 0,
      territories: s.territories.map((t) => ({ ...t, ownerId: null })) };
    const plan = decideSelectionAction(s, 0) as Extract<Plan, { kind: 'selection' }>;
    expect(plan.kind).toBe('selection');
    expect(plan.player).toBe(0);
    const t = s.territories.find((tt) => tt.id === plan.territoryId)!;
    expect(t.ownerId).toBeNull();
  });

  it('decideAction routes selection phase through scoring', () => {
    let s = seededState({ seed: 42, playerCount: 2 });
    s = { ...s, currentPhase: 'selection', currentPlayer: 0,
      territories: s.territories.map((t) => ({ ...t, ownerId: null })) };
    const plan = decideAction(s, 0);
    expect(plan.kind).toBe('selection');
  });
});
