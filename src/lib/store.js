// Local-first state, saved on the phone. Finished games also live on the server and are merged back in
// (mergeResults), so a signed-in player sees the same history on every phone.
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
  globalThis.dispatchEvent?.(new Event('dose:finish'));   // badges listen for this
}

// The server's copy of a finished game is the official one. Returns whether anything changed.
const same = (a, b) => JSON.stringify(Object.entries(a || {}).sort()) === JSON.stringify(Object.entries(b || {}).sort());
export function mergeResults(rows) {
  let changed = false;
  for (const { game, day, result } of rows) {
    const mine = (state.results[game] ||= {});
    if (result && !same(mine[day], result)) { mine[day] = result; changed = true; }
  }
  if (changed) save();
  return changed;
}
// Signing in or out switches whose games these are: start clean and let the server fill them back in.
export function forgetGames() { state.results = {}; state.progress = {}; delete state.badges; save(); }

// Days in a row with at least one game done. Today not played yet doesn't break it.
export function streak(game, frozen) {
  const played = d => game ? !!state.results[game]?.[d] : Object.values(state.results).some(r => r[d]);
  return countStreak(played, dayKey(), frozen);
}
// Has this week's free freeze already been used to save the current streak?
export function freezeUsedThisWeek() { const f = new Set(); streak(undefined, f); return f.has(weekOf(dayKey())); }

// One free freeze a week (Monday to Sunday): a single missed day is skipped over automatically,
// as long as you played the day before it. Two misses in a row still end the streak. Never sold.
const weekOf = key => {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(y, m - 1, d), dow = (t.getDay() + 6) % 7;
  return dayKey(+new Date(y, m - 1, d - dow));
};
export function countStreak(played, today, frozen = new Set()) {
  let d = today, n = 0;
  if (!played(d)) d = prevKey(d);
  for (;;) {
    if (played(d)) { n++; d = prevKey(d); continue; }
    const wk = weekOf(d);
    if (n > 0 && !frozen.has(wk) && played(prevKey(d))) { frozen.add(wk); d = prevKey(d); continue; }
    return n;
  }
}
