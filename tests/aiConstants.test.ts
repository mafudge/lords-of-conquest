import { describe, it, expect } from 'vitest';
import * as A from '../src/game/aiConstants.js';

describe('AI constants', () => {
  it('matches LocAI.java L15-50 exactly', () => {
    expect(A.ptCity).toBe(8);
    expect(A.ptStockpile).toBe(15);
    expect(A.ptRatingsBoundary).toBe(50);
    expect(A.ptCanBuildCity).toBe(8);
    expect(A.ptCanBuildWeapon).toBe(3);
    expect(A.ptCanBuildBoat).toBe(2);
    expect(A.ptExistingHorses).toBe(1);
    expect(A.ptTerrWRes).toBe(2);
    expect(A.ptOppCity).toBe(-8);
    expect(A.ptOppWinCity).toBe(-10000);
    expect(A.ptFCAdvOwnTerr).toBe(1);
    expect(A.ptFCAdvOppTerr).toBe(1);
    expect(A.ptFCDisOwnTerr).toBe(-5);
    expect(A.ptFCDisOppTerr).toBe(-3);
    expect(A.ptVulnerableHorse).toBe(-2);
    expect(A.ptVulnerableWeapon).toBe(-6);
    expect(A.ptVulnerableBoat).toBe(-4);
    expect(A.ptVulnerableCity).toBe(-8);
    expect(A.ptFCDisStockpile).toBe(-5);
    expect(A.ptFCAdvStockpile).toBe(1);
    expect(A.ptGroupHorseWeapon).toBe(1);
    expect(A.ptGroupBoatHW).toBe(1);
    expect(A.ptOwnForceCount).toBe(1);
    expect(A.ptOppForceCount).toBe(-1);
    expect(A.ptOppBoatPotential).toBe(-6);
    expect(A.ptOneOfEach).toBe(2);
    expect(A.ptIronAndCoal).toBe(2);
    expect(A.ptFirstOfType).toBe(3);
    expect(A.ptTouchTerr).toBe(1);
    expect(A.ptTouchTerrWResource).toBe(2);
    expect(A.ptTerrVulnerable).toBe(-5);
    expect(A.ptTouchOwnTerr).toBe(1);
    expect(A.ptTouchOwnTerrWResource).toBe(2);
  });

  it('ptResource is [7, 7, 7, 9, 7]', () => {
    expect(A.ptResource).toEqual([7, 7, 7, 9, 7]);
    expect(A.ptResource).toHaveLength(5);
  });

  it('persona codes match LocAI.java L9-12', () => {
    expect(A.PERSONA_HUMAN).toBe(0);
    expect(A.PERSONA_PASSIVE).toBe(1);
    expect(A.PERSONA_DEFENSIVE).toBe(2);
    expect(A.PERSONA_AGGRESSIVE).toBe(3);
  });
});
