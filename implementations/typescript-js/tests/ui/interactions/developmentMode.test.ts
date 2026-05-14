// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { developmentMode } from '../../../src/ui/interactions/developmentMode.js';

describe('developmentMode', () => {
  it('exposes setSub and getSub for city/weapon/boat selection', () => {
    expect(typeof developmentMode.setSub).toBe('function');
    developmentMode.setSub('city');
    expect(developmentMode.getSub()).toBe('city');
  });
});
