import type { Stockpile } from '../../game/types.js';

const PLAYER_VAR: Record<string, string> = {
  red: '--p0', blue: '--p1', cyan: '--p2', purple: '--p3',
  orange: '--p4', green: '--p5', yellow: '--p6',
};

export function renderStockpilePill(opts: {
  id: number; name: string; color: string;
  stockpile: Stockpile; active: boolean;
}): HTMLElement {
  const el = document.createElement('div');
  el.className = 'pill';
  el.dataset.player = String(opts.id);
  if (opts.active) el.dataset.active = 'true';
  const swatchVar = PLAYER_VAR[opts.color] ?? '--p0';
  const [i, c, t, g, h] = opts.stockpile;
  el.innerHTML = `
    <span class="swatch" style="background: var(${swatchVar})"></span>
    <span class="name">${opts.name}</span>
    <span class="r">I ${i} · C ${c} · T ${t} · G ${g} · H ${h}</span>
  `;
  return el;
}
