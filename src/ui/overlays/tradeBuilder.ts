import type { Stockpile } from '../../game/types.js';

export function openTradeBuilder(opts: {
  proposerId: number; tradeeId: number;
  proposerStock: Stockpile; tradeeStock: Stockpile;
  onSend: (give: Stockpile, receive: Stockpile) => void;
  onCancel: () => void;
}): void {
  document.querySelector('.trade-builder')?.remove();
  const give: number[] = [0, 0, 0, 0, 0];
  const receive: number[] = [0, 0, 0, 0, 0];
  const labels = ['Iron', 'Coal', 'Tree', 'Gold', 'Horse'];

  const dlg = document.createElement('div');
  dlg.className = 'trade-builder overlay-backdrop';
  dlg.innerHTML = `
    <div class="overlay-panel">
      <h2>Propose trade to player ${opts.tradeeId}</h2>
      <div class="tb-grid">
        <div class="tb-give">
          <h3>You give</h3>
          ${labels.map((l, r) => counterHtml('tb-give', r, l, opts.proposerStock[r]!)).join('')}
        </div>
        <div class="tb-receive">
          <h3>You receive</h3>
          ${labels.map((l, r) => counterHtml('tb-receive', r, l, opts.tradeeStock[r]!)).join('')}
        </div>
      </div>
      <div class="tb-summary">Empty trade — increment something.</div>
      <div class="overlay-actions">
        <button class="btn-cancel act">Cancel</button>
        <button class="btn-send act act-primary" disabled>Send proposal</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);

  const sendBtn = dlg.querySelector<HTMLButtonElement>('.btn-send')!;
  function refresh(): void {
    dlg.querySelectorAll<HTMLElement>('.tb-give .counter').forEach((el, r) => {
      el.querySelector('.val')!.textContent = String(give[r]);
    });
    dlg.querySelectorAll<HTMLElement>('.tb-receive .counter').forEach((el, r) => {
      el.querySelector('.val')!.textContent = String(receive[r]);
    });
    const empty = give.every((x) => x === 0) && receive.every((x) => x === 0);
    sendBtn.disabled = empty;
    dlg.querySelector('.tb-summary')!.textContent = empty
      ? 'Empty trade — increment something.'
      : `Give: [${give.join(',')}]  Receive: [${receive.join(',')}]`;
  }

  function bumpHandler(side: 'tb-give' | 'tb-receive', r: number, dir: 1 | -1): void {
    const arr = side === 'tb-give' ? give : receive;
    const cap = side === 'tb-give' ? opts.proposerStock[r]! : opts.tradeeStock[r]!;
    const next = Math.max(0, Math.min(cap, (arr[r] ?? 0) + dir));
    arr[r] = next;
    refresh();
  }

  dlg.querySelectorAll<HTMLButtonElement>('.tb-give .inc').forEach((b, r) =>
    b.addEventListener('click', () => bumpHandler('tb-give', r, 1)));
  dlg.querySelectorAll<HTMLButtonElement>('.tb-give .dec').forEach((b, r) =>
    b.addEventListener('click', () => bumpHandler('tb-give', r, -1)));
  dlg.querySelectorAll<HTMLButtonElement>('.tb-receive .inc').forEach((b, r) =>
    b.addEventListener('click', () => bumpHandler('tb-receive', r, 1)));
  dlg.querySelectorAll<HTMLButtonElement>('.tb-receive .dec').forEach((b, r) =>
    b.addEventListener('click', () => bumpHandler('tb-receive', r, -1)));
  dlg.querySelector('.btn-cancel')!.addEventListener('click', () => { dlg.remove(); opts.onCancel(); });
  sendBtn.addEventListener('click', () => {
    dlg.remove();
    opts.onSend(give as Stockpile, receive as Stockpile);
  });

  refresh();
}

function counterHtml(side: string, r: number, label: string, cap: number): string {
  return `<div class="counter" data-r="${r}">
    <span class="label">${label} <span class="cap">(${cap})</span></span>
    <button class="dec">-</button>
    <span class="val">0</span>
    <button class="inc">+</button>
  </div>`;
}
