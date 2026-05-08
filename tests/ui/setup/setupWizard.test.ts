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
});
