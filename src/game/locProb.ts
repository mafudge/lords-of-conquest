// Mirrors LocProb.java L5-20.
export function combination(n: number, k: number): number {
  if (n < 0 || k < 0) return 0;
  if (k === 0 || n === 0) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result *= (n - i) / (i + 1);
  }
  return Math.round(result);
}
