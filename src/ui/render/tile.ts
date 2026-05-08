import type { GameState, Territory } from '../../game/types.js';

const CELL_SIZE = 32;

export function getCentroidSquare(t: Territory): number {
  // Centroid by average position; fall back to middle index.
  return t.squares[Math.floor(t.squares.length / 2)] ?? t.squares[0]!;
}

export function renderTileGlyphs(state: GameState): void {
  const svg = document.querySelector<SVGSVGElement>('.board-svg');
  if (!svg) return;

  // Remove old glyph layer if present, recreate.
  svg.querySelector('.glyph-layer')?.remove();
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  layer.classList.add('glyph-layer');
  svg.appendChild(layer);

  for (const t of state.territories) {
    if (t.ownerId === null) continue;
    const c = getCentroidSquare(t);
    const sq = state.squares[c];
    if (!sq) continue;
    const cx = sq.x * CELL_SIZE + CELL_SIZE / 2;
    const cy = sq.y * CELL_SIZE + CELL_SIZE / 2;

    if (t.hasCity) layer.appendChild(makeGlyph('city', cx, cy));
    if (t.hasWeapon) layer.appendChild(makeGlyph('weapon', cx, cy));
    if (t.hasHorse) layer.appendChild(makeGlyph('horse', cx, cy));
    if (t.hasStockpile) layer.appendChild(makeGlyph('stockpile', cx, cy));
  }
}

function makeGlyph(kind: 'city' | 'weapon' | 'horse' | 'stockpile', cx: number, cy: number): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.classList.add(`glyph-${kind}`);
  g.setAttribute('transform', `translate(${cx} ${cy})`);

  // Simple iconography — single SVG primitive each.
  if (kind === 'city') {
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', '-7'); r.setAttribute('y', '-9');
    r.setAttribute('width', '14'); r.setAttribute('height', '12');
    r.setAttribute('rx', '1');
    g.appendChild(r);
    const tip = document.createElementNS(ns, 'polygon');
    tip.setAttribute('points', '-7,-9 0,-15 7,-9');
    g.appendChild(tip);
  } else if (kind === 'weapon') {
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '-9');
    line.setAttribute('x2', '0'); line.setAttribute('y2', '8');
    g.appendChild(line);
    const cross = document.createElementNS(ns, 'line');
    cross.setAttribute('x1', '-5'); cross.setAttribute('y1', '-4');
    cross.setAttribute('x2', '5'); cross.setAttribute('y2', '-4');
    g.appendChild(cross);
  } else if (kind === 'horse') {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', '0'); c.setAttribute('cy', '0'); c.setAttribute('r', '6');
    g.appendChild(c);
  } else {
    // stockpile = crate
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', '-7'); r.setAttribute('y', '-7');
    r.setAttribute('width', '14'); r.setAttribute('height', '14');
    r.setAttribute('rx', '2');
    g.appendChild(r);
  }
  return g as unknown as SVGElement;
}
