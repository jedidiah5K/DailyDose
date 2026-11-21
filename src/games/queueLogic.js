import DROP from '../../content/drop.json';

// Queue puzzle maker and checker (prototype; see src/screens/queue.js).
export const TRIES = 5, SIZE = 5;
const ASK = {
  "Who's younger?": ['Oldest to youngest', 'Born first', 'Born last'],
  'Which came out later?': ['First to last', 'Came first', 'Came last'],
  'Which movie came out later?': ['Oldest movie to newest', 'Oldest', 'Newest'],
  'Which is heavier? (typical adult)': ['Lightest to heaviest', 'Lightest', 'Heaviest'],
  'Which is taller?': ['Shortest to tallest', 'Shortest', 'Tallest'],
};

// same puzzle for everyone on the same day: a small seeded shuffle
export function rng(seed) { let a = [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761), 7); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const shuffle = (xs, r) => { xs = [...xs]; for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };

export function puzzleFor(day) {
  const r = rng(day), pools = DROP.pools.filter(p => ASK[p.theme]);
  const pool = pools[Math.floor(r() * pools.length)], seen = new Set(), items = [];
  for (const it of shuffle(pool.items, r)) { if (seen.has(it[1])) continue; seen.add(it[1]); items.push(it); if (items.length === SIZE) break; }
  const answer = [...items].sort((a, b) => a[1] - b[1]);
  let start = shuffle(items, r);
  if (start.every((it, i) => it === answer[i])) start = start.reverse();
  return { ask: ASK[pool.theme], answer, start };
}

// What one try earns: 'ok' in the right spot, else 'up' / 'down' toward where it belongs.
export const marks = (order, answer) => order.map((it, i) => { const at = answer.indexOf(it); return at === i ? 'ok' : at < i ? 'up' : 'down'; });

