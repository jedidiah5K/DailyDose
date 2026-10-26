// Makes Cipher puzzles, one quote a day from content/cipher.json starting at a date, as SQL to paste into Supabase.
// Run: node tools/cipher-gen.mjs 2026-10-26 > cipher.local.sql   (days already loaded are left alone)
// Each day gets a fresh random key where no letter stands for itself, and its most common letters
// shown for free (about one in six of the different letters, at least one).
import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';

const start = process.argv[2] || new Date().toISOString().slice(0, 10);
const { quotes } = JSON.parse(readFileSync(new URL('../content/cipher.json', import.meta.url), 'utf8'));
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function key() {
  for (;;) {
    const k = [...A];
    for (let i = k.length - 1; i > 0; i--) { const j = randomInt(i + 1); [k[i], k[j]] = [k[j], k[i]]; }
    if (k.every((c, i) => c !== A[i])) return k.join('');
  }
}
const rows = quotes.map(([text, by], d) => {
  const day = new Date(Date.parse(start) + d * 86400000).toISOString().slice(0, 10);
  const up = text.toUpperCase(), count = {};
  for (const ch of up) if (A.includes(ch)) count[ch] = (count[ch] || 0) + 1;
  const letters = Object.keys(count).sort((a, b) => count[b] - count[a]);
  const given = letters.slice(0, Math.max(1, Math.round(letters.length / 6)));
  if (/[^A-Z .,;:'!?\-]/.test(up.normalize('NFD').replace(/[̀-ͯ]/g, ''))) throw new Error(`odd character in: ${text}`);
  return `('cipher', '${day}', '${JSON.stringify({ text: up, by, key: key(), given }).replace(/'/g, "''")}'::jsonb)`;
});
console.log(`insert into public.dose_puzzles (game, day, content) values\n${rows.join(',\n')}\non conflict (game, day) do nothing;`);
