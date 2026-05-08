import type { GameState } from '../../game/types.js';

let selected: number | null = null;
export function setSelectedBoat(id: number | null): void { selected = id; }

export function renderBoatInfoTab(state: GameState): void {
  const host = document.querySelector<HTMLElement>('.tab-panel[data-panel="boat"]');
  if (!host) return;
  if (selected === null) {
    host.innerHTML = '<p class="hint">Click any boat to see its details.</p>';
    return;
  }
  const b = state.boats[selected];
  if (!b) { host.innerHTML = '<p class="hint">Boat not found.</p>'; return; }
  const sq = state.squares[b.y * 40 + b.x];
  host.innerHTML = `
    <h3>Boat #${selected}</h3>
    <ul>
      <li>Owner: ${state.players[b.ownerId]?.name ?? '?'}</li>
      <li>Home: T${b.homeTerritoryId}</li>
      <li>Position: (${b.x}, ${b.y})${sq?.lakeId !== null && sq?.lakeId !== undefined ? ` lake ${sq?.lakeId}` : ''}</li>
      <li>Carrying horse: ${b.carryHorse ? 'yes' : 'no'}</li>
      <li>Carrying weapon: ${b.carryWeapon ? 'yes' : 'no'}</li>
    </ul>`;
}
