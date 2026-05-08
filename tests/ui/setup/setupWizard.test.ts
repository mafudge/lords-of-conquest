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
});
