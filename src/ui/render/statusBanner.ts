import type { GameState } from '../../game/types.js';

export function renderStatusBanner(state: GameState): HTMLElement {
  const el = document.createElement('div');
  el.className = 'status-banner';
  const cur = state.players[state.currentPlayer];
  const isHuman = cur?.persona === 'human';
  const pendingTradeForHuman = state.pendingTrade
    && state.pendingTrade.status === 'proposed'
    && state.players[state.pendingTrade.tradeeId]?.persona === 'human';
  if (isHuman || pendingTradeForHuman || state.currentPhase === 'gameOver') {
    el.textContent = '';
    return el;
  }
  el.textContent = describeAITurn(state);
  return el;
}

function describeAITurn(state: GameState): string {
  const cur = state.players[state.currentPlayer];
  if (!cur) return '';
  const phase = state.currentPhase;
  if (state.pendingTrade && state.pendingTrade.status === 'proposed') {
    const proposer = state.players[state.pendingTrade.proposerId];
    const tradee = state.players[state.pendingTrade.tradeeId];
    return `${proposer?.name} is proposing a trade to ${tradee?.name}…`;
  }
  if (state.pendingCombat && !state.pendingCombat.resolved) {
    const att = state.players[state.pendingCombat.attackerId];
    return `${att?.name} is attacking T${state.pendingCombat.targetTerritoryId}…`;
  }
  return `${cur.name} is acting (${phase})…`;
}
