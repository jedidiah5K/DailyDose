// Makes Missing Link and Anagram puzzles as SQL from content/link.json and content/anagram.json.
// Run: node tools/words-gen.mjs > words.local.sql   (days already played are left alone)
// Anagram scrambles are shuffled here once, never equal to the word and never starting the same way.
import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';

const read = f => JSON.parse(readFileSync(new URL(`../content/${f}`, import.meta.url), 'utf8'));
const dayAt = (from, i) => new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10);
const sql = o => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
function scramble(w) {
  for (;;) {
    const a = [...w]; for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    const s = a.join(''); if (s !== w && s.slice(0, 2) !== w.slice(0, 2)) return s;
  }
}

const link = read('link.json'), ana = read('anagram.json'), rows = [];
link.days.forEach((links, i) => rows.push(`('link', '${dayAt(link.from, i)}', ${sql({ links: links.map(l => ({ clues: l.clues, answer: l.answer, also: l.also || [] })) })})`));
ana.days.forEach((words, i) => rows.push(`('anagram', '${dayAt(ana.from, i)}', ${sql({ words, scrambles: words.map(scramble), also: words.map(w => ana.also[w] || []) })})`));
console.log(`insert into public.dose_puzzles (game, day, content) values\n${rows.join(',\n')}\non conflict (game, day) do update set content = excluded.content
  where not exists (select 1 from public.dose_plays p where p.game = excluded.game and p.day = excluded.day);`);
