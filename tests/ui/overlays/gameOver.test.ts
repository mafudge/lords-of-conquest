// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { openGameOver } from '../../../src/ui/overlays/gameOver.js';

describe('openGameOver', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('renders winner name + New Game button', () => {
    openGameOver({ winnerName: 'Blue', winnerColor: 'blue', year: 8, onNewGame: () => {} });
    expect(document.querySelector('.game-over')!.textContent).toContain('Blue');
    expect(document.querySelector('.btn-new-game-over')).not.toBeNull();
  });
});
