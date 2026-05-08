import { slotSummary, saveSlot, loadSlot } from '../platform/persistence.js';
import type { GameState } from '../../game/types.js';

export function openMenu(opts: {
  currentState: GameState | null;
  onLoad: (s: GameState) => void;
  onNewGame: () => void;
}): void {
  document.querySelector('.menu-overlay')?.remove();
  const summary = slotSummary();
  const dlg = document.createElement('div');
  dlg.className = 'menu-overlay overlay-backdrop';
  dlg.innerHTML = `
    <div class="overlay-panel">
      <h2>Menu</h2>
      <div class="slots">
        ${summary.map((s) => `
          <div class="slot-row" data-slot="${s.slot}">
            <span class="slot-label">Slot ${s.slot}: ${s.filled
              ? `Year ${s.year} (${new Date(s.savedAt!).toLocaleString()})`
              : 'Empty'}</span>
            <button class="btn-save-slot" data-slot="${s.slot}" ${opts.currentState ? '' : 'disabled'}>Save</button>
            <button class="btn-load-slot" data-slot="${s.slot}" ${s.filled ? '' : 'disabled'}>Load</button>
          </div>`).join('')}
      </div>
      <div class="overlay-actions">
        <button class="btn-new-game act act-destructive">New Game</button>
        <button class="btn-close act act-primary">Close</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);

  dlg.querySelectorAll<HTMLButtonElement>('.btn-save-slot').forEach((b) =>
    b.addEventListener('click', () => {
      if (opts.currentState) saveSlot(Number(b.dataset.slot), opts.currentState);
      dlg.remove();
    }));
  dlg.querySelectorAll<HTMLButtonElement>('.btn-load-slot').forEach((b) =>
    b.addEventListener('click', () => {
      const s = loadSlot(Number(b.dataset.slot));
      if (s) { dlg.remove(); opts.onLoad(s); }
    }));
  dlg.querySelector('.btn-new-game')!.addEventListener('click', () => {
    dlg.remove(); opts.onNewGame();
  });
  dlg.querySelector('.btn-close')!.addEventListener('click', () => dlg.remove());
}
