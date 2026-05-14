// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderForceTab, setSelectedTerritory } from '../../../src/ui/scouting/forceCountTab.js';

describe('forceCountTab', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="tab-panel" data-panel="force"></div>';
  });

  it('shows hint when no territory selected', () => {
    setSelectedTerritory(null);
    renderForceTab(null as any);
    expect(document.querySelector('[data-panel="force"]')!.textContent).toContain('Click any tile');
  });
});
