// Local-first state, saved on the phone. Accounts and sync come later (Supabase).
import { dayKey, prevKey } from './day.js';

const KEY = 'dose:v1';
const blank = () => ({ settings: { sounds: true, haptics: true }, results: {}, progress: {} });
export const state = (() => { try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch (e) { return blank(); } })();
export const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

// results[game][day] = finished result; progress[game] = today's game in progress.
export const resultFor = (game, day = dayKey()) => state.results[game]?.[day];
export function finish(game, result, day = dayKey()) {
  (state.results[game] ||= {})[day] = result;
  delete state.progress[game];
  save();
}

// Days in a row with at least one game done. Today not played yet doesn't break it.
export function streak(game) {
  const played = d => game ? !!state.results[game]?.[d] : Object.values(state.results).some(r => r[d]);
  let d = dayKey(), n = 0;
  if (!played(d)) d = prevKey(d);
  while (played(d)) { n++; d = prevKey(d); }
  return n;
}
