export function openAlliesDialog(opts: {
  attackerName: string; defenderName: string;
  onChoice: (choice: 'attacker' | 'neutral' | 'defender') => void;
}): void {
  document.querySelector('.allies-dialog')?.remove();
  const dlg = document.createElement('div');
  dlg.className = 'allies-dialog overlay-backdrop';
  dlg.innerHTML = `
    <div class="overlay-panel">
      <h2>${opts.attackerName} attacks ${opts.defenderName}</h2>
      <p>Whose side will you take?</p>
      <div class="overlay-actions">
        <button class="choice act" data-choice="attacker">Attacker</button>
        <button class="choice act" data-choice="neutral">Neutral</button>
        <button class="choice act" data-choice="defender">Defender</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) => {
    b.addEventListener('click', () => {
      const c = b.dataset.choice as 'attacker' | 'neutral' | 'defender';
      dlg.remove();
      opts.onChoice(c);
    });
  });
}
