import type { GameState, PlayerId, Stockpile, TradeOffer } from '../types.js';
import { tradeKey } from '../tradeKey.js';

function isAllZero(s: Stockpile): boolean {
  return s[0] === 0 && s[1] === 0 && s[2] === 0 && s[3] === 0 && s[4] === 0;
}

function canCover(stock: Stockpile, ask: Stockpile): boolean {
  for (let i = 0; i < 5; i++) if (stock[i]! < ask[i]!) return false;
  return true;
}

export function applyTradePropose(
  prev: GameState,
  proposer: PlayerId,
  tradee: PlayerId,
  give: Stockpile,
  receive: Stockpile,
): GameState {
  if (prev.currentPhase !== 'trade') {
    throw new Error(`Trade plan illegal during ${prev.currentPhase} phase`);
  }
  if (proposer !== prev.currentPlayer) {
    throw new Error(`Trade by player ${proposer} but current player is ${prev.currentPlayer}`);
  }
  if (tradee === proposer) {
    throw new Error(`Trade tradee must be a different player`);
  }
  const t = prev.players[tradee];
  if (!t || t.status !== 'playing') {
    throw new Error(`Trade tradee ${tradee} is not playing`);
  }
  if (isAllZero(give) && isAllZero(receive)) {
    throw new Error(`Cannot propose empty trade (null trade)`);
  }
  if (prev.pendingTrade !== null) {
    throw new Error(`Trade already pending`);
  }
  if (prev.autoReject[tradee]?.[proposer]) {
    throw new Error(`Player ${tradee} has set auto-reject for ${proposer}`);
  }
  // Triple-reject lockout
  const key = tradeKey(proposer, tradee, give, receive);
  const prior = prev.rejectedTrades.find(
    (r) => r.trader === proposer && r.tradee === tradee && r.tradeKey === key,
  );
  if (prior && prior.count >= 3) {
    throw new Error(`Trade already rejected 3 times this year`);
  }
  const proposerStock = prev.players[proposer]!.stockpile;
  if (!canCover(proposerStock, give)) {
    throw new Error(`Proposer has insufficient stockpile to give`);
  }
  if (!canCover(t.stockpile, receive)) {
    throw new Error(`Tradee has insufficient stockpile for receive`);
  }
  const offer: TradeOffer = {
    proposerId: proposer,
    tradeeId: tradee,
    give: [...give] as Stockpile,
    receive: [...receive] as Stockpile,
    status: 'proposed',
  };
  return {
    ...prev,
    pendingTrade: offer,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'trade', player: proposer,
        message: `Trade proposed to player ${tradee}` },
    ],
  };
}

function rejectTrade(prev: GameState, offer: NonNullable<GameState['pendingTrade']>): GameState {
  const key = tradeKey(offer.proposerId, offer.tradeeId, offer.give, offer.receive);
  const existing = prev.rejectedTrades.findIndex(
    (r) => r.trader === offer.proposerId && r.tradee === offer.tradeeId && r.tradeKey === key,
  );
  const rejectedTrades = [...prev.rejectedTrades];
  if (existing >= 0) {
    rejectedTrades[existing] = { ...rejectedTrades[existing]!, count: rejectedTrades[existing]!.count + 1 };
  } else {
    rejectedTrades.push({ trader: offer.proposerId, tradee: offer.tradeeId, tradeKey: key, count: 1 });
  }
  return {
    ...prev,
    pendingTrade: null,
    rejectedTrades,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'trade', player: offer.tradeeId,
        message: `Trade from player ${offer.proposerId} rejected` },
    ],
  };
}

function involvesHorses(offer: { give: Stockpile; receive: Stockpile }): boolean {
  return offer.give[4] > 0 || offer.receive[4] > 0;
}

function swapStockpiles(
  players: Array<{ stockpile: Stockpile }>,
  proposerId: number,
  tradeeId: number,
  give: Stockpile,
  receive: Stockpile,
): void {
  const INDICES = [0, 1, 2, 3, 4] as const;
  for (const i of INDICES) {
    players[proposerId]!.stockpile[i] = players[proposerId]!.stockpile[i] - give[i] + receive[i];
    players[tradeeId]!.stockpile[i] = players[tradeeId]!.stockpile[i] - receive[i] + give[i];
  }
}

function acceptTradeNoHorses(
  prev: GameState,
  offer: NonNullable<GameState['pendingTrade']>,
): GameState {
  const players = prev.players.map((p) => ({ ...p, stockpile: [...p.stockpile] as Stockpile }));
  swapStockpiles(players, offer.proposerId, offer.tradeeId, offer.give, offer.receive);
  return {
    ...prev,
    players,
    pendingTrade: null,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'trade', player: offer.tradeeId,
        message: `Trade from player ${offer.proposerId} accepted` },
    ],
  };
}

export function applyTradeResponse(prev: GameState, accept: boolean): GameState {
  if (prev.currentPhase !== 'trade') {
    throw new Error(`Trade response illegal during ${prev.currentPhase} phase`);
  }
  const offer = prev.pendingTrade;
  if (!offer || offer.status !== 'proposed') {
    throw new Error(`No pending trade proposal to respond to`);
  }
  if (!accept) return rejectTrade(prev, offer);
  if (involvesHorses(offer)) {
    return {
      ...prev,
      pendingTrade: { ...offer, status: 'accepted' },
      log: [
        ...prev.log,
        { year: prev.year, phase: 'trade', player: offer.tradeeId,
          message: `Trade accepted; awaiting horse resolution` },
      ],
    };
  }
  return acceptTradeNoHorses(prev, offer);
}

export function applyHorseFrom(
  prev: GameState,
  player: PlayerId,
  territoryId: number,
): GameState {
  if (prev.currentPhase !== 'trade') {
    throw new Error(`horseFrom illegal during ${prev.currentPhase} phase`);
  }
  const offer = prev.pendingTrade;
  if (!offer || offer.status !== 'accepted') {
    throw new Error(`No accepted pending trade for horseFrom`);
  }
  if (offer.horseFromTerritoryId !== undefined) {
    throw new Error(`horseFrom already resolved`);
  }
  let givingPlayer: PlayerId;
  if (offer.give[4] > 0) givingPlayer = offer.proposerId;
  else if (offer.receive[4] > 0) givingPlayer = offer.tradeeId;
  else throw new Error(`Trade involves no horses`);
  if (player !== givingPlayer) {
    throw new Error(`horseFrom by player ${player} but giving side is ${givingPlayer}`);
  }
  const t = prev.territories[territoryId];
  if (!t) throw new Error(`No territory ${territoryId}`);
  if (t.ownerId !== player) throw new Error(`Territory ${territoryId} not owned by player ${player}`);
  if (!t.hasHorse) throw new Error(`Territory ${territoryId} has no horse to remove`);

  const territories = prev.territories.map((tt) =>
    tt.id === territoryId ? { ...tt, hasHorse: false } : tt,
  );
  return {
    ...prev,
    territories,
    pendingTrade: { ...offer, horseFromTerritoryId: territoryId },
    log: [
      ...prev.log,
      { year: prev.year, phase: 'trade', player,
        message: `Horse picked up from territory ${territoryId}` },
    ],
  };
}

export function applyHorseTo(
  prev: GameState,
  player: PlayerId,
  territoryId: number,
): GameState {
  if (prev.currentPhase !== 'trade') {
    throw new Error(`horseTo illegal during ${prev.currentPhase} phase`);
  }
  const offer = prev.pendingTrade;
  if (!offer || offer.status !== 'accepted') {
    throw new Error(`No accepted pending trade for horseTo`);
  }
  if (offer.horseFromTerritoryId === undefined) {
    throw new Error(`horseFrom not yet resolved`);
  }
  let receivingPlayer: PlayerId;
  if (offer.give[4] > 0) receivingPlayer = offer.tradeeId;
  else if (offer.receive[4] > 0) receivingPlayer = offer.proposerId;
  else throw new Error(`Trade involves no horses`);
  if (player !== receivingPlayer) {
    throw new Error(`horseTo by player ${player} but receiver is ${receivingPlayer}`);
  }
  const t = prev.territories[territoryId];
  if (!t) throw new Error(`No territory ${territoryId}`);
  if (t.ownerId !== player) throw new Error(`Territory ${territoryId} not owned by player ${player}`);
  if (t.hasHorse) throw new Error(`Territory ${territoryId} already has a horse`);

  const territories = prev.territories.map((tt) =>
    tt.id === territoryId ? { ...tt, hasHorse: true } : tt,
  );
  const players = prev.players.map((p) => ({ ...p, stockpile: [...p.stockpile] as Stockpile }));
  swapStockpiles(players, offer.proposerId, offer.tradeeId, offer.give, offer.receive);
  return {
    ...prev,
    territories,
    players,
    pendingTrade: null,
    log: [
      ...prev.log,
      { year: prev.year, phase: 'trade', player,
        message: `Horse landed on territory ${territoryId}; trade complete` },
    ],
  };
}

export function applyTradeRejectAll(
  prev: GameState,
  tradee: PlayerId,
  trader: PlayerId,
): GameState {
  if (prev.currentPhase !== 'trade') {
    throw new Error(`tradeRejectAll illegal during ${prev.currentPhase} phase`);
  }
  if (tradee === trader) throw new Error(`tradeRejectAll requires different players`);

  const autoReject = prev.autoReject.map((row) => [...row]);
  autoReject[tradee]![trader] = true;
  let mid: GameState = { ...prev, autoReject };

  if (prev.pendingTrade && prev.pendingTrade.proposerId === trader && prev.pendingTrade.tradeeId === tradee
      && prev.pendingTrade.status === 'proposed') {
    mid = rejectTrade(mid, mid.pendingTrade!);
  }
  return {
    ...mid,
    log: [
      ...mid.log,
      { year: mid.year, phase: 'trade', player: tradee,
        message: `Player ${tradee} auto-rejects all trades from ${trader}` },
    ],
  };
}
