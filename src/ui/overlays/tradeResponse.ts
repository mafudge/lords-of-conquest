import type { Stockpile } from '../../game/types.js';

const RES = ['Iron', 'Coal', 'Tree', 'Gold', 'Horse'];

function summarize(stock: Stockpile): string {
  return RES.map((r, i) => stock[i]! > 0 ? `${stock[i]} ${r}` : null).filter(Boolean).join(', ');
}

export function openTradeResponse(opts: {
  proposerName: string;
  give: Stockpile; receive: Stockpile;
  onAccept: () => void; onReject: () => void; onRejectAll: () => void;
}): void {
  document.querySelector('.trade-response')?.remove();
  const dlg = document.createElement('div');
  dlg.className = 'trade-response overlay-backdrop';
  dlg.innerHTML = `
    <div class="overlay-panel">
      <h2>${opts.proposerName} offers a trade</h2>
      <div class="summary">
        <div>↘ You give: ${summarize(opts.give) || '(nothing)'}</div>
        <div>↗ You receive: ${summarize(opts.receive) || '(nothing)'}</div>
      </div>
      <div class="overlay-actions">
        <button class="btn-reject-all act act-destructive">Reject all from ${opts.proposerName}</button>
        <button class="btn-reject act">Reject</button>
        <button class="btn-accept act act-primary">Accept</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.querySelector('.btn-accept')!.addEventListener('click', () => { dlg.remove(); opts.onAccept(); });
  dlg.querySelector('.btn-reject')!.addEventListener('click', () => { dlg.remove(); opts.onReject(); });
  dlg.querySelector('.btn-reject-all')!.addEventListener('click', () => { dlg.remove(); opts.onRejectAll(); });
}
