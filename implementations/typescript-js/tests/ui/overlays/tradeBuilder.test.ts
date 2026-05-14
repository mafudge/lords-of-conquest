// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { openTradeBuilder } from '../../../src/ui/overlays/tradeBuilder.js';

describe('openTradeBuilder', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('renders 5 give counters and 5 receive counters', () => {
    openTradeBuilder({
      proposerId: 0, tradeeId: 1,
      proposerStock: [3, 2, 1, 0, 1], tradeeStock: [0, 0, 4, 0, 0],
      onSend: () => {}, onCancel: () => {},
    });
    expect(document.querySelectorAll('.tb-give .counter')).toHaveLength(5);
    expect(document.querySelectorAll('.tb-receive .counter')).toHaveLength(5);
  });

  it('clicking + on Iron-give increments and clamps to proposer stock', () => {
    openTradeBuilder({
      proposerId: 0, tradeeId: 1,
      proposerStock: [2, 0, 0, 0, 0], tradeeStock: [0, 0, 0, 0, 0],
      onSend: () => {}, onCancel: () => {},
    });
    const inc = document.querySelector<HTMLButtonElement>('.tb-give .counter[data-r="0"] .inc')!;
    inc.click(); inc.click(); inc.click();
    const val = document.querySelector('.tb-give .counter[data-r="0"] .val')!.textContent;
    expect(val).toBe('2'); // clamped at proposerStock[0]
  });

  it('Send dispatches with current give/receive', () => {
    let captured: any = null;
    openTradeBuilder({
      proposerId: 0, tradeeId: 1,
      proposerStock: [2, 0, 0, 0, 0], tradeeStock: [0, 1, 0, 0, 0],
      onSend: (g, r) => { captured = { g, r }; }, onCancel: () => {},
    });
    document.querySelector<HTMLButtonElement>('.tb-give .counter[data-r="0"] .inc')!.click();
    document.querySelector<HTMLButtonElement>('.tb-receive .counter[data-r="1"] .inc')!.click();
    document.querySelector<HTMLButtonElement>('.btn-send')!.click();
    expect(captured.g).toEqual([1, 0, 0, 0, 0]);
    expect(captured.r).toEqual([0, 1, 0, 0, 0]);
  });
});
