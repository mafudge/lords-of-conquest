import { describe, it, expect } from 'vitest';
import { seededState } from './_fixtures.js';

describe('seededState fixture', () => {
  it('produces a state where every territory is owned', () => {
    const s = seededState({ seed: 42 });
    expect(s.territories.every((t) => t.ownerId !== null)).toBe(true);
  });

  it('respects playerCount', () => {
    const s = seededState({ seed: 42, playerCount: 4 });
    expect(s.players).toHaveLength(4);
    expect(s.turnOrder).toHaveLength(4);
  });

  it('respects personas', () => {
    const s = seededState({ seed: 42, personas: ['human', 'passive', 'aggressive'] });
    expect(s.players[0]!.persona).toBe('human');
    expect(s.players[1]!.persona).toBe('passive');
    expect(s.players[2]!.persona).toBe('aggressive');
  });
});
