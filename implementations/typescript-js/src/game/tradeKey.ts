import type { Stockpile, PlayerId } from './types.js';

// Canonical string key for "this same trade between these same parties."
// Used to recognize repeats for the triple-reject lockout.
export function tradeKey(
  trader: PlayerId,
  tradee: PlayerId,
  give: Stockpile,
  receive: Stockpile,
): string {
  return `${trader}>${tradee}|${give.join(',')}|${receive.join(',')}`;
}

// Spec/Java parity (TradePlan.equals L39-77): the same trade is recognized in
// both directions — proposer↔tradee swapped along with give↔receive.
export function sameTrade(
  a: { trader: PlayerId; tradee: PlayerId; give: Stockpile; receive: Stockpile },
  b: { trader: PlayerId; tradee: PlayerId; give: Stockpile; receive: Stockpile },
): boolean {
  const arrEq = (x: Stockpile, y: Stockpile): boolean =>
    x[0] === y[0] && x[1] === y[1] && x[2] === y[2] && x[3] === y[3] && x[4] === y[4];
  const sameDir = a.trader === b.trader && a.tradee === b.tradee
    && arrEq(a.give, b.give) && arrEq(a.receive, b.receive);
  const reverseDir = a.trader === b.tradee && a.tradee === b.trader
    && arrEq(a.give, b.receive) && arrEq(a.receive, b.give);
  return sameDir || reverseDir;
}
