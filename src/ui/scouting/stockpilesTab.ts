import type { GameState } from '../../game/types.js';
const RES = ['Iron', 'Coal', 'Tree', 'Gold', 'Horse'];

export function renderStockpilesTab(state: GameState): void {
  const host = document.querySelector<HTMLElement>('.tab-panel[data-panel="stockpiles"]');
  if (!host) return;
  host.innerHTML = `
    ${state.players.filter((p) => p.status === 'playing').map((p) => `
      <div class="player-card">
        <h3><span class="swatch" style="background: var(--p${p.id})"></span> ${p.name} <span class="persona">(${p.persona})</span></h3>
        <ul>
          ${RES.map((r, i) => `<li>${r}: ${p.stockpile[i]}</li>`).join('')}
          <li>Cities: ${state.territories.filter((t) => t.ownerId === p.id && t.hasCity).length}</li>
          <li>Boats: ${state.boats.filter((b) => b && b.ownerId === p.id).length}</li>
          <li>Stockpile at: ${p.stockpileLocation === null ? '—' : `T${p.stockpileLocation}`}</li>
        </ul>
      </div>`).join('')}`;
}
