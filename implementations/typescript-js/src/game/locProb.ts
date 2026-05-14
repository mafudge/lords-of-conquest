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

export function probSuccess(att: number, def: number): number {
  if (att <= 0) return 0;
  if (def <= 0) return 1;
  if (att === 1) return Math.pow(0.5, def);
  if (def === 1) return 1 - Math.pow(0.5, att);
  let sum = 0;
  for (let k = 0; k < att; k++) {
    sum += combination(att + def - 1, k);
  }
  return sum / Math.pow(2, att + def - 1);
}
