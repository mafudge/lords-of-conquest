import type { GameState } from '../../game/types.js';
import type { Plan } from '../../game/plans.js';

let fastForward = false;
export function setFastForward(v: boolean): void { fastForward = v; }
export function getFastForward(): boolean { return fastForward; }

export async function animatePlan(prev: GameState, next: GameState, plan: Plan): Promise<void> {
  if (fastForward) return;

  switch (plan.kind) {
    case 'selection': return animateSelection(plan.territoryId);
    case 'production': return animateProduction(prev, next);
    case 'attack':
    case 'resolveCombat': return animateCombat(prev, next);
    case 'buildCity':
    case 'buildWeapon':
    case 'buildBoat': return animateBuild((plan as any).territoryId);
    case 'shipStockpile':
    case 'shipHorse':
    case 'shipWeapon':
    case 'shipBoat': return animateShipment(prev, next, plan);
    case 'trade': return animateTradeProposal();
    case 'tradeResponse': return animateTradeResponse((plan as any).accept);
    default: return;
  }
}

async function animateSelection(territoryId: number): Promise<void> {
  const els = document.querySelectorAll<SVGElement>(
    `.board-svg .sq[data-territory-id="${territoryId}"]`,
  );
  if (els.length === 0) return;
  els.forEach((el) => el.classList.add('flash'));
  await new Promise((r) => setTimeout(r, 200));
  els.forEach((el) => el.classList.remove('flash'));
}

async function animateProduction(_prev: GameState, _next: GameState): Promise<void> {
  await new Promise((r) => setTimeout(r, 100));
}

async function animateCombat(_prev: GameState, _next: GameState): Promise<void> {
  const board = document.querySelector('.board-svg');
  if (board) {
    board.classList.add('combat-flash');
    await new Promise((r) => setTimeout(r, 120));
    board.classList.remove('combat-flash');
  }
}

async function animateBuild(_territoryId: number): Promise<void> {
  await new Promise((r) => setTimeout(r, 150));
}

async function animateShipment(_prev: GameState, _next: GameState, _plan: Plan): Promise<void> {
  await new Promise((r) => setTimeout(r, 150));
}

async function animateTradeProposal(): Promise<void> {
  await new Promise((r) => setTimeout(r, 150));
}

async function animateTradeResponse(_accept: boolean): Promise<void> {
  await new Promise((r) => setTimeout(r, 150));
}
