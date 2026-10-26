// Badges: worked out from your finished games, so nothing extra is stored. Earned once and never taken
// away (streak badges look at your best run ever, freezes included, same as the home screen).
import { countStreak } from './store.js';
import { icon } from '../ui/icons.js';

const GAMES = ['rewire', 'hunch', 'link', 'tangle', 'anagram', 'ladder'];
const any = (results, k, test) => Object.values(results[k] || {}).some(test);

export const BADGES = [
  { id: 'first', name: 'First light', how: 'Finish any game', mark: 'window', test: (_, n) => n.total > 0 },
  { id: 'full', name: 'Full dose', how: 'Every game in one night', mark: String(GAMES.length), test: (_, n) => n.fullNights > 0 },
  { id: 'week', name: 'A week of nights', how: '7 nights in a row', mark: '7', test: (_, n) => n.best >= 7 },
  { id: 'month', name: 'A month of nights', how: '30 nights in a row', mark: '30', test: (_, n) => n.best >= 30 },
  { id: 'regular', name: 'Regular', how: '50 games played', mark: '50', test: (_, n) => n.total >= 50 },
  { id: 'par', k: 'rewire', name: 'Right on par', how: 'Solve Rewire in par taps', test: r => any(r, 'rewire', x => x.stars === 3) },
  { id: 'quick', k: 'rewire', name: 'Quick wiring', how: 'Solve Rewire in under a minute', test: r => any(r, 'rewire', x => x.ms < 60000) },
  { id: 'bullseye', k: 'hunch', name: 'Bullseye', how: 'All 5 Hunch guesses in your band', test: r => any(r, 'hunch', x => x.hits === 5) },
  { id: 'nimble', k: 'tangle', name: 'Nimble fingers', how: 'Untangle a knot in under 30 seconds', test: r => any(r, 'tangle', x => x.ms < 30000) },
  { id: 'linked', k: 'link', name: 'Perfect links', how: 'All five links on the first try', test: r => any(r, 'link', x => x.score === 15) },
  { id: 'unscrambled', k: 'anagram', name: 'Quick letters', how: 'All five anagrams in under 2 minutes', test: r => any(r, 'anagram', x => x.solved === x.n && x.ms < 120000) },
  { id: 'shortest', k: 'ladder', name: 'Shortest way', how: 'Finish Ladder in par steps', test: r => any(r, 'ladder', x => x.solved && x.steps === x.par) },
];

// Your longest run of nights, worked out the same way as the streak on the home screen.
export function bestStreak(results) {
  const days = new Set(Object.values(results).flatMap(r => Object.keys(r)));
  let best = 0;
  // ponytail: checks the run ending on every night played (n² over a year is still instant)
  for (const d of days) best = Math.max(best, countStreak(x => days.has(x), d));
  return best;
}

export function earned(results) {
  const perNight = {};
  for (const k of GAMES) for (const d in results[k] || {}) perNight[d] = (perNight[d] || 0) + 1;
  const n = {
    total: Object.values(perNight).reduce((a, b) => a + b, 0),
    fullNights: Object.values(perNight).filter(c => c >= GAMES.length).length,
    best: bestStreak(results),
  };
  return new Set(BADGES.filter(b => b.test(results, n)).map(b => b.id));
}

// A badge is a small neon ring: the game's icon in its colour, or a number for the all-games ones.
// Not earned yet: an unlit dashed outline.
const WINDOW = '<svg class="gi" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="1.5"/><path d="M12 5v14M5 12h14"/></svg>';
export const badgeArt = (b, on) => `<span class="bdg${on ? ' on' : ''}" style="--bc:var(${b.k ? `--c-${b.k}` : '--c-hunch'})" aria-hidden="true">${
  b.k ? icon(b.k) : b.mark === 'window' ? WINDOW : `<b>${b.mark}</b>`}</span>`;
