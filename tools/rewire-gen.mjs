// Makes Rewire puzzles for the next N days and writes them as SQL to paste into Supabase.
// Run: node tools/rewire-gen.mjs 60 > rewire.local.sql
// Each run uses a fresh random secret, so the app's code can't predict puzzles. Days that
// nobody has played yet are replaced; a day someone has played is never changed.
import { randomBytes } from 'node:crypto';
import { generate } from '../src/games/rewireLogic.js';

const days = +(process.argv[2] || 60), salt = randomBytes(16).toString('hex');
const rows = [];
for (let d = 0; d < days; d++) {
  const day = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  rows.push(`('rewire', '${day}', '${JSON.stringify(generate(day, undefined, salt))}'::jsonb)`);
}
console.log(`insert into public.dose_puzzles (game, day, content) values\n${rows.join(',\n')}\non conflict (game, day) do update set content = excluded.content
  where not exists (select 1 from public.dose_plays x where x.game = 'rewire' and x.day = excluded.day);`);
