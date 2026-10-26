// Tangle: dots joined by lines. Drag the dots until no two lines cross. Positions live on a 0..1 board.
// The server runs the same check (dose_tangle_submit), so a "solved" board can't be faked.
export const NEAR = 0.02;      // a dot this close to a line it isn't part of counts as touching it
export const APART = 0.04;     // two dots closer than this sit on top of each other
// Weekday sets the size, like Rewire: Monday small, weekend big.
export const sizeFor = day => [11, 8, 8, 9, 9, 10, 11][new Date(day + 'T00:00:00Z').getUTCDay()];

const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const crosses = (p, q, r, s) => orient(r, s, p) * orient(r, s, q) < 0 && orient(p, q, r) * orient(p, q, s) < 0;
function distToSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

// Which lines are in trouble (crossing another line, or running through a dot), and which dots sit on
// a line or on another dot. Solved when both are empty.
export function tangles(pos, edges) {
  const bad = new Set(), badDots = new Set();
  edges.forEach(([a, b], i) => {
    edges.forEach(([c, d], j) => {
      if (j <= i || a === c || a === d || b === c || b === d) return;
      if (crosses(pos[a], pos[b], pos[c], pos[d])) { bad.add(i); bad.add(j); }
    });
    pos.forEach((p, k) => { if (k !== a && k !== b && distToSeg(p, pos[a], pos[b]) < NEAR) { bad.add(i); badDots.add(k); } });
  });
  pos.forEach((p, i) => pos.forEach((q, j) => { if (j > i && Math.hypot(p[0] - q[0], p[1] - q[1]) < APART) { badDots.add(i); badDots.add(j); } }));
  return { bad, badDots, solved: !bad.size && !badDots.size };
}

function rng(seed) {
  let a = 0; for (const c of seed) a = Math.imul(a ^ c.charCodeAt(0), 2654435761) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// One day's knot: random dots joined shortest-first by lines that never cross (so a solution exists),
// then the dots dealt round a circle in a random order. Only tools/tangle-gen.mjs calls this, with a
// secret salt.
export function generate(day, salt = '', n = sizeFor(day)) {
  for (let attempt = 0; ; attempt++) {
    const r = rng(`tangle:${salt}:${day}:${attempt}`), pts = [];
    for (let tries = 0; pts.length < n && tries < 2000; tries++) {
      const p = [0.1 + r() * 0.8, 0.1 + r() * 0.8];
      if (pts.every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.16)) pts.push(p);
    }
    if (pts.length < n) continue;
    const pairs = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])]);
    pairs.sort((x, y) => x[2] - y[2]);
    const edges = [], deg = Array(n).fill(0), target = Math.round(n * 1.75);
    for (const [i, j] of pairs) {
      if (edges.length >= target) break;
      if (deg[i] >= 4 || deg[j] >= 4) continue;
      const trial = [...edges, [i, j]];
      if (tangles(pts, trial).solved) { edges.push([i, j]); deg[i]++; deg[j]++; }
    }
    // everything joined up, and no dot hanging off a single line
    const root = Array.from({ length: n }, (_, i) => i), find = i => root[i] === i ? i : (root[i] = find(root[i]));
    edges.forEach(([a, b]) => { root[find(a)] = find(b); });
    if (deg.some(d => d < 2) || new Set(root.map((_, i) => find(i))).size > 1) continue;
    const order = Array.from({ length: n }, (_, i) => i).sort(() => r() - 0.5);
    const start = Array(n);
    order.forEach((node, k) => { const a = -Math.PI / 2 + k * 2 * Math.PI / n; start[node] = [+(0.5 + 0.38 * Math.cos(a)).toFixed(4), +(0.5 + 0.38 * Math.sin(a)).toFixed(4)]; });
    if (tangles(start, edges).bad.size < n) continue;   // a real knot to start from
    return { n, edges, start, solution: pts.map(p => p.map(v => +v.toFixed(4))) };
  }
}
