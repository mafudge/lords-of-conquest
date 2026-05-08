import type { GameSetup, Persona } from '../../game/types.js';

export type SetupState = {
  setup: GameSetup;
  seed: number;
};

export function defaultSetupState(): SetupState {
  const colors = ['red', 'blue', 'cyan', 'purple'] as const;
  const personas: Persona[] = ['human', 'aggressive', 'aggressive', 'aggressive'];
  return {
    seed: Math.floor(Math.random() * 0xffffffff) >>> 0,
    setup: {
      players: colors.map((c, i) => ({
        color: c, name: c[0]!.toUpperCase() + c.slice(1),
        persona: personas[i]!,
      })),
      citiesToWin: 5,
      elementOfChance: 'high',
      randomizePlayerOrder: false,
      map: {
        waterBoundary: true, waterArea: 'small', numTerritories: 24,
        islands: 'some', shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' },
      },
    },
  };
}
