import { test, expect } from 'vitest';
import { puzzleNo, countdown, clock, dayKey, prevKey } from '../src/lib/day.js';

test('puzzle numbers and countdown follow local midnight', () => {
  expect(puzzleNo(new Date(2026, 9, 25, 23, 59))).toBe(1);
  expect(puzzleNo(new Date(2026, 9, 26, 0, 0))).toBe(2);
  expect(countdown(new Date(2026, 9, 26, 22, 0, 0))).toBe('02:00:00');
  expect(dayKey(new Date(2026, 9, 26, 15, 0))).toBe('2026-10-26');
  expect(prevKey('2026-10-26')).toBe('2026-10-25');
});

test('clock uses hours once a solve passes 60 minutes', () => {
  expect(clock(90_000)).toBe('1:30');
  expect(clock(688 * 60_000 + 38_000)).toBe('11:28:38');
});
