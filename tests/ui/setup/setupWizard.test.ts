// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mountSetupWizard } from '../../../src/ui/setup/setupWizard.js';
import { defaultSetupState } from '../../../src/ui/setup/state.js';

describe('mountSetupWizard', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; });

  it('mounts a two-pane setup screen with a left form and right preview', () => {
    mountSetupWizard(document.getElementById('app')!, {
      initial: defaultSetupState(), onStart: () => {},
    });
    expect(document.querySelector('.setup-pane.setup-form')).not.toBeNull();
    expect(document.querySelector('.setup-pane.setup-preview')).not.toBeNull();
  });

  it('mounts default 4 player slots', () => {
    mountSetupWizard(document.getElementById('app')!, {
      initial: defaultSetupState(), onStart: () => {},
    });
    expect(document.querySelectorAll('.player-slot')).toHaveLength(4);
  });

  it('Start Game button is present (may be disabled until valid)', () => {
    mountSetupWizard(document.getElementById('app')!, {
      initial: defaultSetupState(), onStart: () => {},
    });
    const btn = document.querySelector<HTMLButtonElement>('.btn-start');
    expect(btn).not.toBeNull();
  });

  it('clicking + Add player adds a slot up to 7', () => {
    mountSetupWizard(document.getElementById('app')!, {
      initial: defaultSetupState(), onStart: () => {},
    });
    document.querySelector<HTMLButtonElement>('.btn-add-slot')!.click();
    expect(document.querySelectorAll('.player-slot')).toHaveLength(5);
    // Add up to 7
    document.querySelector<HTMLButtonElement>('.btn-add-slot')!.click();
    document.querySelector<HTMLButtonElement>('.btn-add-slot')!.click();
    expect(document.querySelectorAll('.player-slot')).toHaveLength(7);
    // 8th add should be no-op (button disabled)
    const btn = document.querySelector<HTMLButtonElement>('.btn-add-slot')!;
    btn.click();
    expect(document.querySelectorAll('.player-slot')).toHaveLength(7);
  });

  it('clicking remove drops a slot, but keeps minimum 2', () => {
    mountSetupWizard(document.getElementById('app')!, {
      initial: defaultSetupState(), onStart: () => {},
    });
    document.querySelector<HTMLButtonElement>('.btn-remove-slot')!.click();
    expect(document.querySelectorAll('.player-slot')).toHaveLength(3);
    document.querySelector<HTMLButtonElement>('.btn-remove-slot')!.click();
    expect(document.querySelectorAll('.player-slot')).toHaveLength(2);
    // Should not go below 2
    document.querySelector<HTMLButtonElement>('.btn-remove-slot')!.click();
    expect(document.querySelectorAll('.player-slot')).toHaveLength(2);
  });

  it('renders the cities-to-win stepper, EoC radio, randomize toggle', () => {
    mountSetupWizard(document.getElementById('app')!, {
      initial: defaultSetupState(), onStart: () => {},
    });
    expect(document.querySelector('input[name="cities-to-win"]')).not.toBeNull();
    expect(document.querySelectorAll('input[name="eoc"]')).toHaveLength(3);
    expect(document.querySelector('input[name="randomize-order"]')).not.toBeNull();
  });

  it('renders the map options (water/territories/islands/shapes)', () => {
    mountSetupWizard(document.getElementById('app')!, {
      initial: defaultSetupState(), onStart: () => {},
    });
    expect(document.querySelector('input[name="water-boundary"]')).not.toBeNull();
    expect(document.querySelectorAll('input[name="water-area"]')).toHaveLength(3);
    expect(document.querySelector('select[name="num-territories"]')).not.toBeNull();
  });

  it('changing cities-to-win updates state', () => {
    let captured: any = null;
    mountSetupWizard(document.getElementById('app')!, {
      initial: defaultSetupState(),
      onStart: (s) => { captured = s; },
    });
    const inp = document.querySelector<HTMLInputElement>('input[name="cities-to-win"]')!;
    inp.value = '7';
    inp.dispatchEvent(new Event('change'));
    document.querySelector<HTMLButtonElement>('.btn-start')!.click();
    expect(captured.setup.citiesToWin).toBe(7);
  });

  it('renders a preview SVG board', async () => {
    mountSetupWizard(document.getElementById('app')!, {
      initial: defaultSetupState(), onStart: () => {},
    });
    // Preview is async (debounced); wait briefly.
    await new Promise((r) => setTimeout(r, 250));
    expect(document.querySelector('.preview-board .board-svg')).not.toBeNull();
  });

  it('Re-roll seed updates the seed-display', () => {
    mountSetupWizard(document.getElementById('app')!, {
      initial: { ...defaultSetupState(), seed: 42 }, onStart: () => {},
    });
    const before = document.querySelector('.seed-display')!.textContent;
    document.querySelector<HTMLButtonElement>('.btn-reroll')!.click();
    const after = document.querySelector('.seed-display')!.textContent;
    expect(after).not.toBe(before);
  });

  it('clicking Save Map opens a dialog with the encoded map text', () => {
    mountSetupWizard(document.getElementById('app')!, {
      initial: defaultSetupState(), onStart: () => {},
    });
    document.querySelector<HTMLButtonElement>('.btn-save-map')!.click();
    expect(document.querySelector('.map-text-dialog')).not.toBeNull();
    expect(document.querySelector<HTMLTextAreaElement>('.map-text-dialog textarea')!.value.length).toBeGreaterThan(0);
  });

  it('Load Map dialog opens an empty textarea', () => {
    mountSetupWizard(document.getElementById('app')!, {
      initial: defaultSetupState(), onStart: () => {},
    });
    document.querySelector<HTMLButtonElement>('.btn-load-map')!.click();
    expect(document.querySelector<HTMLTextAreaElement>('.map-text-dialog textarea')!.value).toBe('');
  });
});
