// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { showFlavorBanner } from '../../../src/ui/render/flavorBanner.js';

describe('showFlavorBanner', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('mounts a banner with the given message and removes itself after duration', async () => {
    const p = showFlavorBanner('Plagues of Cockroaches', 50);
    expect(document.querySelector('.flavor-banner')!.textContent).toBe('Plagues of Cockroaches');
    await p;
    expect(document.querySelector('.flavor-banner')).toBeNull();
  });
});
