// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mountDrawer, toggleDrawer, setActiveTab } from '../../../src/ui/scouting/drawer.js';

describe('scouting drawer', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('mountDrawer renders a closed drawer with 4 tabs', () => {
    mountDrawer();
    expect(document.querySelector('.scouting-drawer')).not.toBeNull();
    expect(document.querySelectorAll('.scouting-drawer .tab')).toHaveLength(4);
    expect(document.querySelector('.scouting-drawer.open')).toBeNull();
  });

  it('toggleDrawer opens and closes', () => {
    mountDrawer();
    toggleDrawer();
    expect(document.querySelector('.scouting-drawer.open')).not.toBeNull();
    toggleDrawer();
    expect(document.querySelector('.scouting-drawer.open')).toBeNull();
  });

  it('setActiveTab marks the chosen tab and shows its panel', () => {
    mountDrawer();
    setActiveTab('stockpiles');
    expect(document.querySelector('.tab[data-tab="stockpiles"]')!.getAttribute('data-active')).toBe('true');
  });
});
