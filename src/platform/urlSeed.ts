export function parseSeedFromUrl(href: string): number | null {
  // Accept either a full URL or a bare query string.
  const q = href.includes('?') ? href.slice(href.indexOf('?')) : href.startsWith('?') ? href : '';
  if (!q) return null;
  const params = new URLSearchParams(q.slice(1));
  const v = params.get('seed');
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formatSeedAsUrl(href: string, seed: number): string {
  const [base, query = ''] = href.split('?', 2);
  const params = new URLSearchParams(query);
  params.set('seed', String(seed));
  return `${base}?${params.toString()}`;
}
