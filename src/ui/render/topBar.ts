import type { GameState } from '../../game/types.js';
import { renderStatusBanner } from './statusBanner.js';

const PLAYER_VAR: Record<string, string> = {
  red: '--p0', blue: '--p1', cyan: '--p2', purple: '--p3',
  orange: '--p4', green: '--p5', yellow: '--p6',
};

const PHASE_LABEL: Record<string, string> = {
  setup: 'Setup', selection: 'Selection', production: 'Production',
  trade: 'Trade', shipment: 'Shipment', conquest: 'Conquest',
  development: 'Development', gameOver: 'Game Over',
};

export function renderTopBar(state: GameState): void {
  const left = document.querySelector<HTMLElement>('.top-bar .top-left');
  const center = document.querySelector<HTMLElement>('.top-bar .top-center');
  const right = document.querySelector<HTMLElement>('.top-bar .top-right');
  if (!left || !center || !right) return;

  left.innerHTML = `
    <span class="year-badge">Year ${state.year}</span>
    <span class="phase-label">${PHASE_LABEL[state.currentPhase] ?? state.currentPhase}</span>
    <span class="turn-strip">${state.turnOrder.map((pid) => {
      const p = state.players[pid];
      if (!p) return '';
      const active = pid === state.currentPlayer ? ' data-active="true"' : '';
      const v = PLAYER_VAR[p.color] ?? '--p0';
      return `<span class="avatar"${active} style="background: var(${v})"></span>`;
    }).join('')}</span>
  `;

  center.replaceChildren(renderStatusBanner(state));

  right.innerHTML = `
    <button class="btn-scouting" type="button">Scouting Report</button>
    <button class="btn-menu" type="button">⚙</button>
  `;
}
