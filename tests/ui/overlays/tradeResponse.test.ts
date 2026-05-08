// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { openTradeResponse } from '../../../src/ui/overlays/tradeResponse.js';

describe('openTradeResponse', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('renders the offer summary and three action buttons', () => {
    openTradeResponse({
      proposerName: 'Blue', give: [1, 0, 0, 0, 0], receive: [0, 0, 1, 0, 0],
      onAccept: () => {}, onReject: () => {}, onRejectAll: () => {},
    });
    expect(document.querySelector('.trade-response .summary')!.textContent).toContain('Iron');
    expect(document.querySelector('.btn-accept')).not.toBeNull();
    expect(document.querySelector('.btn-reject')).not.toBeNull();
    expect(document.querySelector('.btn-reject-all')).not.toBeNull();
  });
});
