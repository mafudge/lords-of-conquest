import type { SetupState } from './state.js';
import type { Persona } from '../../game/types.js';
import { renderPreview } from './mapPreview.js';
import { encodeMap, decodeMap } from '../../game/mapTextCodec.js';
import { openMapTextDialog } from './mapTextDialog.js';
import { buildPreviewState } from './mapPreview.js';

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

  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  function triggerPreview(): void {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const host = root.querySelector<HTMLElement>('.preview-board');
      if (host) {
        try {
          renderPreview(host, state.setup, state.seed);
        } catch {
          // Map generation may fail for edge-case parameter combinations; ignore silently.
        }
      }
    }, 200);
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

    root.querySelector<HTMLInputElement>('input[name="cities-to-win"]')!.addEventListener('change', (e) => {
      state.setup.citiesToWin = Number((e.target as HTMLInputElement).value) as 3|4|5|6|7|8;
    });
    root.querySelectorAll<HTMLInputElement>('input[name="eoc"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        state.setup.elementOfChance = inp.value as 'low'|'medium'|'high';
      });
    });
    root.querySelector<HTMLInputElement>('input[name="randomize-order"]')!.addEventListener('change', (e) => {
      state.setup.randomizePlayerOrder = (e.target as HTMLInputElement).checked;
    });
    root.querySelector<HTMLInputElement>('input[name="water-boundary"]')!.addEventListener('change', (e) => {
      state.setup.map.waterBoundary = (e.target as HTMLInputElement).checked;
      triggerPreview();
    });
    root.querySelectorAll<HTMLInputElement>('input[name="water-area"]').forEach((inp) =>
      inp.addEventListener('change', () => {
        state.setup.map.waterArea = inp.value as 'small'|'medium'|'large'; triggerPreview();
      }));
    root.querySelector<HTMLSelectElement>('select[name="num-territories"]')!.addEventListener('change', (e) => {
      state.setup.map.numTerritories = Number((e.target as HTMLSelectElement).value);
      triggerPreview();
    });
    root.querySelectorAll<HTMLInputElement>('input[name="islands"]').forEach((inp) =>
      inp.addEventListener('change', () => {
        state.setup.map.islands = inp.value as 'none'|'some'|'lots'; triggerPreview();
      }));
    root.querySelectorAll<HTMLInputElement>('input[name="shapes"]').forEach((inp) =>
      inp.addEventListener('change', () => {
        state.setup.map.shapes = inp.value as 'regular'|'irregular'; triggerPreview();
      }));
    root.querySelectorAll<HTMLInputElement>('input[name="res-mode"]').forEach((inp) =>
      inp.addEventListener('change', () => {
        state.setup.map.resourceDensity.kind = inp.value as 'fixed'|'random';
        triggerPreview();
      }));
    root.querySelectorAll<HTMLInputElement>('input[name="res-density"]').forEach((inp) =>
      inp.addEventListener('change', () => {
        state.setup.map.resourceDensity.level = inp.value as 'veryLow'|'low'|'medium'|'high'; triggerPreview();
      }));
    root.querySelector<HTMLButtonElement>('.btn-reroll')!.addEventListener('click', () => {
      state.seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
      root.querySelector<HTMLElement>('.seed-display')!.textContent = `seed: ${state.seed}`;
      triggerPreview();
    });
    root.querySelector<HTMLButtonElement>('.btn-save-map')!.addEventListener('click', () => {
      try {
        const preview = buildPreviewState(state.setup, state.seed);
        openMapTextDialog({
          mode: 'save', initial: encodeMap(preview.squares),
          onConfirm: () => {},
        });
      } catch (err) {
        alert(`Cannot generate map: ${(err as Error).message}`);
      }
    });
    root.querySelector<HTMLButtonElement>('.btn-load-map')!.addEventListener('click', () => {
      openMapTextDialog({
        mode: 'load', initial: '',
        onConfirm: (text) => {
          try {
            const decoded = decodeMap(text);
            if (decoded.kind === 'error') {
              alert(`Map text invalid: ${decoded.message}`);
              return;
            }
            state.setup.map.numTerritories = decoded.numTerritories as any;
            triggerPreview();
          } catch (err) {
            alert(`Map text invalid: ${(err as Error).message}`);
          }
        },
      });
    });
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
          <section class="rules-section"><h2>Rules</h2><div class="rules-grid">
            <label>Cities to win <input name="cities-to-win" type="number" min="3" max="8" value="${s.setup.citiesToWin}" /></label>
            <label>Element of Chance:
              <input type="radio" name="eoc" value="low"${s.setup.elementOfChance === 'low' ? ' checked' : ''} /> Low
              <input type="radio" name="eoc" value="medium"${s.setup.elementOfChance === 'medium' ? ' checked' : ''} /> Med
              <input type="radio" name="eoc" value="high"${s.setup.elementOfChance === 'high' ? ' checked' : ''} /> High
            </label>
            <label><input type="checkbox" name="randomize-order"${s.setup.randomizePlayerOrder ? ' checked' : ''} /> Randomize player order</label>
          </div></section>
          <section class="map-section"><h2>Map options</h2><div class="map-grid">
            <label><input type="checkbox" name="water-boundary"${s.setup.map.waterBoundary ? ' checked' : ''} /> Water boundary</label>
            <label>Water area:
              ${(['small', 'medium', 'large'] as const).map((v) =>
                `<input type="radio" name="water-area" value="${v}"${s.setup.map.waterArea === v ? ' checked' : ''} /> ${v}`).join(' ')}
            </label>
            <label>Territories <select name="num-territories">
              ${[8,12,16,20,24,32,40,48,56,64].map((n) =>
                `<option value="${n}"${s.setup.map.numTerritories === n ? ' selected' : ''}>${n}</option>`).join('')}
            </select></label>
            <label>Islands:
              ${(['none','some','lots'] as const).map((v) =>
                `<input type="radio" name="islands" value="${v}"${s.setup.map.islands === v ? ' checked' : ''} /> ${v}`).join(' ')}
            </label>
            <label>Shapes:
              ${(['regular','irregular'] as const).map((v) =>
                `<input type="radio" name="shapes" value="${v}"${s.setup.map.shapes === v ? ' checked' : ''} /> ${v}`).join(' ')}
            </label>
          </div></section>
          <section class="resources-section"><h2>Resources</h2><div class="resources-grid">
            <label>Mode:
              <input type="radio" name="res-mode" value="fixed"${s.setup.map.resourceDensity.kind === 'fixed' ? ' checked' : ''} /> Fixed
              <input type="radio" name="res-mode" value="random"${s.setup.map.resourceDensity.kind === 'random' ? ' checked' : ''} /> Random
            </label>
            <label>Density:
              ${(['veryLow','low','medium','high'] as const).map((v) =>
                `<input type="radio" name="res-density" value="${v}"${s.setup.map.resourceDensity.level === v ? ' checked' : ''} /> ${v.replace('veryLow','very low')}`).join(' ')}
            </label>
          </div></section>
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
  triggerPreview();
}
