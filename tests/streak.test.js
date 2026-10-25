import { test, expect } from 'vitest';
import { countStreak } from '../src/lib/store.js';

const days = list => d => list.includes(d);
// 2026-10-25 is a Sunday; 2026-10-19 the Monday of that week.

test('counts days in a row and ignores today if not played yet', () => {
  expect(countStreak(days(['2026-10-25', '2026-10-24', '2026-10-23']), '2026-10-25')).toBe(3);
  expect(countStreak(days(['2026-10-24', '2026-10-23']), '2026-10-25')).toBe(2);
  expect(countStreak(days([]), '2026-10-25')).toBe(0);
});

test('one missed day a week is frozen, not a break', () => {
  // played 25, 24, missed 23, played 22, 21
  expect(countStreak(days(['2026-10-25', '2026-10-24', '2026-10-22', '2026-10-21']), '2026-10-25')).toBe(4);
});

test('two misses in one week end the streak at the second', () => {
  expect(countStreak(days(['2026-10-25', '2026-10-23', '2026-10-21', '2026-10-20']), '2026-10-25')).toBe(2);
});

test('two misses in a row are never bridged', () => {
  expect(countStreak(days(['2026-10-25', '2026-10-22', '2026-10-21']), '2026-10-25')).toBe(1);
});

test('each week gets its own freeze', () => {
  // miss 23 (week of 19 Oct) and 15 (week of 12 Oct)
  const played = ['2026-10-25', '2026-10-24', '2026-10-22', '2026-10-21', '2026-10-20', '2026-10-19', '2026-10-18', '2026-10-17', '2026-10-16', '2026-10-14'];
  expect(countStreak(days(played), '2026-10-25')).toBe(10);
});
