import { describe, it, expect } from 'vitest';
import type {
  Player, Boat, Stockpile, PlayerColor, GameState, GameSetup,
  ElementOfChance, Persona, Phase, ResourceDensity,
} from '../src/game/types.js';

describe('engine types', () => {
  it('Stockpile is a 5-tuple of numbers', () => {
    const s: Stockpile = [0, 0, 0, 0, 0];
    expect(s).toHaveLength(5);
  });

  it('Player has id, color, persona, status, stockpile, stockpileLocation, name', () => {
    const p: Player = {
      id: 0,
      name: 'Red',
      color: 'red',
      persona: 'human',
      status: 'playing',
      stockpile: [0, 0, 0, 0, 0],
      stockpileLocation: null,
    };
    expect(p.id).toBe(0);
  });

  it('Boat has owner, position, cargo flags', () => {
    const b: Boat = {
      id: 0,
      x: 5, y: 5,
      homeTerritoryId: 0,
      ownerId: 0,
      carryHorse: false,
      carryWeapon: false,
    };
    expect(b.id).toBe(0);
  });

  it('PlayerColor and Persona unions accept all expected values', () => {
    const cs: PlayerColor[] = ['red', 'blue', 'cyan', 'purple', 'orange', 'green', 'yellow'];
    const ps: Persona[] = ['human', 'passive', 'defensive', 'aggressive'];
    expect(cs).toHaveLength(7);
    expect(ps).toHaveLength(4);
  });

  it('Phase covers all setup + 5 game phases + gameOver', () => {
    const phases: Phase[] = [
      'setup', 'selection', 'production', 'trade', 'shipment',
      'conquest', 'development', 'gameOver',
    ];
    expect(phases).toHaveLength(8);
  });

  it('ElementOfChance accepts low/medium/high', () => {
    const e: ElementOfChance[] = ['low', 'medium', 'high'];
    expect(e).toHaveLength(3);
  });

  it('GameSetup carries players + cities to win + chance + map params', () => {
    const setup: GameSetup = {
      players: [{ color: 'red', name: 'Red', persona: 'human' }, { color: 'blue', name: 'Blue', persona: 'aggressive' }],
      citiesToWin: 5,
      elementOfChance: 'high',
      randomizePlayerOrder: false,
      map: {
        waterBoundary: true,
        waterArea: 'small',
        numTerritories: 24,
        islands: 'some',
        shapes: 'regular',
        resourceDensity: { kind: 'fixed', level: 'medium' },
      },
    };
    expect(setup.citiesToWin).toBe(5);
  });

  it('GameState has the field set described in the spec', () => {
    // Type-only: this compiles iff the type definition is correct.
    const _hasFields = (s: GameState): unknown => [
      s.schemaVersion, s.seed, s.rngCursor, s.setup, s.squares, s.territories,
      s.boats, s.players, s.turnOrder, s.currentPhase, s.currentPlayer,
      s.year, s.attackNumber, s.shipmentUsed, s.pendingTrade, s.pendingCombat,
      s.rejectedTrades, s.autoReject, s.log,
    ];
    expect(typeof _hasFields).toBe('function');
  });
});
