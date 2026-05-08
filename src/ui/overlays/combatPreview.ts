import { getState } from '../main.js';
import { getCombatStrength } from '../../game/combat.js';

export function openCombatPreview(opts: {
  attackerId: number; defenderId: number | null;
  fromTerritoryId: number; targetTerritoryId: number;
  onAttack: () => void; onCancel: () => void;
}): void {
  document.querySelector('.combat-preview')?.remove();
  const state = getState();
  if (!state) return;
  const synth = {
    ...state,
    pendingCombat: {
      attackerId: opts.attackerId, defenderId: opts.defenderId,
      fromTerritoryId: opts.fromTerritoryId, targetTerritoryId: opts.targetTerritoryId,
      boatId: null, horseFromTerritoryId: null, weaponFromTerritoryId: null,
      alliesDecisions: [], alliesPending: new Set(),
      attackerStrength: 0, defenderStrength: 0,
      resolved: false, attackerWon: false,
    } as any,
  };
  const { attackerStrength, defenderStrength } = getCombatStrength(synth, synth.pendingCombat);
  const dlg = document.createElement('div');
  dlg.className = 'combat-preview overlay-backdrop';
  dlg.innerHTML = `
    <div class="overlay-panel">
      <h2>Attack T${opts.targetTerritoryId}?</h2>
      <div class="strengths">
        <div>Attacker: <strong>${attackerStrength}</strong></div>
        <div>Defender: <strong>${defenderStrength}</strong></div>
      </div>
      <div class="overlay-actions">
        <button class="btn-cancel act">Cancel</button>
        <button class="btn-attack act act-primary">Attack</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.querySelector('.btn-cancel')!.addEventListener('click', () => { dlg.remove(); opts.onCancel(); });
  dlg.querySelector('.btn-attack')!.addEventListener('click', () => { dlg.remove(); opts.onAttack(); });
}
