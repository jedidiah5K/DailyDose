// Makes Last Stand rounds for the next N days as SQL to paste into Supabase.
// Run: node tools/last-gen.mjs 60 > last.local.sql   (a fresh random secret each run; published days are never changed)
import { randomBytes } from 'node:crypto';
import { makeRounds } from '../src/games/lastLogic.js';

const days = +(process.argv[2] || 60), salt = randomBytes(16).toString('hex'), rows = [];
for (let d = 0; d < days; d++) {
  const day = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  rows.push(`('last', '${day}', '${JSON.stringify({ rounds: makeRounds(day, salt) }).replace(/'/g, "''")}'::jsonb)`);
}
console.log(`insert into public.dose_puzzles (game, day, content) values\n${rows.join(',\n')}\non conflict (game, day) do nothing;`);
