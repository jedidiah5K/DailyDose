// The edition follows the player's local midnight: Australia gets a new paper at 12am there,
// California at 12am there. Puzzle #1 is launch day in that local calendar.
const LAUNCH_Y = 2026, LAUNCH_M = 9, LAUNCH_D = 25; // 25 Oct 2026
const DAY = 86400000;

const localYmd = t => {
  const d = new Date(t);
  return [d.getFullYear(), d.getMonth(), d.getDate()];
};
const pad = n => String(n).padStart(2, '0');

export const dayKey = (t = Date.now()) => {
  const [y, m, d] = localYmd(t);
  return `${y}-${pad(m + 1)}-${pad(d)}`;
};
export const puzzleNo = (t = Date.now()) => {
  const [y, m, d] = localYmd(t);
  const launch = new Date(LAUNCH_Y, LAUNCH_M, LAUNCH_D);
  const today = new Date(y, m, d);
  return Math.round((today - launch) / DAY) + 1;
};
export const msToReset = (t = Date.now()) => {
  const [y, m, d] = localYmd(t);
  return new Date(y, m, d + 1) - t;
};
export const prevKey = key => {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(+new Date(y, m - 1, d - 1));
};

// Solve times: 3:42 under an hour, 11:28:38 if it ran longer (leaving the tab open overnight
// used to print as 688:38, which looks like a clock bug).
export const clock = ms => {
  const s = Math.max(0, Math.floor(Number(ms) / 1000));
  const h = Math.floor(s / 3600);
  if (h) return `${h}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
};

export function countdown(t = Date.now()) {
  const s = Math.floor(msToReset(t) / 1000), p = n => pad(n);
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}
