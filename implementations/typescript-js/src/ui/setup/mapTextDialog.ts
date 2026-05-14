export function openMapTextDialog(opts: {
  mode: 'save' | 'load';
  initial: string;
  onConfirm: (text: string) => void;
}): void {
  const existing = document.querySelector('.map-text-dialog');
  existing?.remove();
  const dlg = document.createElement('div');
  dlg.className = 'map-text-dialog overlay-backdrop';
  dlg.innerHTML = `
    <div class="overlay-panel" role="dialog">
      <h2>${opts.mode === 'save' ? 'Save current map' : 'Load map text'}</h2>
      <textarea rows="10" cols="50" ${opts.mode === 'save' ? 'readonly' : 'placeholder="Paste map text here…"'}>${opts.initial}</textarea>
      <div class="overlay-actions">
        <button class="btn-cancel act">Cancel</button>
        ${opts.mode === 'save'
          ? '<button class="btn-copy act act-primary">Copy to clipboard</button>'
          : '<button class="btn-confirm act act-primary">Load</button>'}
      </div>
    </div>`;
  document.body.appendChild(dlg);
  const ta = dlg.querySelector<HTMLTextAreaElement>('textarea')!;
  dlg.querySelector('.btn-cancel')!.addEventListener('click', () => dlg.remove());
  dlg.querySelector('.btn-copy')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(ta.value).catch(() => { ta.select(); });
    dlg.remove();
  });
  dlg.querySelector('.btn-confirm')?.addEventListener('click', () => {
    opts.onConfirm(ta.value);
    dlg.remove();
  });
}
