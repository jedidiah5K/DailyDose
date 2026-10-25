// Local-first state, saved on the phone. Accounts and sync come later (Supabase).
import { dayKey, prevKey } from './day.js';

const KEY = 'dose:v1';
const blank = () => ({ settings: { sounds: true, haptics: true }, results: {}, progress: {} });
export const state = (() => { try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch (e) { return blank(); } })();
export const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

// results[game][day] = finished result; progress[game] = today's board (kept after finishing, to show it again).
export const resultFor = (game, day = dayKey()) => state.results[game]?.[day];
export function finish(game, result, day = dayKey()) {
  (state.results[game] ||= {})[day] = result;
  save();
}

// Days in a row with at least one game done. Today not played yet doesn't break it.
export function streak(game) {
  const played = d => game ? !!state.results[game]?.[d] : Object.values(state.results).some(r => r[d]);
  return countStreak(played, dayKey());
}

// One free freeze a week (Monday to Sunday): a single missed day is skipped over automatically,
// as long as you played the day before it. Two misses in a row still end the streak. Never sold.
const weekOf = key => { const t = Date.parse(key), dow = (new Date(t).getUTCDay() + 6) % 7; return dayKey(t - dow * 86400000); };
export function countStreak(played, today) {
  let d = today, n = 0;
  const frozen = new Set();
  if (!played(d)) d = prevKey(d);
  for (;;) {
    if (played(d)) { n++; d = prevKey(d); continue; }
    const wk = weekOf(d);
    if (n > 0 && !frozen.has(wk) && played(prevKey(d))) { frozen.add(wk); d = prevKey(d); continue; }
    return n;
  }
}
