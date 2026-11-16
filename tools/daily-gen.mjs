// Makes The Shot, Rush and Drop puzzles as SQL from content/shot.json, rush.json and drop.json.
// Run: node tools/daily-gen.mjs > daily.local.sql   (days already played are left alone)
// One row per line, so a single day can be loaded on its own.
import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';

const read = f => JSON.parse(readFileSync(new URL(`../content/${f}`, import.meta.url), 'utf8'));
const dayAt = (from, i) => new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10);
const sql = o => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
const bad = [], rows = [];

// The Shot: answers are lowercase letters, digits and spaces (that's what the server compares)
const shot = read('shot.json');
shot.days.forEach((d, i) => {
  d.a.forEach(a => { if (!/^[a-z0-9]+( [a-z0-9]+)*$/.test(a)) bad.push(`shot day ${i + 1}: "${a}"`); });
  rows.push(['shot', dayAt(shot.from, i), { q: d.q, show: d.show, a: d.a }]);
});

// Rush: borrows Blend's lists ("banana 60, lemon 20, kiwi" -> { banana: 60, lemon: 20, kiwi: 1 })
const parse = list => Object.fromEntries(list.split(',').map(s => s.trim()).filter(Boolean)
  .map(p => { const m = p.match(/^(.*?)(?:\s+(\d+(?:\.\d+)?))?$/); return [m[1].trim(), m[2] ? +m[2] : 1]; }).reverse());
const blendPrompts = read('blend.json').days.flat(), rush = read('rush.json');
rush.days.forEach((d, i) => {
  const src = d.use ? blendPrompts.find(p => p.q === d.use) : d;
  if (!src) { bad.push(`rush day ${i + 1}: no Blend prompt "${d.use}"`); return; }
  const answers = parse(src.a), alias = Object.fromEntries(Object.entries(src.alias || {}).filter(([, to]) => to in answers));
  rows.push(['rush', dayAt(rush.from, i), { q: d.q, answers, alias }]);
});

// Drop: the chain gets harder as the pot grows (Job, 2026-11-16: "make questions harder").
// Steps 1-3 warm up (years 2+ apart, sizes 15-20% apart). From step 4 the pairs get close, and from
// step 8 very close: years 1-2 apart, sizes 5-35% apart. Never a tie, so there's always a right answer.
const drop = read('drop.json');
const diff = (p, a, b) => p.gap ? Math.abs(a - b) : Math.max(a, b) / Math.min(a, b);
const BANDS = {   // [closest allowed, furthest allowed]; a pool with spread-out numbers can loosen it with "hard": [close, knife]
  // for each stage: gap pools in years, ratio pools as a ratio
  warm: { gap: [2, 99], ratio: p => [p.ratio, 9e9] },
  close: { gap: [1, 4], ratio: p => [1.08, p.hard?.[0] ?? 1.6] },
  knife: { gap: [1, 2], ratio: p => [1.05, p.hard?.[1] ?? 1.35] },
};
const stage = k => (k < 3 ? 'warm' : k < 7 ? 'close' : 'knife');
function fits(p, k, a, b) {
  const band = BANDS[stage(k)], d = diff(p, a, b);
  const [lo, hi] = p.gap ? band.gap : band.ratio(p);
  return d >= lo && d <= hi && a !== b;
}
function chain(p) {
  for (let tries = 0; tries < 20000; tries++) {
    const pool = [...p.items], out = [pool.splice(randomInt(pool.length), 1)[0]];
    while (out.length < drop.chain && pool.length) {
      const ok = pool.filter(x => fits(p, out.length, x[1], out.at(-1)[1]));
      if (!ok.length) break;
      const pick = ok[randomInt(ok.length)]; pool.splice(pool.indexOf(pick), 1); out.push(pick);
    }
    if (out.length === drop.chain) return out.map(([n, v, s]) => ({ n, v, s }));
  }
  bad.push(`drop: couldn't build a chain from "${p.theme}"`);
}
for (let i = 0; i < 30; i++) {
  const p = drop.pools[i % drop.pools.length];
  rows.push(['hilo', dayAt(drop.from, i), { theme: p.theme, hi: p.hi, lo: p.lo, items: chain(p) }]);
}

if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`insert into public.dose_puzzles (game, day, content) values\n${rows.map(([g, d, c]) => `('${g}', '${d}', ${sql(c)})`).join(',\n')}
on conflict (game, day) do update set content = excluded.content
  where not exists (select 1 from public.dose_plays p where p.game = excluded.game and p.day = excluded.day);`);
