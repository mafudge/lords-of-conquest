import type { GameState } from '../../game/types.js';
import { renderStockpilePill } from './stockpilePill.js';

export type BarAction = {
  label: string;
  kind?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
  onClick: () => void;
};

export function renderBottomBar(state: GameState, actions: BarAction[]): void {
  const pillsHost = document.querySelector<HTMLElement>('.bottom-bar .pills');
  const actionsHost = document.querySelector<HTMLElement>('.bottom-bar .actions');
  if (!pillsHost || !actionsHost) return;

  pillsHost.replaceChildren(
    ...state.players
      .filter((p) => p.status === 'playing')
      .map((p) => renderStockpilePill({
        id: p.id, name: p.name, color: p.color,
        stockpile: p.stockpile, active: p.id === state.currentPlayer,
      })),
  );

  actionsHost.replaceChildren(
    ...actions.map((a) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `act act-${a.kind ?? 'secondary'}`;
      btn.textContent = a.label;
      if (a.disabled) btn.disabled = true;
      btn.addEventListener('click', a.onClick);
      return btn;
    }),
  );
}
