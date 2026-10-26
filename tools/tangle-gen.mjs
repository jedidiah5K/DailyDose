// Makes Tangle knots for the next N days as SQL to paste into Supabase.
// Run: node tools/tangle-gen.mjs 60 > tangle.local.sql   (a fresh random secret each run; days already loaded are left alone)
import { randomBytes } from 'node:crypto';
import { generate } from '../src/games/tangleLogic.js';

const days = +(process.argv[2] || 60), salt = randomBytes(16).toString('hex'), rows = [];
for (let d = 0; d < days; d++) {
  const day = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const { n, edges, start } = generate(day, salt);   // the untangled answer stays here: any answer with no crossings counts
  rows.push(`('tangle', '${day}', '${JSON.stringify({ n, edges, start })}'::jsonb)`);
}
console.log(`insert into public.dose_puzzles (game, day, content) values\n${rows.join(',\n')}\non conflict (game, day) do update set content = excluded.content
  where not exists (select 1 from public.dose_plays x where x.game = 'tangle' and x.day = excluded.day);`);
