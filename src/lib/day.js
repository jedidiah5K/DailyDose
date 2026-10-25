// Every game resets at 00:00 UTC, so everyone on Earth plays the same puzzle on the same "day".
// Puzzle #1 is launch day.
const LAUNCH = Date.UTC(2026, 9, 25);
const DAY = 86400000;

export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
export const puzzleNo = (t = Date.now()) => Math.floor((t - LAUNCH) / DAY) + 1;
export const msToReset = (t = Date.now()) => DAY - (t % DAY);
export const prevKey = key => dayKey(Date.parse(key) - DAY);

export const clock = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function countdown(t = Date.now()) {
  const s = Math.floor(msToReset(t) / 1000), p = n => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}
