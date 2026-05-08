// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { renderStockpilePill } from '../../../src/ui/render/stockpilePill.js';

describe('renderStockpilePill', () => {
  it('renders a pill with player color, name, and 5 resource counts', () => {
    const el = renderStockpilePill({
      id: 0, name: 'Red', color: 'red',
      stockpile: [3, 2, 1, 0, 1] as [number, number, number, number, number],
      active: false,
    });
    expect(el.querySelector('.swatch')).not.toBeNull();
    expect(el.querySelector('.name')!.textContent).toBe('Red');
    expect(el.textContent).toContain('I 3');
    expect(el.textContent).toContain('C 2');
    expect(el.textContent).toContain('T 1');
    expect(el.textContent).toContain('G 0');
    expect(el.textContent).toContain('H 1');
  });

  it('marks active pill with data-active attribute', () => {
    const el = renderStockpilePill({
      id: 0, name: 'Red', color: 'red',
      stockpile: [0, 0, 0, 0, 0], active: true,
    });
    expect(el.getAttribute('data-active')).toBe('true');
  });
});
