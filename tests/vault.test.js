import { test, expect } from 'vitest';
import { puzzleNo, countdown } from '../src/lib/day.js';

test('puzzle numbers and countdown follow UTC midnight', () => {
  expect(puzzleNo(Date.UTC(2026, 9, 25, 23, 59))).toBe(1);
  expect(puzzleNo(Date.UTC(2026, 9, 26, 0, 0))).toBe(2);
  expect(countdown(Date.UTC(2026, 9, 25, 22, 0, 0))).toBe('02:00:00');
});
