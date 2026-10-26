// Turns Mind Meld days from content/meld.json into SQL to paste into Supabase, after checking them.
// Run: node tools/meld-sql.mjs 2026-11-01 > meld.local.sql   (days from that date on; days already loaded are left alone)
// Checks: no answer or alias twice in a prompt, starting guesses add up to at most 100%, and every
// label and alias is matched to its own answer by the same rules the server uses (dose_meld_match).
import { readFileSync } from 'node:fs';

const from = process.argv[2] || '0000';
const meld = JSON.parse(readFileSync(new URL('../content/meld.json', import.meta.url), 'utf8'));
const norm = t => String(t).toLowerCase().replace(/[^a-z0-9& ]/g, '').replace(/\s+/g, ' ').trim();
const lev = (a, b) => { const d = [...Array(b.length + 1).keys()]; for (const ca of a) { let prev = d[0]++; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (ca === b[j - 1] ? 0 : 1)); prev = t; } } return d[b.length]; };
// One pair of neighbouring letters swapped (dose_meld_swap1).
const swap1 = (a, b) => a !== b && a.length === b.length && [...a].some((_, i) => i < a.length - 1 && a.slice(0, i) + a[i + 1] + a[i] + a.slice(i + 2) === b);
// Same order and rules as the server: an exact match (ignoring a plural s) wins at once, else the closest typo.
function match(answers, text) {
  const n = norm(text); let best = null, bestD = 99;
  for (const a of answers) for (const c of [a[0], a[1], ...a[2]]) {
    const cn = norm(c);
    if (cn === n || cn.replace(/e?s$/, '') === n.replace(/e?s$/, '')) return a[0];
    const tol = cn.length >= 9 ? 2 : cn.length >= 5 ? 1 : 0, d = swap1(cn, n) ? 1 : lev(n, cn);
    if (d <= tol && d < bestD) { best = a[0]; bestD = d; }
  }
  return best;
}

const rows = [], problems = [];
for (const day of Object.keys(meld).filter(k => /^\d{4}-/.test(k) && k >= from).sort()) {
  for (const p of meld[day]) {
    const seen = new Map();
    for (const [id, label, aliases] of p.answers) for (const t of [label, ...aliases]) {
      const k = norm(t);
      if (seen.has(k) && seen.get(k) !== id) problems.push(`${day} "${p.q}": "${t}" is in ${seen.get(k)} and ${id}`);
      seen.set(k, id);
      if (match(p.answers, t) !== id) problems.push(`${day} "${p.q}": "${t}" matches ${match(p.answers, t)}, not ${id}`);
    }
    const sum = p.answers.reduce((s, a) => s + a[3], 0);
    if (sum > 100.01) problems.push(`${day} "${p.q}": guesses add up to ${sum}%`);
  }
  rows.push(`('meld', '${day}', '${JSON.stringify({ prompts: meld[day] }).replace(/'/g, "''")}'::jsonb)`);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`insert into public.dose_puzzles (game, day, content) values\n${rows.join(',\n')}\non conflict (game, day) do nothing;`);
