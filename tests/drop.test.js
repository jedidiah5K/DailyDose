import { test, expect } from 'vitest';
import { simulate, makeCourse, cleanShot, landRate } from '../src/games/dropLogic.js';

test('shots are clamped to whole numbers inside the pull circle', () => {
  expect(cleanShot(10.4, -3.6)).toEqual([10, -4]);
  const [dx, dy] = cleanShot(500, 0);
  expect(dx).toBe(120); expect(dy).toBe(0);
});

test('the same shot always gives the same result', () => {
  const c = makeCourse('2026-10-26', 'test');
  const a = simulate(c, [37, -55], true), b = simulate(c, [37, -55], true);
  expect(a).toEqual(b);
});

test('every course can be landed, but not too easily', () => {
  for (const day of ['2026-10-26', '2026-10-27', '2026-10-28']) {
    const c = makeCourse(day, 'test');
    const rate = landRate(c);
    expect(rate).toBeGreaterThan(0.006);
    expect(rate).toBeLessThan(0.06);
  }
});

test('a ball dropped straight onto the cup lands', () => {
  const c = { ball: [180, 100], cup: [180, 586, 16], walls: [], bumpers: [] };
  expect(simulate(c, [0, 0]).landed).toBe(true);
});

test('the server runs the exact same physics as the app', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync('src/games/dropLogic.js', 'utf8');
  const server = readFileSync('supabase/functions/dose-drop/dropLogic.js', 'utf8').split('\n').slice(1).join('\n');
  expect(server).toBe(app);
});
