import type { SetupState } from './state.js';
import type { Persona } from '../../game/types.js';

const COLORS = ['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'] as const;

export function mountSetupWizard(
  root: HTMLElement,
  opts: { initial: SetupState; onStart: (s: SetupState) => void },
): void {
  let state: SetupState = JSON.parse(JSON.stringify(opts.initial));

  function rerender(): void {
    root.innerHTML = renderTemplate(state);
    wireEvents();
  }

  function nextUnusedColor(): typeof COLORS[number] {
    const used = new Set(state.setup.players.map((p) => p.color));
    for (const c of COLORS) if (!used.has(c)) return c;
    return COLORS[0];
  }

  function wireEvents(): void {
    root.querySelector('.btn-add-slot')!.addEventListener('click', () => {
      if (state.setup.players.length >= 7) return;
      state.setup.players.push({
        color: nextUnusedColor(),
        name: 'Player' + (state.setup.players.length + 1),
        persona: 'aggressive',
      });
      rerender();
    });
    root.querySelectorAll<HTMLButtonElement>('.btn-remove-slot').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (state.setup.players.length <= 2) return;
        const slot = Number(btn.dataset.slot);
        state.setup.players.splice(slot, 1);
        rerender();
      });
    });
    root.querySelectorAll<HTMLInputElement>('.name-input').forEach((inp) => {
      inp.addEventListener('change', () => {
        const slot = Number(inp.closest<HTMLElement>('.player-slot')!.dataset.slot);
        state.setup.players[slot]!.name = inp.value;
      });
    });
    root.querySelectorAll<HTMLSelectElement>('.persona-select').forEach((sel) => {
      sel.addEventListener('change', () => {
        const slot = Number(sel.closest<HTMLElement>('.player-slot')!.dataset.slot);
        state.setup.players[slot]!.persona = sel.value as Persona;
      });
    });
    root.querySelector('.btn-start')!.addEventListener('click', () => opts.onStart(state));
  }

  function renderTemplate(s: SetupState): string {
    const slots = s.setup.players.map((p, i) => `
      <div class="player-slot" data-slot="${i}">
        <span class="swatch" style="background: var(--p${COLORS.indexOf(p.color as typeof COLORS[number])})"></span>
        <input class="name-input" value="${p.name}" />
        <select class="persona-select">
          <option value="human"${p.persona === 'human' ? ' selected' : ''}>Human</option>
          <option value="passive"${p.persona === 'passive' ? ' selected' : ''}>Passive</option>
          <option value="defensive"${p.persona === 'defensive' ? ' selected' : ''}>Defensive</option>
          <option value="aggressive"${p.persona === 'aggressive' ? ' selected' : ''}>Aggressive</option>
        </select>
        <button class="btn-remove-slot" data-slot="${i}">×</button>
      </div>`).join('');

    return `
      <div class="setup-modal">
        <div class="setup-pane setup-form">
          <h1>New Game</h1>
          <section class="players-section">
            <h2>Players (${s.setup.players.length}/7)</h2>
            <div class="players-list">${slots}</div>
            <button class="btn-add-slot"${s.setup.players.length >= 7 ? ' disabled' : ''}>+ Add player</button>
          </section>
          <section class="rules-section"><h2>Rules</h2><div class="rules-grid"></div></section>
          <section class="map-section"><h2>Map options</h2><div class="map-grid"></div></section>
          <section class="resources-section"><h2>Resources</h2><div class="resources-grid"></div></section>
          <section class="map-text-section"><h2>Map text</h2><button class="btn-save-map">Save current map</button><button class="btn-load-map">Load map text</button></section>
          <footer class="setup-footer">
            <button class="btn-reset">Reset to defaults</button>
            <button class="btn-start act act-primary">Start Game</button>
          </footer>
        </div>
        <div class="setup-pane setup-preview">
          <div class="preview-header">
            <button class="btn-reroll">Re-roll seed</button>
            <span class="seed-display">seed: ${s.seed}</span>
          </div>
          <div class="preview-board"></div>
          <div class="preview-meta"></div>
        </div>
      </div>`;
  }

  rerender();
}
