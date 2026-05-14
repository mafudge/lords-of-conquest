import type { Square } from '../types.js';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants.js';

// Flood-fill all open-water cells (territoryId === null AND not boundary water?
// No — boundary water counts as water for lake purposes too in Gettman, see
// LocApplet L3480-3519). For each connected water region:
//   if size < threshold: annex into the territory immediately ABOVE the
//     uppermost cell (or scan DOWN if at y == 0) — matches Gettman's "above"
//     rule.
//   if size >= threshold: assign a fresh lakeId to every cell in the region.
export function assessLakes(squares: Square[], threshold: number): void {
  const visited = new Set<number>();
  let nextLakeId = 0;
  for (let i = 0; i < squares.length; i++) {
    const s = squares[i]!;
    if (s.territoryId !== null || visited.has(i)) continue;
    // BFS over connected water
    const region: number[] = [];
    const stack = [i];
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      const cs = squares[cur]!;
      if (cs.territoryId !== null) continue;
      visited.add(cur);
      region.push(cur);
      const x = cs.x, y = cs.y;
      const neighbors = [
        x > 0 ? cur - 1 : -1,
        x < GRID_WIDTH - 1 ? cur + 1 : -1,
        y > 0 ? cur - GRID_WIDTH : -1,
        y < GRID_HEIGHT - 1 ? cur + GRID_WIDTH : -1,
      ];
      for (const n of neighbors) if (n >= 0 && !visited.has(n)) stack.push(n);
    }
    if (region.length < threshold) {
      // Find the uppermost cell — the one with min y (and min x as tie-break).
      const top = region.reduce((best, idx) => {
        const a = squares[idx]!, b = squares[best]!;
        if (a.y < b.y || (a.y === b.y && a.x < b.x)) return idx;
        return best;
      });
      const ts = squares[top]!;
      // Look up: territory directly above; if y == 0 scan downward.
      let annexInto: number | null = null;
      if (ts.y === 0) {
        for (let yy = 1; yy < GRID_HEIGHT; yy++) {
          const probe = squares[yy * GRID_WIDTH + ts.x]!;
          if (probe.territoryId !== null) { annexInto = probe.territoryId; break; }
        }
      } else {
        const probe = squares[(ts.y - 1) * GRID_WIDTH + ts.x]!;
        annexInto = probe.territoryId;
      }
      if (annexInto !== null) {
        for (const idx of region) squares[idx]!.territoryId = annexInto;
      }
      // If no surrounding land, leave as water (rare edge case in unconfined gen).
    } else {
      const lakeId = nextLakeId++;
      for (const idx of region) squares[idx]!.lakeId = lakeId;
    }
  }
}
