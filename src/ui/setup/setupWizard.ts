import type { SetupState } from './state.js';

export function mountSetupWizard(
  root: HTMLElement,
  opts: { initial: SetupState; onStart: (s: SetupState) => void },
): void {
  const state: SetupState = opts.initial;
  root.innerHTML = `
    <div class="setup-modal">
      <div class="setup-pane setup-form">
        <h1>New Game</h1>
        <section class="players-section">
          <h2>Players</h2>
          <div class="players-list">
            ${state.setup.players.map((p, i) => `
              <div class="player-slot" data-slot="${i}">
                <span class="swatch" style="background: var(--p${i})"></span>
                <input class="name-input" value="${p.name}" />
                <select class="persona-select">
                  <option value="human"${p.persona === 'human' ? ' selected' : ''}>Human</option>
                  <option value="passive"${p.persona === 'passive' ? ' selected' : ''}>Passive</option>
                  <option value="defensive"${p.persona === 'defensive' ? ' selected' : ''}>Defensive</option>
                  <option value="aggressive"${p.persona === 'aggressive' ? ' selected' : ''}>Aggressive</option>
                </select>
                <button class="btn-remove-slot" data-slot="${i}">×</button>
              </div>`).join('')}
          </div>
          <button class="btn-add-slot">+ Add player</button>
        </section>
        <section class="rules-section">
          <h2>Rules</h2>
          <div class="rules-grid"></div>
        </section>
        <section class="map-section">
          <h2>Map options</h2>
          <div class="map-grid"></div>
        </section>
        <section class="resources-section">
          <h2>Resources</h2>
          <div class="resources-grid"></div>
        </section>
        <section class="map-text-section">
          <h2>Map text</h2>
          <button class="btn-save-map">Save current map</button>
          <button class="btn-load-map">Load map text</button>
        </section>
        <footer class="setup-footer">
          <button class="btn-reset">Reset to defaults</button>
          <button class="btn-start act act-primary">Start Game</button>
        </footer>
      </div>
      <div class="setup-pane setup-preview">
        <div class="preview-header">
          <button class="btn-reroll">Re-roll seed</button>
          <span class="seed-display">seed: ${state.seed}</span>
        </div>
        <div class="preview-board"></div>
        <div class="preview-meta"></div>
      </div>
    </div>
  `;

  const startBtn = root.querySelector<HTMLButtonElement>('.btn-start')!;
  startBtn.addEventListener('click', () => opts.onStart(state));
}
