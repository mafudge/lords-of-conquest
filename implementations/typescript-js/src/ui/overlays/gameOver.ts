export function openGameOver(opts: {
  winnerName: string; winnerColor: string; year: number;
  onNewGame: () => void;
}): void {
  document.querySelector('.game-over')?.remove();
  const dlg = document.createElement('div');
  dlg.className = 'game-over overlay-backdrop';
  dlg.innerHTML = `
    <div class="overlay-panel game-over-panel">
      <h1>${opts.winnerName} wins!</h1>
      <p>Year ${opts.year} · player color: ${opts.winnerColor}</p>
      <div class="overlay-actions">
        <button class="btn-new-game-over act act-primary">New Game</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.querySelector('.btn-new-game-over')!.addEventListener('click', () => {
    dlg.remove(); opts.onNewGame();
  });
}
