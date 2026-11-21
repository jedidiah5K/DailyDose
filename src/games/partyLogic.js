import EMOJI from '../../content/emoji.json';
import IMP from '../../content/imposter.json';
import { rng, shuffle } from './queueLogic.js';

// Emoji Decode + Imposter (prototypes). shortcut: puzzles ship in the browser and loop when they run
// out; before going live they move to dose_puzzles with Postgres checks like the other games.
const pickDay = (set, day) => { const n = set.days.length, i = Math.round((Date.parse(day) - Date.parse(set.from)) / 864e5); return set.days[((i % n) + n) % n]; };

export const emojiDay = day => pickDay(EMOJI, day);
// imposter rounds: shown shuffled (same for everyone that day); the imposter is the last name in the file
export const imposterDay = day => { const r = rng(day + 'imp'); return pickDay(IMP, day).map(q => ({ ...q, odd: q.names[3], names: shuffle(q.names, r) })); };

// same forgiving match as the server's dose_typo_ok: accents, case, punctuation and a leading "the" don't count;
// 1 slip allowed from 4 letters, 2 from 6
export const clean = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/^(the|a|an) /, '').replace(/\s+/g, ' ').trim();
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] !== b[j - 1]));
  return d[a.length][b.length]; };
export const matches = (answers, typed) => { const t = clean(typed); if (!t) return false;
  return answers.some(a => { a = clean(a); if (a === t) return true; if (/\d/.test(a) || a.length < 4) return false; return lev(a, t) <= (a.length >= 6 ? 2 : 1); }); };
