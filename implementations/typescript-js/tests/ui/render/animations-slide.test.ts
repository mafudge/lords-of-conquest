// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { animatePlan, setFastForward } from '../../../src/ui/render/animations.js';
import type { GameState } from '../../../src/game/types.js';

describe('animateShipment', () => {
  beforeEach(() => { document.body.innerHTML = '<div class="board-svg"></div>'; });

  it('completes a shipHorse animation in <800ms', async () => {
    setFastForward(false);
    const start = performance.now();
    await animatePlan({} as GameState, {} as GameState,
      { kind: 'shipHorse', player: 0, from: 0, to: 1 } as any);
    expect(performance.now() - start).toBeLessThan(800);
  });
});
