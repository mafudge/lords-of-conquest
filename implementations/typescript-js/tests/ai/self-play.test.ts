import { describe, it, expect } from 'vitest';
import { runAITurn } from '../../src/game/ai/runAITurn.js';
import { seededState } from './_fixtures.js';

describe('AI self-play smoke', () => {
  const SEEDS = [12345, 23456, 34567, 45678, 56789];
  const MAX_YEAR = 30;

  it('5 seeds run without exceptions to year 30 or gameOver', () => {
    let gameOverCount = 0;
    for (const seed of SEEDS) {
      let s = seededState({
        seed, playerCount: 4,
        personas: ['aggressive', 'defensive', 'aggressive', 'passive'],
        citiesToWin: 5,
      });
      let lastCursor = -1;
      let stuckCount = 0;
      while (s.year <= MAX_YEAR && s.currentPhase !== 'gameOver') {
        const before = s.rngCursor;
        s = runAITurn(s);
        expect(s.rngCursor).toBeGreaterThanOrEqual(before);
        // Detect stuck states
        if (s.rngCursor === lastCursor) {
          stuckCount++;
          if (stuckCount > 3) break; // bail out if no progress
        } else {
          stuckCount = 0;
          lastCursor = s.rngCursor;
        }
      }
      if (s.currentPhase === 'gameOver') gameOverCount++;
    }
    expect(gameOverCount).toBeGreaterThanOrEqual(3);
  }, 60000); // 60s timeout

  it('runs are deterministic per seed', () => {
    const seed = 12345;
    const s1 = runAllAIYears(seed, 10);
    const s2 = runAllAIYears(seed, 10);
    expect(s1.year).toBe(s2.year);
    expect(s1.currentPhase).toBe(s2.currentPhase);
    expect(s1.rngCursor).toBe(s2.rngCursor);
    expect(s1.territories.map((t) => t.ownerId)).toEqual(
      s2.territories.map((t) => t.ownerId));
  }, 60000);

  function runAllAIYears(seed: number, maxYear: number) {
    let s = seededState({ seed, playerCount: 4,
      personas: ['aggressive', 'defensive', 'aggressive', 'passive'] });
    let lastCursor = -1;
    let stuckCount = 0;
    while (s.year <= maxYear && s.currentPhase !== 'gameOver') {
      s = runAITurn(s);
      if (s.rngCursor === lastCursor) {
        stuckCount++;
        if (stuckCount > 3) break;
      } else {
        stuckCount = 0;
        lastCursor = s.rngCursor;
      }
    }
    return s;
  }
});
