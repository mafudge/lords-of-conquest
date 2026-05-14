import type { GameState } from '../../game/types.js';
import { getCentroidSquare } from './tile.js';
import { getForceCount } from '../../game/force.js';

const CELL_SIZE = 32;
const PLAYER_VAR: Record<string, string> = {
  red: '--p0', blue: '--p1', cyan: '--p2', purple: '--p3',
  orange: '--p4', green: '--p5', yellow: '--p6',
};

export function renderBoats(state: GameState): void {
  const svg = document.querySelector<SVGSVGElement>('.board-svg');
  if (!svg) return;
  svg.querySelector('.boat-layer')?.remove();
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  layer.classList.add('boat-layer');
  svg.appendChild(layer);

  for (let bi = 0; bi < state.boats.length; bi++) {
    const boat = state.boats[bi];
    if (!boat) continue;
    if (boat.x < 0 || boat.y < 0) continue;
    const owner = state.players[boat.ownerId];
    const v = PLAYER_VAR[owner?.color ?? 'red'] ?? '--p0';
    const cx = boat.x * CELL_SIZE + CELL_SIZE / 2;
    const cy = boat.y * CELL_SIZE + CELL_SIZE / 2;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('boat-sprite');
    g.dataset.boatId = String(bi);
    g.setAttribute('transform', `translate(${cx} ${cy})`);
    g.setAttribute('style', `--owner-color: var(${v})`);
    g.innerHTML =
      `<polygon points="-8,4 8,4 6,-2 -6,-2" class="hull"></polygon>` +
      `<line x1="0" y1="-2" x2="0" y2="-9" class="mast"></line>`;
    if (boat.carryHorse) {
      const h = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      h.setAttribute('cx', '-12'); h.setAttribute('cy', '0'); h.setAttribute('r', '3');
      h.classList.add('embark-horse');
      g.appendChild(h);
    }
    if (boat.carryWeapon) {
      const w = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      w.setAttribute('x1', '12'); w.setAttribute('y1', '-4');
      w.setAttribute('x2', '12'); w.setAttribute('y2', '4');
      w.classList.add('embark-weapon');
      g.appendChild(w);
    }
    layer.appendChild(g);
  }
}

export function renderForceBadges(state: GameState, show: boolean): void {
  const svg = document.querySelector<SVGSVGElement>('.board-svg');
  if (!svg) return;
  svg.querySelector('.force-layer')?.remove();
  if (!show) return;
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  layer.classList.add('force-layer');
  svg.appendChild(layer);
  for (const t of state.territories) {
    if (t.ownerId === null) continue;
    const fc = getForceCount(state, t.id);
    const total = fc.perPlayer.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const c = getCentroidSquare(t);
    const sq = state.squares[c];
    if (!sq) continue;
    const cx = sq.x * CELL_SIZE + CELL_SIZE - 4;
    const cy = sq.y * CELL_SIZE + 8;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('force-badge');
    text.setAttribute('x', String(cx));
    text.setAttribute('y', String(cy));
    text.setAttribute('text-anchor', 'end');
    text.textContent = String(total);
    layer.appendChild(text);
  }
}
