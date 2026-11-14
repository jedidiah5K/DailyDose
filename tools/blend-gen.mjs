// Makes Blend puzzles as SQL from content/blend.json.
// Run: node tools/blend-gen.mjs > blend.local.sql   (days already played are left alone)
// Checks every list first and stops on a mistake: answers and aliases must be plain lowercase words,
// and every alias must point at a listed answer.
import { readFileSync } from 'node:fs';

const src = JSON.parse(readFileSync(new URL('../content/blend.json', import.meta.url), 'utf8'));
const dayAt = (from, i) => new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10);
const sql = o => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
const WORD = /^[a-z]+( [a-z]+)*$/;
const bad = [];

// "banana 60, lemon 20, kiwi" -> { banana: 60, lemon: 20, kiwi: 1 }
export function parse(list, where) {
  const out = {};
  for (const part of list.split(',').map(s => s.trim()).filter(Boolean)) {
    const m = part.match(/^(.*?)(?:\s+(\d+(?:\.\d+)?))?$/);
    const w = m[1].trim(), n = m[2] ? +m[2] : 1;
    if (!WORD.test(w)) bad.push(`${where}: "${w}" must be lowercase letters and spaces`);
    else if (!(w in out)) out[w] = n;
  }
  return out;
}

const rows = src.days.map((prompts, i) => {
  if (prompts.length !== 5) bad.push(`day ${i + 1}: needs 5 prompts, has ${prompts.length}`);
  const out = prompts.map((p, k) => {
    const where = `day ${i + 1} prompt ${k + 1}`;
    if (!['crowd', 'rare'].includes(p.mode)) bad.push(`${where}: mode must be crowd or rare`);
    const answers = parse(p.a, where);
    const alias = {};
    for (const [from, to] of Object.entries(p.alias || {})) {
      if (!WORD.test(from)) bad.push(`${where}: alias "${from}" must be lowercase letters and spaces`);
      else if (!(to in answers)) bad.push(`${where}: alias "${from}" points at "${to}", which isn't listed`);
      else if (!(from in answers)) alias[from] = to;
    }
    if (Object.keys(answers).length < (p.mode === 'rare' ? 10 : 15)) bad.push(`${where}: too few answers`);
    return { q: p.q, mode: p.mode, answers, alias, ...(p.drop ? { drop: p.drop } : {}) };
  });
  return `('blend', '${dayAt(src.from, i)}', ${sql({ prompts: out })})`;
});

if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`insert into public.dose_puzzles (game, day, content) values\n${rows.join(',\n')}\non conflict (game, day) do update set content = excluded.content
  where not exists (select 1 from public.dose_plays p where p.game = excluded.game and p.day = excluded.day);`);
