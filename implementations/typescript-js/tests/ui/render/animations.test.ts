// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { animatePlan, setFastForward } from '../../../src/ui/render/animations.js';
import type { GameState } from '../../../src/game/types.js';

describe('animatePlan', () => {
  it('resolves immediately when fastForward is on', async () => {
    setFastForward(true);
    const start = performance.now();
    await animatePlan({} as GameState, {} as GameState, { kind: 'endPhase', player: 0 } as any);
    expect(performance.now() - start).toBeLessThan(50);
    setFastForward(false);
  });

  it('resolves a selection plan in <500ms', async () => {
    document.body.innerHTML = '<div class="board-svg"></div>';
    const start = performance.now();
    await animatePlan({} as GameState, {} as GameState,
      { kind: 'selection', player: 0, territoryId: 0 } as any);
    expect(performance.now() - start).toBeLessThan(500);
  });
});
