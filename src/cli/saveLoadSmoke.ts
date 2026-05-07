#!/usr/bin/env node
import { reduce } from '../game/reducer.js';
import type { GameState, GameSetup } from '../game/types.js';

const setup: GameSetup = {
  players: [
    { color: 'red', name: 'Red', persona: 'human' },
    { color: 'blue', name: 'Blue', persona: 'aggressive' },
  ],
  citiesToWin: 3, elementOfChance: 'high', randomizePlayerOrder: false,
  map: { waterBoundary: true, waterArea: 'small', numTerritories: 24, islands: 'some', shapes: 'regular', resourceDensity: { kind: 'fixed', level: 'medium' } },
};

const initial = (): GameState => ({
  schemaVersion: 1, seed: 0, rngCursor: 0,
  setup, squares: [], territories: [], boats: [], players: [],
  touching: [], distance: [],
  turnOrder: [], currentPhase: 'setup', currentPlayer: 0,
  year: 0, attackNumber: 1, shipmentUsed: false, shipmentForfeitsSecondAttack: [],
  pendingTrade: null, pendingCombat: null,
  rejectedTrades: [], autoReject: [], log: [],
});

const seed = Number(process.argv[2] ?? 12345);
let s = reduce(initial(), { kind: 'newGame', setup, seed });
// Drain selection
while (s.territories.some((t) => t.ownerId === null)) {
  const free = s.territories.find((t) => t.ownerId === null)!;
  s = reduce(s, { kind: 'selection', player: s.currentPlayer, territoryId: free.id });
}
s = reduce(s, { kind: 'endPhase', player: s.currentPlayer });

console.log('Roundtripping GameState through JSON...');
// Serialize Sets via JSON: bordersLakes is a Set, so JSON drops it. We serialize
// by replacing Sets with arrays explicitly in the envelope and rehydrating.
const serialized = JSON.stringify(s, (_, v) => {
  if (v instanceof Set) return { __set: [...v] };
  return v;
});
const reconstructed = JSON.parse(serialized, (_, v) => {
  if (v && typeof v === 'object' && '__set' in v && Array.isArray((v as { __set: unknown[] }).__set)) {
    return new Set((v as { __set: number[] }).__set);
  }
  return v;
}) as GameState;

console.log('Verifying state shape...');
if (reconstructed.schemaVersion !== 1) throw new Error('schemaVersion mismatch');
if (reconstructed.players.length !== s.players.length) throw new Error('players length mismatch');
if (reconstructed.territories.length !== s.territories.length) throw new Error('territories length mismatch');
console.log('OK.');

console.log('Running production on the reconstructed state...');
const out = reduce(reconstructed, { kind: 'production' });
console.log(`Phase: ${out.currentPhase}`);
console.log(`Last log: ${out.log[out.log.length - 1]!.message}`);
console.log('save/load smoke complete.');
