// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { openAlliesDialog } from '../../../src/ui/overlays/alliesDialog.js';

describe('openAlliesDialog', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('renders 3 choice buttons and dispatches the picked one', () => {
    let pick: string | null = null;
    openAlliesDialog({
      attackerName: 'Red', defenderName: 'Blue',
      onChoice: (c) => { pick = c; },
    });
    expect(document.querySelectorAll('.allies-dialog .choice')).toHaveLength(3);
    document.querySelector<HTMLButtonElement>('.choice[data-choice="defender"]')!.click();
    expect(pick).toBe('defender');
  });
});
