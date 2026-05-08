// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { conquestMode } from '../../../src/ui/interactions/conquestMode.js';

describe('conquestMode', () => {
  it('has a target sub-state by default', () => {
    expect(['target', 'preview']).toContain(conquestMode.getSub());
  });
});
