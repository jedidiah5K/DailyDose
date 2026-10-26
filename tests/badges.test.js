import { test, expect } from 'vitest';
import { earned, bestStreak } from '../src/lib/badges.js';

const nights = (list, r = {}) => Object.fromEntries(list.map(d => [d, r]));

test('badges come from results: firsts, full nights and game feats', () => {
  expect(earned({}).size).toBe(0);
  const day = '2026-10-26';
  const all = {
    rewire: { [day]: { ms: 50000, stars: 3 } }, hunch: { [day]: { points: 200, hits: 5 } },
    drop: { [day]: { landed: true, shot: 1, stars: 2 } }, meld: { [day]: { reads: 5, odd: 'pppxc' } },
    last: { [day]: { perfect: false, reached: 4 } },
  };
  const got = earned(all);
  for (const id of ['first', 'full', 'par', 'quick', 'bullseye', 'ace', 'reader', 'odd']) expect(got.has(id)).toBe(true);
  for (const id of ['week', 'stars', 'standing', 'regular']) expect(got.has(id)).toBe(false);
});

test('streak badges use the best run ever, freezes included', () => {
  // 7 nights in a row in October, broken since: still earned
  const run = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'];
  expect(bestStreak({ drop: nights(run) })).toBe(7);
  expect(earned({ drop: nights(run) }).has('week')).toBe(true);
  // one missed night in a week is frozen, like on the home screen
  expect(bestStreak({ drop: nights(['2026-10-20', '2026-10-21', '2026-10-23', '2026-10-24']) })).toBe(4);
});
