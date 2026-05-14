import type { GameState } from '../../game/types.js';
import { getForceCount } from '../../game/force.js';

let selected: number | null = null;

export function setSelectedTerritory(id: number | null): void { selected = id; }
export function getSelectedTerritory(): number | null { return selected; }

export function renderForceTab(state: GameState | null): void {
  const host = document.querySelector<HTMLElement>('.tab-panel[data-panel="force"]');
  if (!host) return;
  if (!state || selected === null) {
    host.innerHTML = '<p class="hint">Click any tile to see its force breakdown.</p>';
    return;
  }
  const t = state.territories[selected];
  if (!t) { host.innerHTML = '<p class="hint">Territory not found.</p>'; return; }
  const fc = getForceCount(state, selected);
  host.innerHTML = `
    <h3>Territory T${selected}</h3>
    <table class="force-table">
      <thead><tr><th>Player</th><th>Force</th></tr></thead>
      <tbody>
        ${state.players.map((p) => `<tr>
          <td><span class="swatch" style="background: var(--p${p.id})"></span>${p.name}</td>
          <td>${fc.perPlayer[p.id] ?? 0}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}
