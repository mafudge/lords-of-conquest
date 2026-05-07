import { type RngState, nextInt } from './rng.js';

// Verbatim from reasons.txt inside loc.jar (21 entries).
export const REASONS: readonly string[] = [
  'Plagues of Cockroaches',
  'Stack Imbalance',
  'Floods',
  'Bureaucracy',
  'Seemingly Insoluble Problems',
  'Political Scandals',
  'Eons of Game Playing',
  'Feverish Apathy',
  'Y2K Bug',
  'Recession',
  'Vicious Vermin',
  'Strong Siroccos',
  'A Series of Snafus',
  'The Release of a Star Wars Movie',
  'Earthquakes',
  'Rampaging Pestilence',
  'General Lawlessness',
  'Civil Wars',
  'Glorification of Ignorance',
  'Public Executions',
  'Presidential Vote Recounts',
] as const;

export function pickReason(r: RngState): string {
  return REASONS[nextInt(r, REASONS.length)]!;
}
