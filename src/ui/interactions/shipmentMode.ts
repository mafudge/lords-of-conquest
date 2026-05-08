import type { GameState } from '../../game/types.js';
import { dispatch } from '../main.js';
import { type InteractionMode, markCandidates, clearCandidates } from './interactionMode.js';

type Sub = 'none' | 'stockpile' | 'horse-source' | 'horse-dest'
  | 'weapon-source' | 'weapon-dest' | 'boat-source' | 'boat-dest';

let sub: Sub = 'none';
let pendingFrom: number | null = null;
let pendingBoatId: number | null = null;

export const shipmentMode = {
  getSub(): string { return sub; },

  setSub(next: 'stockpile' | 'horse' | 'weapon' | 'boat' | 'none'): void {
    pendingFrom = null;
    pendingBoatId = null;
    if (next === 'horse') sub = 'horse-source';
    else if (next === 'weapon') sub = 'weapon-source';
    else if (next === 'boat') sub = 'boat-source';
    else if (next === 'stockpile') sub = 'stockpile';
    else sub = 'none';
  },

  enter(state: GameState): void { highlightSources(state); },

  handleClick(territoryId: number, state: GameState): void {
    if (sub === 'stockpile') {
      const me = state.players[state.currentPlayer]!;
      const t = state.territories[territoryId];
      if (!t || t.ownerId !== state.currentPlayer || territoryId === me.stockpileLocation) return;
      dispatch({ kind: 'shipStockpile', player: state.currentPlayer,
        from: me.stockpileLocation!, to: territoryId });
      sub = 'none';
      return;
    }
    if (sub === 'horse-source') {
      const t = state.territories[territoryId];
      if (!t || t.ownerId !== state.currentPlayer || !t.hasHorse) return;
      pendingFrom = territoryId;
      sub = 'horse-dest';
      highlightHorseDestinations(state, territoryId);
      return;
    }
    if (sub === 'horse-dest' && pendingFrom !== null) {
      // Accept either adjacent or 2-hop with rest-stop (engine validates).
      dispatch({ kind: 'shipHorse', player: state.currentPlayer,
        from: pendingFrom, to: territoryId });
      sub = 'none'; pendingFrom = null;
      return;
    }
    if (sub === 'weapon-source') {
      const t = state.territories[territoryId];
      if (!t || t.ownerId !== state.currentPlayer || !t.hasWeapon) return;
      pendingFrom = territoryId;
      sub = 'weapon-dest';
      highlightAdjacentOwned(state, territoryId);
      return;
    }
    if (sub === 'weapon-dest' && pendingFrom !== null) {
      dispatch({ kind: 'shipWeapon', player: state.currentPlayer,
        from: pendingFrom, to: territoryId });
      sub = 'none'; pendingFrom = null;
      return;
    }
    if (sub === 'boat-source') {
      // Pick a boat by clicking its home territory; engine moves boat to clicked water.
      // Simplification: prompt boat picker not in this task. Defer boat clicks: pick first owned boat.
      const ownedBoats = state.boats
        .map((b, i) => b && b.ownerId === state.currentPlayer ? i : -1)
        .filter((i) => i >= 0);
      if (ownedBoats.length === 0) return;
      pendingBoatId = ownedBoats[0]!;
      sub = 'boat-dest';
      highlightBoatDestinations(state, pendingBoatId);
      return;
    }
    if (sub === 'boat-dest' && pendingBoatId !== null) {
      // Find the water square in the clicked territory area; or accept any water square click.
      // For Plan 6 simplicity, the boat-dest click expects the user to click a water-adjacent
      // territory; we extract a destination water square via the engine's expected boat-move plan.
      // Here we just dispatch with the territory's first water-adjacent square (engine validates).
      const sq = state.squares.find((s) => s.territoryId === territoryId);
      if (!sq) return;
      dispatch({ kind: 'shipBoat', player: state.currentPlayer,
        boatId: pendingBoatId, toX: sq.x, toY: sq.y });
      sub = 'none'; pendingBoatId = null;
      return;
    }
  },

  exit(): void { sub = 'none'; pendingFrom = null; pendingBoatId = null; clearCandidates(); },
} as InteractionMode & { getSub: () => string; setSub: (n: any) => void };

function highlightSources(state: GameState): void {
  clearCandidates();
  const me = state.currentPlayer;
  const candidates = new Set<number>();
  if (sub === 'stockpile') {
    state.territories.forEach((t, i) => {
      if (t.ownerId === me && i !== state.players[me]!.stockpileLocation) candidates.add(i);
    });
  } else if (sub === 'horse-source') {
    state.territories.forEach((t, i) => {
      if (t.ownerId === me && t.hasHorse) candidates.add(i);
    });
  } else if (sub === 'weapon-source') {
    state.territories.forEach((t, i) => {
      if (t.ownerId === me && t.hasWeapon) candidates.add(i);
    });
  } else if (sub === 'boat-source') {
    state.boats.forEach((b) => {
      if (b && b.ownerId === me) candidates.add(b.homeTerritoryId);
    });
  }
  markCandidates(candidates, state);
}

function highlightAdjacentOwned(state: GameState, from: number): void {
  clearCandidates();
  const me = state.currentPlayer;
  const candidates = new Set<number>();
  state.territories.forEach((t, i) => {
    if (i !== from && t.ownerId === me && state.touching[from]?.[i]) candidates.add(i);
  });
  markCandidates(candidates, state);
}

function highlightHorseDestinations(state: GameState, from: number): void {
  // 1-hop adjacent owned, OR 2-hop owned via rest-stop chain — engine validates exact rules.
  clearCandidates();
  const me = state.currentPlayer;
  const candidates = new Set<number>();
  state.territories.forEach((t, i) => {
    if (i === from || t.ownerId !== me) return;
    if (state.touching[from]?.[i]) { candidates.add(i); return; }
    // 2-hop via owned chain
    for (let m = 0; m < state.territories.length; m++) {
      if (m === from || m === i) continue;
      if (state.territories[m]?.ownerId !== me) continue;
      if (state.touching[from]?.[m] && state.touching[m]?.[i]) { candidates.add(i); break; }
    }
  });
  markCandidates(candidates, state);
}

function highlightBoatDestinations(state: GameState, boatId: number): void {
  clearCandidates();
  const me = state.currentPlayer;
  const boat = state.boats[boatId];
  if (!boat) return;
  const home = state.territories[boat.homeTerritoryId];
  if (!home) return;
  // Mark territories that border any of the boat's home lakes (proxy for water reachable on same lake).
  const candidates = new Set<number>();
  state.territories.forEach((t, i) => {
    if (t.ownerId === me) return; // land destinations on shore — treat as proxy
    for (const lk of home.bordersLakes) if (t.bordersLakes.has(lk)) { candidates.add(i); break; }
  });
  markCandidates(candidates, state);
}
