// Rewire: a grid of wire tiles. Rotate them so every building connects to a power plant, with no
// loose ends and no loops. Newer puzzles have two plants (cyan and amber): their networks must fill
// the grid between them and never touch. Each tile is a 4-bit mask: N=1, E=2, S=4, W=8.
export const N = 1, E = 2, S = 4, W = 8;
const DIRS = [[N, 0, -1, S], [E, 1, 0, W], [S, 0, 1, N], [W, -1, 0, E]];

export const rot = (m, k = 1) => { k &= 3; return ((m << k) | (m >> (4 - k))) & 15; };
export const bits = m => (m & 1) + (m >> 1 & 1) + (m >> 2 & 1) + (m >> 3 & 1);
// The distinct ways a tile can face (a straight wire has 2, a cross has 1).
export const turns = m => [...new Set([0, 1, 2, 3].map(k => rot(m, k)))];
// Taps always turn clockwise, so the fewest taps to get a tile from `from` to `to`.
export const tapsTo = (from, to) => [0, 1, 2, 3].find(k => rot(from, k) === to) ?? 0;
// Par: the fewest taps that solve the whole puzzle.
export const par = (tiles, solution) => tiles.reduce((t, m, i) => t + tapsTo(m, solution[i]), 0);
export const plantsOf = p => Array.isArray(p.plants) ? p.plants : [p.plant];

// Weekday sets the size, NYT-style: Monday small, weekend big.
export const sizeFor = day => [7, 5, 5, 6, 6, 6, 7][new Date(day + 'T00:00:00Z').getUTCDay()];

function rng(seed) {
  let a = 0; for (const c of seed) a = Math.imul(a ^ c.charCodeAt(0), 2654435761) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// Which plant powers each cell (owner[i], -1 = none), and whether the grid is solved: no loose ends,
// every cell powered by exactly one plant, plants never joined, and no loops.
export function trace(tiles, w, plant) {
  const plants = Array.isArray(plant) ? plant : [plant];
  const h = tiles.length / w, owner = new Array(tiles.length).fill(-1), depth = {};
  let ok = true, edges = 0;
  tiles.forEach((m, i) => {
    const x = i % w, y = (i / w) | 0;
    for (const [b, dx, dy, back] of DIRS) if (m & b) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || !(tiles[ny * w + nx] & back)) ok = false;
      else if (b === E || b === S) edges++;
    }
  });
  plants.forEach((p0, k) => {
    if (owner[p0] !== -1) { ok = false; return; }
    owner[p0] = k; depth[p0] = 0; const q = [p0];
    while (q.length) {
      const i = q.shift(), x = i % w, y = (i / w) | 0;
      for (const [b, dx, dy, back] of DIRS) {
        const nx = x + dx, ny = y + dy, j = ny * w + nx;
        if (!(tiles[i] & b) || nx < 0 || ny < 0 || nx >= w || ny >= h || !(tiles[j] & back)) continue;
        if (owner[j] === -1) { owner[j] = k; depth[j] = depth[i] + 1; q.push(j); }
        else if (owner[j] !== k) ok = false;   // two plants wired together
      }
    }
  });
  const lit = new Set(owner.flatMap((o, i) => o >= 0 ? [i] : []));
  return { lit, owner, depth, solved: ok && lit.size === tiles.length && edges === tiles.length - plants.length };
}

// Counts solutions (stopping at 2). Gives up after `budget` steps and reports 2, so a hard-to-check
// puzzle is treated as not unique and thrown away.
export function countSolutions(tiles, w, plant, budget = 400000, out = []) {
  const plants = Array.isArray(plant) ? plant : [plant], isPlant = i => plants.includes(i);
  const h = tiles.length / w, n = tiles.length, cur = new Array(n), opts = tiles.map(turns);
  let found = 0, steps = 0;
  const go = i => {
    if (found > 1 || ++steps > budget) return;
    if (i === n) { if (trace(cur, w, plants).solved) { found++; out.splice(0, n, ...cur); } return; }
    const x = i % w, y = (i / w) | 0;
    for (const m of opts[i]) {
      if ((m & N) && y === 0 || (m & W) && x === 0 || (m & E) && x === w - 1 || (m & S) && y === h - 1) continue;
      if (y > 0 && !!(m & N) !== !!(cur[i - w] & S)) continue;
      if (x > 0 && !!(m & W) !== !!(cur[i - 1] & E)) continue;
      // two dead ends joined to each other make a cut-off pair
      if (n > 2 && bits(m) === 1 && !isPlant(i) && ((m & N && bits(cur[i - w]) === 1 && !isPlant(i - w)) || (m & W && bits(cur[i - 1]) === 1 && !isPlant(i - 1)))) continue;
      cur[i] = m; go(i + 1);
    }
  };
  go(0);
  return steps > budget ? 2 : found;
}

// Makes one day's puzzle: two trees grown out from two plants until they fill the grid, checked to
// have exactly one solution, then every tile spun to a random facing. Only tools/rewire-gen.mjs calls
// this, with a secret salt, so nobody can make tomorrow's puzzle from the app's code.
export function generate(day, size = sizeFor(day), salt = '', plantCount = 2) {
  for (let attempt = 0; ; attempt++) {
    const r = rng(`rewire:${salt}:${day}:${attempt}`), w = size, n = w * w, mid = (w >> 1) * w;
    const plants = plantCount === 1 ? [mid + (w >> 1)] : [mid + (w >> 2), mid + w - 1 - (w >> 2)];
    const tiles = new Array(n).fill(0), owner = new Array(n).fill(-1), edges = [];
    const addEdges = i => { const x = i % w, y = (i / w) | 0; for (const [b, dx, dy, back] of DIRS) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < w) edges.push([i, ny * w + nx, b, back]); } };
    plants.forEach((p0, k) => { owner[p0] = k; addEdges(p0); });
    let filled = plants.length;
    while (filled < n && edges.length) {
      const [i, j, b, back] = edges.splice((r() * edges.length) | 0, 1)[0];
      if (owner[j] !== -1 || bits(tiles[i]) >= 3) continue;   // ponytail: no 4-way crosses, they're boring to rotate
      tiles[i] |= b; tiles[j] |= back; owner[j] = owner[i]; filled++; addEdges(j);
    }
    if (filled < n) continue;
    const buildings = tiles.flatMap((m, i) => !plants.includes(i) && bits(m) === 1 ? [i] : []);
    // each colour should have at least two buildings to power
    if (plants.some((_, k) => buildings.filter(b => owner[b] === k).length < 2)) continue;
    if (!trace(tiles, w, plants).solved || countSolutions(tiles, w, plants) !== 1) continue;
    const scrambled = tiles.map(m => { const t = turns(m); return t.length === 1 ? m : rot(m, 1 + ((r() * 3) | 0)); });
    if (trace(scrambled, w, plants).solved) continue;
    return { w, plants, tiles: scrambled, solution: tiles, buildings, par: par(scrambled, tiles) };
  }
}
