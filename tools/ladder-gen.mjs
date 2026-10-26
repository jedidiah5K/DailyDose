// Makes Ladder puzzles for the next N days as SQL, plus the word list the server checks against.
// Run: node tools/ladder-gen.mjs 45 > ladder.local.sql   (days already loaded are left alone)
// Each day: two everyday words (no plurals) whose shortest ladder is 4 to 6 steps, using only words
// from content/words4.txt. par = that shortest number of steps; path = one way to do it.
import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';

const words = readFileSync(new URL('../content/words4.txt', import.meta.url), 'utf8').split(/\s+/).filter(w => /^[a-z]{4}$/.test(w));
const set = new Set(words), days = +(process.argv[2] || 45);
const near = w => { const out = []; for (let i = 0; i < 4; i++) for (const c of 'abcdefghijklmnopqrstuvwxyz') { const v = w.slice(0, i) + c + w.slice(i + 1); if (v !== w && set.has(v)) out.push(v); } return out; };
function shortest(a, b) {
  const prev = new Map([[a, null]]), q = [a];
  while (q.length) { const w = q.shift(); if (w === b) break; for (const v of near(w)) if (!prev.has(v)) { prev.set(v, w); q.push(v); } }
  if (!prev.has(b)) return null;
  const path = []; for (let w = b; w; w = prev.get(w)) path.unshift(w);
  return path;
}
const ends = words.filter(w => !w.endsWith('s') && near(w).length >= 3), rows = [], used = new Set();
for (let d = 0; d < days; d++) {
  const day = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  for (;;) {
    const a = ends[randomInt(ends.length)], b = ends[randomInt(ends.length)], path = a !== b && !used.has(a) && !used.has(b) && shortest(a, b);
    if (!path || path.length - 1 < 4 || path.length - 1 > 6) continue;
    used.add(a); used.add(b);
    rows.push(`('ladder', '${day}', '${JSON.stringify({ start: a, end: b, par: path.length - 1, path })}'::jsonb)`);
    break;
  }
}
console.log(`insert into public.dose_words (word) values ${words.map(w => `('${w}')`).join(',')} on conflict do nothing;`);
console.log(`insert into public.dose_puzzles (game, day, content) values\n${rows.join(',\n')}\non conflict (game, day) do nothing;`);
