// Makes Drop courses for the next N days and writes them as SQL to paste into Supabase.
// Run: node tools/drop-gen.mjs 60 > drop.local.sql
// Every course is checked: some shots land, but only a small share of them (see makeCourse).
import { randomBytes } from 'node:crypto';
import { makeCourse } from '../src/games/dropLogic.js';

const days = +(process.argv[2] || 60), salt = randomBytes(16).toString('hex'), rows = [];
for (let d = 0; d < days; d++) {
  const day = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  rows.push(`('drop', '${day}', '${JSON.stringify(makeCourse(day, salt))}'::jsonb)`);
  process.stderr.write('.');
}
console.log(`insert into public.dose_puzzles (game, day, content) values\n${rows.join(',\n')}\non conflict (game, day) do nothing;`);
