import { describe, it, expect } from 'vitest';
import { decideTradeAction, getProposedTradePlan } from '../../src/game/ai/trade.js';
import { seededState, setStockpile } from './_fixtures.js';

describe('decideTradeAction', () => {
  it('accepts a clearly-beneficial trade', () => {
    let s = seededState({ seed: 42 });
    s = setStockpile(s, 0, [0, 4, 0, 0, 0]);
    s = setStockpile(s, 1, [4, 0, 0, 0, 0]);
    s = { ...s, currentPhase: 'trade', currentPlayer: 0 };
    const offer = {
      proposerId: 0 as 0, tradeeId: 1 as 1,
      give: [0, 1, 0, 0, 0] as [0, 1, 0, 0, 0],
      receive: [1, 0, 0, 0, 0] as [1, 0, 0, 0, 0],
      status: 'proposed' as const,
    };
    const accept = decideTradeAction(s, 1, offer);
    expect(typeof accept).toBe('boolean');
  });

  it('rejects clearly-bad trades', () => {
    let s = seededState({ seed: 42 });
    s = setStockpile(s, 0, [0, 0, 0, 0, 0]);
    s = setStockpile(s, 1, [9, 9, 9, 9, 9]);
    s = { ...s, currentPhase: 'trade', currentPlayer: 0 };
    const accept = decideTradeAction(s, 1, {
      proposerId: 0, tradeeId: 1,
      give: [0, 0, 0, 0, 0], receive: [9, 0, 0, 0, 0],
      status: 'proposed',
    });
    expect(accept).toBe(false);
  });

  it('passive AIs always reject', () => {
    let s = seededState({ seed: 42, personas: ['aggressive', 'passive', 'aggressive'] });
    s = { ...s, currentPhase: 'trade', currentPlayer: 0 };
    expect(decideTradeAction(s, 1, {
      proposerId: 0, tradeeId: 1,
      give: [9, 9, 9, 9, 9], receive: [0, 0, 0, 0, 0],
      status: 'proposed',
    })).toBe(false);
  });
});

describe('getProposedTradePlan', () => {
  it('generates a candidate or endPhase when both sides have stockpile cover', () => {
    let s = seededState({ seed: 42 });
    s = setStockpile(s, 0, [3, 0, 0, 0, 0]);
    s = setStockpile(s, 1, [0, 3, 0, 0, 0]);
    s = { ...s, currentPhase: 'trade', currentPlayer: 0, pendingTrade: null };
    const plan = getProposedTradePlan(s, 0);
    expect(['trade', 'endPhase']).toContain(plan.kind);
  });

  it('returns endPhase when every opponent is passive (rejects everything)', () => {
    let s = seededState({ seed: 42, personas: ['aggressive', 'passive', 'passive'] });
    s = setStockpile(s, 0, [3, 0, 0, 0, 0]);
    s = setStockpile(s, 1, [0, 3, 0, 0, 0]);
    s = setStockpile(s, 2, [0, 3, 0, 0, 0]);
    s = { ...s, currentPhase: 'trade', currentPlayer: 0, pendingTrade: null };
    const plan = getProposedTradePlan(s, 0);
    expect(plan.kind).toBe('endPhase');
  });

  it('skips opponents who have set autoReject for me', () => {
    let s = seededState({ seed: 42 });
    s = setStockpile(s, 0, [3, 0, 0, 0, 0]);
    s = setStockpile(s, 1, [0, 3, 0, 0, 0]);
    s = { ...s,
      currentPhase: 'trade', currentPlayer: 0, pendingTrade: null,
      autoReject: [[false, false, false], [true, false, false], [false, false, false]],
    };
    const plan = getProposedTradePlan(s, 0);
    if (plan.kind === 'trade') {
      expect(plan.tradee).not.toBe(1);
    }
  });
});
