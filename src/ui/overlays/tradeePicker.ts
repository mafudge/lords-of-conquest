export function openTradeePicker(opts: {
  candidates: Array<{ id: number; name: string; color: string }>;
  onPick: (id: number) => void;
}): void {
  document.querySelector('.tradee-picker')?.remove();
  const popover = document.createElement('div');
  popover.className = 'tradee-picker';
  popover.innerHTML = `
    <div class="tradee-list">
      ${opts.candidates.map((c) =>
        `<button class="tradee" data-id="${c.id}">
          <span class="swatch" style="background: var(--p${c.id})"></span>${c.name}
        </button>`).join('')}
      <button class="btn-cancel">Cancel</button>
    </div>`;
  document.body.appendChild(popover);
  popover.querySelectorAll<HTMLButtonElement>('.tradee').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      popover.remove();
      opts.onPick(id);
    });
  });
  popover.querySelector('.btn-cancel')!.addEventListener('click', () => popover.remove());
}
