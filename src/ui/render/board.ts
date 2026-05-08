import type { GameState } from '../../game/types.js';
import { renderTileGlyphs } from './tile.js';

const PLAYER_VAR: Record<string, string> = {
  red: '--p0', blue: '--p1', cyan: '--p2', purple: '--p3',
  orange: '--p4', green: '--p5', yellow: '--p6',
};

export function renderBoard(state: GameState): void {
  const host = document.querySelector<HTMLElement>('.board-host');
  if (!host) return;

  const cellSize = 32;
  const w = 40 * cellSize;
  const h = 20 * cellSize;

  let svg = host.querySelector<SVGSVGElement>('.board-svg');
  if (!svg) {
    host.innerHTML = `<svg class="board-svg" viewBox="0 0 ${w} ${h}"
      preserveAspectRatio="xMidYMid meet"></svg>`;
    svg = host.querySelector('.board-svg')!;
  }

  const sqElems: string[] = [];
  for (const sq of state.squares) {
    const x = sq.x * cellSize;
    const y = sq.y * cellSize;
    const isWater = sq.lakeId !== null;
    const ownerId = sq.territoryId !== null ? state.territories[sq.territoryId]?.ownerId : null;
    const cls = isWater ? 'sq water' : (ownerId !== null && ownerId !== undefined ? 'sq owned' : 'sq');
    const colorVar = ownerId !== null && ownerId !== undefined
      ? PLAYER_VAR[state.players[ownerId]!.color] ?? '--p0'
      : null;
    const fillStyle = colorVar ? ` style="--owner-color: var(${colorVar})"` : '';
    sqElems.push(
      `<rect class="${cls}" data-x="${sq.x}" data-y="${sq.y}" ` +
      `x="${x}" y="${y}" width="${cellSize}" height="${cellSize}"${fillStyle}></rect>`,
    );
  }
  svg.innerHTML = sqElems.join('');
  renderTileGlyphs(state);
}
