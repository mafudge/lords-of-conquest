// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { openTradeePicker } from '../../../src/ui/overlays/tradeePicker.js';

describe('openTradeePicker', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('lists eligible opponents and dispatches the picked id', () => {
    let chosen: number | null = null;
    openTradeePicker({
      candidates: [
        { id: 1, name: 'Blue', color: 'blue' },
        { id: 2, name: 'Cyan', color: 'cyan' },
      ],
      onPick: (id) => { chosen = id; },
    });
    expect(document.querySelectorAll('.tradee-picker .tradee')).toHaveLength(2);
    document.querySelector<HTMLButtonElement>('.tradee[data-id="2"]')!.click();
    expect(chosen).toBe(2);
  });
});
